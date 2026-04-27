"""
用户设置路由 - 个人资料 / AI 模型配置
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db, User, UserProfile, UserModelConfig
from ..core.crypto import encrypt_api_key, decrypt_api_key, mask_key
from .auth import _current_user

router = APIRouter(prefix="/api/users/me", tags=["users"])

# ─── Schemas ───────────────────────────────────────────────────────────────────

class ModelConfigSave(BaseModel):
    provider: str
    model: str
    base_url: str | None = None
    api_key: str | None = None  # 前端传明文，后端加密存储
    enabled: bool = True
    fallback_to_system: bool = True


class ModelConfigTest(BaseModel):
    provider: str
    model: str
    base_url: str | None = None
    api_key: str


# ─── 依赖 ──────────────────────────────────────────────────────────────────────

def _get_user(request, db):
    """获取当前登录用户"""
    user = _current_user(request, db)
    if not user:
        raise HTTPException(401, "未登录")
    return user


# ─── AI 模型配置 ───────────────────────────────────────────────────────────────

@router.get("/model-config")
def get_model_config(request, db: Session = Depends(get_db)):
    user = _get_user(request, db)
    user_id = str(user.ulid)

    config = db.query(UserModelConfig).filter(
        UserModelConfig.user_id == user_id,
        UserModelConfig.enabled == True
    ).first()

    system_default = {"provider": "zhipu", "model": "glm-5"}

    if not config:
        return {"mode": "system", "config": None, "systemDefault": system_default}

    return {
        "mode": "custom",
        "config": {
            "provider": config.provider,
            "model": config.model,
            "baseUrl": config.base_url,
            "apiKeyMasked": config.api_key_last4,
            "enabled": config.enabled,
            "fallbackToSystem": config.fallback_to_system,
            "lastTestStatus": config.last_test_status,
            "lastTestLatencyMs": config.last_test_latency_ms,
        },
        "systemDefault": system_default,
    }


@router.put("/model-config")
def save_model_config(
    req: ModelConfigSave,
    request,
    db: Session = Depends(get_db),
):
    user = _get_user(request, db)
    user_id = str(user.ulid)

    existing = db.query(UserModelConfig).filter(
        UserModelConfig.user_id == user_id,
        UserModelConfig.provider == req.provider
    ).first()

    api_key_encrypted = None
    api_key_last4 = None
    if req.api_key:
        api_key_encrypted = encrypt_api_key(req.api_key)
        api_key_last4 = mask_key(req.api_key)

    if existing:
        existing.model = req.model
        existing.base_url = req.base_url
        if req.api_key:
            existing.api_key_encrypted = api_key_encrypted
            existing.api_key_last4 = api_key_last4
        existing.enabled = req.enabled
        existing.fallback_to_system = req.fallback_to_system
        existing.updated_at = datetime.utcnow()
    else:
        import uuid
        existing = UserModelConfig(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=req.provider,
            model=req.model,
            base_url=req.base_url,
            api_key_encrypted=api_key_encrypted,
            api_key_last4=api_key_last4,
            enabled=req.enabled,
            fallback_to_system=req.fallback_to_system,
        )
        db.add(existing)

    db.commit()

    return {
        "success": True,
        "config": {
            "provider": req.provider,
            "model": req.model,
            "apiKeyMasked": api_key_last4 or "****",
            "enabled": req.enabled,
            "fallbackToSystem": req.fallback_to_system,
        },
    }


@router.post("/model-config/use-system")
def use_system_model(request, db: Session = Depends(get_db)):
    user = _get_user(request, db)
    user_id = str(user.ulid)

    db.query(UserModelConfig).filter(
        UserModelConfig.user_id == user_id
    ).update({"enabled": False})
    db.commit()

    return {"success": True, "mode": "system"}


@router.post("/model-config/test")
def test_model_config(req: ModelConfigTest):
    import httpx

    base_url = _get_default_base_url(req.provider) if not req.base_url else req.base_url

    try:
        start = datetime.utcnow()
        with httpx.Client(timeout=10) as client:
            response = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {req.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": req.model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 5,
                },
            )
        latency = int((datetime.utcnow() - start).total_seconds() * 1000)

        if response.status_code == 200:
            return {
                "success": True,
                "provider": req.provider,
                "model": req.model,
                "latencyMs": latency,
                "message": "连接成功",
            }
        else:
            return {
                "success": False,
                "code": "API_ERROR",
                "message": f"API 返回错误 {response.status_code}",
            }
    except Exception as e:
        return {"success": False, "code": "CONNECTION_FAILED", "message": str(e)}


def _get_default_base_url(provider: str) -> str:
    urls = {
        "zhipu": "https://open.bigmodel.cn/api/paas/v4",
        "moonshot": "https://api.moonshot.cn/v1",
        "minimax": "https://api.minimax.chat/v1",
        "deepseek": "https://api.deepseek.com/v1",
    }
    return urls.get(provider, "")