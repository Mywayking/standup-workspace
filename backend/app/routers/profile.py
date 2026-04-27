"""
Profile 路由 - 用户资料管理
GET  /api/profile/me  - 获取当前用户资料（不存在则自动创建）
PUT  /api/profile/me  - 更新当前用户资料
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, User, UserProfile
from ..services.session import get_user_id_from_session

router = APIRouter(prefix="/api/profile", tags=["profile"])


# ─── Schemas ────────────────────────────────────────────────────────────────────

class ProfileResponse(BaseModel):
    id: int
    userId: int
    displayName: str
    username: Optional[str]
    avatarUrl: str
    bio: str
    role: str

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    username: Optional[str] = None
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────────────

COOKIE_NAME = "session_id"


def _get_user(request: Request, db: Session) -> User:
    """从 cookie session 获取当前登录用户，未登录抛 401。"""
    sid = request.cookies.get(COOKIE_NAME)
    if not sid:
        raise HTTPException(401, "未登录")
    uid = get_user_id_from_session(sid)
    if not uid:
        raise HTTPException(401, "会话无效或已过期")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(401, "用户不存在")
    return user


# ─── GET /profile/me ───────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileResponse)
def get_my_profile(request: Request, db: Session = Depends(get_db)):
    """
    获取当前用户的 profile。
    如果 profile 不存在，自动创建默认 profile（display_name = 用户昵称或"用户"）。
    """
    user = _get_user(request, db)

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(
            user_id=user.id,
            display_name=user.nickname or "用户",
            username=None,
            avatar_url=user.avatar_url or "",
            bio="",
            role="creator",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return ProfileResponse(
        id=profile.id,
        userId=profile.user_id,
        displayName=profile.display_name,
        username=profile.username,
        avatarUrl=profile.avatar_url,
        bio=profile.bio,
        role=profile.role,
    )


# ─── PUT /profile/me ───────────────────────────────────────────────────────────

@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    req: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    更新当前用户的 profile。
    如果 profile 不存在，自动创建。
    """
    user = _get_user(request, db)

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(
            user_id=user.id,
            display_name=user.nickname or "用户",
            username=None,
            avatar_url=user.avatar_url or "",
            bio="",
            role="creator",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # 检查 username 唯一性（排除自己）
    if req.username and req.username != profile.username:
        existing = db.query(UserProfile).filter(
            UserProfile.username == req.username,
            UserProfile.user_id != user.id,
        ).first()
        if existing:
            raise HTTPException(400, "用户名已被占用")

    # 更新字段
    if req.displayName is not None:
        profile.display_name = req.displayName
    if req.username is not None:
        profile.username = req.username
    if req.avatarUrl is not None:
        profile.avatar_url = req.avatarUrl
    if req.bio is not None:
        profile.bio = req.bio

    db.commit()
    db.refresh(profile)

    return ProfileResponse(
        id=profile.id,
        userId=profile.user_id,
        displayName=profile.display_name,
        username=profile.username,
        avatarUrl=profile.avatar_url,
        bio=profile.bio,
        role=profile.role,
    )
