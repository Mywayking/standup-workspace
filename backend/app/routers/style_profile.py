"""
用户风格 Profile API — Phase 9
GET/PUT /api/write/style-profile
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import SessionLocal
from .auth import _current_user

router = APIRouter(prefix="/api/write", tags=["style-profile"])


class UserStyleProfileSchema(BaseModel):
    stageName: Optional[str] = None
    persona: Optional[str] = None
    commonTopics: list[str] = []
    forbiddenTopics: list[str] = []
    tone: Optional[str] = None
    preferredTechniques: list[str] = []


_PROFILE_KEY = "standup_v3_user_style"


def _load_profile(user_id: str) -> UserStyleProfileSchema:
    """从 localStorage 模拟读取（前端存本地，后端不做持久化）"""
    # Phase 9 uses localStorage only on frontend; backend just validates schema
    return UserStyleProfileSchema()


def _save_profile(user_id: str, profile: UserStyleProfileSchema) -> UserStyleProfileSchema:
    """保存到 localStorage（前端负责），后端仅返回确认"""
    return profile


@router.get("/style-profile")
async def get_style_profile(request: Request):
    """获取用户风格 Profile"""
    return UserStyleProfileSchema()


@router.put("/style-profile")
async def update_style_profile(req: UserStyleProfileSchema, request: Request):
    """更新用户风格 Profile"""
    # Validate
    if req.stageName is not None and len(req.stageName) > 50:
        raise HTTPException(400, "艺名太长了（最多50字）")
    if req.persona is not None and len(req.persona) > 500:
        raise HTTPException(400, "人设描述太长了（最多500字）")
    return {"status": "ok", "profile": req}
