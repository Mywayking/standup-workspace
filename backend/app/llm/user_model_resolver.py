"""
用户模型配置解析器 - 运行时从 DB 读取用户自定义模型
"""
from typing import Optional
from ..database import SessionLocal
from ..models.user_model_config import UserModelConfig
from ..core.crypto import decrypt_api_key


def resolve_user_model_runtime(user_id: str | None) -> dict:
    """
    解析用户当前使用的模型运行时配置。
    返回 dict 包含 { source, provider, model, base_url, api_key, fallback_to_system }
    - source="user" 时使用用户自填 Key
    - source="system" 时使用系统默认 Key
    """
    system = {
        "source": "system",
        "provider": "zhipu",
        "model": "glm-5",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key": None,  # 系统从 settings 读取
        "fallback_to_system": False,
    }

    if not user_id:
        return system

    db = SessionLocal()
    try:
        config = db.query(UserModelConfig).filter(
            UserModelConfig.user_id == user_id,
            UserModelConfig.enabled == True,
            UserModelConfig.api_key_encrypted.isnot(None),
        ).first()

        if not config or not config.api_key_encrypted:
            return system

        return {
            "source": "user",
            "provider": config.provider,
            "model": config.model,
            "base_url": config.base_url or "",
            "api_key": decrypt_api_key(config.api_key_encrypted),
            "fallback_to_system": config.fallback_to_system,
        }
    finally:
        db.close()


# Provider 默认 base URL 映射
_PROVIDER_BASE_URLS = {
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
    "moonshot": "https://api.moonshot.cn/v1",
    "minimax": "https://api.minimax.chat/v1",
    "deepseek": "https://api.deepseek.com/v1",
}


def get_provider_base_url(provider: str, base_url: str | None) -> str:
    if base_url:
        return base_url
    return _PROVIDER_BASE_URLS.get(provider, "")