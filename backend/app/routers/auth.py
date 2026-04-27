"""
Auth 路由 - 注册 / 登录 / 登出 / 当前用户 / 忘记密码 / 重置密码
"""
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, User, UserAuthMethod, UserProfile, CreatorProfile
from ..services import auth as auth_service
from ..services.session import create_session, delete_session, get_user_id_from_session
from ..services.email import send_password_reset_email
from ..config import settings
from ..utils.cookie import set_auth_cookie, clear_auth_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


# ─── Schemas ────────────────────────────────────────────────────────────────────

class RegisterReq(BaseModel):
    identifier: str
    identifierType: str  # email / phone
    password: str
    confirmPassword: str


class LoginReq(BaseModel):
    identifier: str
    password: str


class ForgotPasswordReq(BaseModel):
    identifier: str
    identifierType: str  # email


class ResetPasswordReq(BaseModel):
    tokenId: int
    token: str
    newPassword: str


class UserInfo(BaseModel):
    id: str
    nickname: str
    email: Optional[str]
    phone: Optional[str]
    profile: Optional["UserProfileInfo"]


class UserProfileInfo(BaseModel):
    displayName: str
    username: Optional[str]
    avatarUrl: str
    bio: str
    role: str


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _get_session_id(request: Request) -> Optional[str]:
    return request.cookies.get(COOKIE_NAME)


def _current_user(request: Request, db: Session) -> Optional[User]:
    """从 cookie session 获取当前登录用户"""
    sid = _get_session_id(request)
    if not sid:
        return None
    uid = get_user_id_from_session(sid)
    if not uid:
        return None
    return db.query(User).filter(User.id == uid).first()


def _validate_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def _validate_phone(phone: str) -> bool:
    return bool(re.match(r"^1[3-9]\d{9}$", phone))


# ─── 注册 ──────────────────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterReq, response: Response, db: Session = Depends(get_db)):
    # 参数校验
    if req.identifierType == "email":
        if not _validate_email(req.identifier):
            raise HTTPException(400, "请输入正确的邮箱地址")
    elif req.identifierType == "phone":
        if not _validate_phone(req.identifier):
            raise HTTPException(400, "请输入正确的手机号")
    else:
        raise HTTPException(400, "不支持的认证类型")

    if req.password != req.confirmPassword:
        raise HTTPException(400, "两次输入的密码不一致")

    user, err = auth_service.register_user(
        db, req.identifier, req.identifierType, req.password
    )
    if err:
        raise HTTPException(400, err)

    # 创建 session
    session_id = create_session(user.id)
    set_auth_cookie(response, session_id)

    # 查找用户的邮箱/手机和 profile
    email = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "email",
    ).first()
    phone = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "phone",
    ).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

    return {
        "success": True,
        "user": {
            "id": user.ulid,
            "nickname": profile.display_name if profile else user.nickname or "用户",
            "email": email.auth_identifier if email else None,
            "phone": phone.auth_identifier if phone else None,
            "profile": {
                "displayName": profile.display_name if profile else "",
                "username": profile.username if profile else "",
                "avatarUrl": profile.avatar_url if profile else "",
                "bio": profile.bio if profile else "",
                "role": profile.role if profile else "creator",
            } if profile else None,
        },
    }


# ─── 登录 ──────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(req: LoginReq, response: Response, db: Session = Depends(get_db)):
    # 自动判断是邮箱还是手机号
    identifier = req.identifier.strip()
    if "@" in identifier:
        identifier_type = "email"
        identifier_value = identifier.lower()
    else:
        identifier_type = "phone"
        identifier_value = identifier

    user, err = auth_service.login_user(db, identifier_value, req.password)
    if err:
        raise HTTPException(401, err)

    session_id = create_session(user.id)
    set_auth_cookie(response, session_id)

    email = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "email",
    ).first()
    phone = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "phone",
    ).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

    return {
        "success": True,
        "user": {
            "id": user.ulid,
            "nickname": profile.display_name if profile else user.nickname or "用户",
            "email": email.auth_identifier if email else None,
            "phone": phone.auth_identifier if phone else None,
            "profile": {
                "displayName": profile.display_name if profile else "",
                "username": profile.username if profile else "",
                "avatarUrl": profile.avatar_url if profile else "",
                "bio": profile.bio if profile else "",
                "role": profile.role if profile else "creator",
            } if profile else None,
        },
    }


# ─── 登出 ──────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    sid = _get_session_id(request)
    if sid:
        delete_session(sid)
    clear_auth_cookie(response)
    return {"success": True}


# ─── 当前用户 ──────────────────────────────────────────────────────────────────

@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = _current_user(request, db)
    if not user:
        return {"loggedIn": False, "user": None}

    email = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "email",
    ).first()
    phone = db.query(UserAuthMethod).filter(
        UserAuthMethod.user_id == user.id,
        UserAuthMethod.auth_type == "phone",
    ).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

    return {
        "loggedIn": True,
        "user": {
            "id": user.ulid,
            "nickname": profile.display_name if profile else user.nickname or "用户",
            "email": email.auth_identifier if email else None,
            "phone": phone.auth_identifier if phone else None,
            "profile": {
                "displayName": profile.display_name if profile else "",
                "username": profile.username if profile else "",
                "avatarUrl": profile.avatar_url if profile else "",
                "bio": profile.bio if profile else "",
                "role": profile.role if profile else "creator",
            } if profile else None,
        },
    }


# ─── 忘记密码 ──────────────────────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordReq, db: Session = Depends(get_db)):
    if req.identifierType != "email":
        raise HTTPException(400, "目前仅支持邮箱找回密码")

    if not _validate_email(req.identifier):
        raise HTTPException(400, "请输入正确的邮箱地址")

    result, err = auth_service.create_password_reset(
        db, req.identifier.lower(), "email"
    )
    if err:
        raise HTTPException(400, err)

    # 如果账号不存在，统一返回成功（不暴露账号是否存在）
    if result is True and err == "":
        return {"success": True, "message": "如果账号存在，重置链接已发送至邮箱"}

    # result 是 (token_id, raw_token)
    token_id, raw_token = result

    # 拼重置链接
    reset_url = f"https://standup.alwayshaha.art/reset-password?tokenId={token_id}&token={raw_token}"

    sent, email_err = send_password_reset_email(req.identifier.lower(), reset_url)
    if not sent:
        return {"success": False, "message": email_err or "邮件发送失败"}

    return {"success": True, "message": "重置链接已发送至邮箱，请查收"}


# ─── 重置密码 ──────────────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(req: ResetPasswordReq, db: Session = Depends(get_db)):
    if len(req.newPassword) < 8:
        raise HTTPException(400, "密码至少 8 位")

    ok, err = auth_service.reset_password_with_token(
        db, req.tokenId, req.token, req.newPassword
    )
    if not ok:
        raise HTTPException(400, err)

    return {"success": True, "message": "密码重置成功，请使用新密码登录"}


# ─── 用户资料 ─────────────────────────────────────────────────────────────────

class UpdateProfileReq(BaseModel):
    displayName: Optional[str] = None
    username: Optional[str] = None
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None


@router.patch("/users/profile")
def update_profile(
    req: UpdateProfileReq,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _current_user(request, db)
    if not user:
        raise HTTPException(401, "未登录")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "用户资料不存在")

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
    return {
        "success": True,
        "profile": {
            "displayName": profile.display_name,
            "username": profile.username,
            "avatarUrl": profile.avatar_url,
            "bio": profile.bio,
            "role": profile.role,
        },
    }


class UpdateCreatorProfileReq(BaseModel):
    creator_type: Optional[str] = None
    topics: Optional[list] = None
    humor_styles: Optional[list] = None
    stage_experience: Optional[str] = None
    preferred_output: Optional[str] = None
    avoid_topics: Optional[list] = None


@router.patch("/users/creator-profile")
def update_creator_profile(
    req: UpdateCreatorProfileReq,
    request: Request,
    db: Session = Depends(get_db),
):
    user = _current_user(request, db)
    if not user:
        raise HTTPException(401, "未登录")

    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == user.id).first()
    if not profile:
        profile = CreatorProfile(user_id=user.id)
        db.add(profile)

    if req.creator_type is not None:
        profile.creator_type = req.creator_type
    if req.topics is not None:
        profile.topics = req.topics
    if req.humor_styles is not None:
        profile.humor_styles = req.humor_styles
    if req.stage_experience is not None:
        profile.stage_experience = req.stage_experience
    if req.preferred_output is not None:
        profile.preferred_output = req.preferred_output
    if req.avoid_topics is not None:
        profile.avoid_topics = req.avoid_topics

    db.commit()
    return {
        "success": True,
        "creator_profile": {
            "creatorType": profile.creator_type,
            "topics": profile.topics,
            "humorStyles": profile.humor_styles,
            "stageExperience": profile.stage_experience,
            "preferredOutput": profile.preferred_output,
            "avoidTopics": profile.avoid_topics,
        },
    }
