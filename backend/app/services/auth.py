"""
Auth Service - 密码哈希、用户查找、限流
"""
import re
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from sqlalchemy.orm import Session

from ..database import User, UserAuthMethod, PasswordResetToken
from .session import create_session, delete_session

ph = PasswordHasher()


def _hash_password(password: str) -> str:
    return ph.hash(password)


def _verify_password(password: str, hashed: str) -> bool:
    try:
        ph.verify(hashed, password)
        return True
    except (VerifyMismatchError, InvalidHash):
        return False


# ─── 限流：IP + identifier 级别 ───────────────────────────────────────────────

_rate_limit_store: dict[str, datetime] = {}


def check_rate_limit(identifier: str, ip: str, action: str = "send_code") -> tuple[bool, str]:
    """
    简单内存限流。V1 够用（单进程）。
    同一 identifier 60s 内只能操作一次。
    """
    key = f"{action}:{identifier}"
    now = datetime.utcnow()
    if key in _rate_limit_store:
        last = _rate_limit_store[key]
        if (now - last).total_seconds() < 60:
            return False, "操作太频繁，请稍后再试"
    _rate_limit_store[key] = now
    return True, ""


# ─── 注册 ──────────────────────────────────────────────────────────────────────

def register_user(
    db: Session,
    identifier: str,
    identifier_type: str,  # email / phone
    password: str,
) -> tuple[Optional[User], str]:
    """
    注册用户。
    - 检查 identifier 是否已存在
    - 创建 user + auth_method
    - 返回 session_id
    """
    # 1. 检查是否重复
    existing = db.query(UserAuthMethod).filter(
        UserAuthMethod.auth_type == identifier_type,
        UserAuthMethod.auth_identifier == identifier.lower() if identifier_type == "email" else UserAuthMethod.auth_identifier == identifier,
    ).first()
    if existing:
        return None, "该账号已注册，请直接登录"

    # 2. 密码强度校验
    if len(password) < 8:
        return None, "密码至少 8 位"
    if password.strip() != password:
        return None, "密码不能包含前后空格"

    # 3. 创建用户
    import ulid
    user = User(ulid=ulid.ulid())
    db.add(user)
    db.flush()  # 获取 user.id

    # 4. 创建认证方式
    auth = UserAuthMethod(
        user_id=user.id,
        auth_type=identifier_type,
        auth_identifier=identifier.lower() if identifier_type == "email" else identifier,
        password_hash=_hash_password(password),
    )
    db.add(auth)
    db.commit()

    # 5. 更新 last_login_at
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return user, ""


# ─── 登录 ──────────────────────────────────────────────────────────────────────

def login_user(
    db: Session,
    identifier: str,
    password: str,
) -> tuple[Optional[User], str]:
    """
    验证账号密码。
    邮箱不区分大小写。
    """
    # 查找（邮箱尝试小写）
    auth = db.query(UserAuthMethod).filter(
        UserAuthMethod.auth_identifier == identifier.lower(),
    ).first()
    if not auth:
        # 手机号
        auth = db.query(UserAuthMethod).filter(
            UserAuthMethod.auth_identifier == identifier,
            UserAuthMethod.auth_type == "phone",
        ).first()

    if not auth:
        return None, "账号或密码错误"

    if not _verify_password(password, auth.password_hash):
        return None, "账号或密码错误"

    # 更新 last_login
    auth.user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return auth.user, ""


# ─── 忘记密码：生成重置 token ──────────────────────────────────────────────────

def create_password_reset(db: Session, identifier: str, identifier_type: str) -> tuple[bool, str]:
    """
    为给定账号创建密码重置 token（不发邮件，只返回 token_hash 用于后续校验）。
    返回 (success, error_message)
    """
    auth = db.query(UserAuthMethod).filter(
        UserAuthMethod.auth_type == identifier_type,
        UserAuthMethod.auth_identifier == identifier.lower() if identifier_type == "email" else UserAuthMethod.auth_identifier == identifier,
    ).first()

    if not auth:
        # 不暴露账号是否存在，统一提示"如果账号存在，邮件已发送"
        return True, ""  # 返回 True，前端不报错

    # 生成随机 token
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    rt = PasswordResetToken(
        user_id=auth.user_id,
        auth_method_id=auth.id,
        token_hash=token_hash,
        expired_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(rt)
    db.commit()

    # 返回完整 token 给调用方（让邮件服务发送）
    return rt.id, token  # (db_id, raw_token) — 调用方用 raw token 拼链接


def reset_password_with_token(
    db: Session,
    token_id: int,
    raw_token: str,
    new_password: str,
) -> tuple[bool, str]:
    """用 token + 验证码（这里 token 本身当验证码用）重置密码"""
    rt = db.query(PasswordResetToken).filter(
        PasswordResetToken.id == token_id,
        PasswordResetToken.used_at.is_(None),
    ).first()

    if not rt:
        return False, "链接无效或已失效"

    if datetime.utcnow() > rt.expired_at.replace(tzinfo=None) if rt.expired_at.tzinfo else datetime.utcnow() > rt.expired_at:
        return False, "链接已过期，请重新申请"

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    if token_hash != rt.token_hash:
        return False, "链接无效"

    if len(new_password) < 8:
        return False, "密码至少 8 位"

    # 更新密码
    rt.auth_method.password_hash = _hash_password(new_password)
    rt.used_at = datetime.utcnow()
    db.commit()
    return True, ""
