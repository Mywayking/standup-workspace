"""
Session 管理（SQLite 版，依赖 AuthSession 表）
- 创建 / 读取 / 删除 session
- 支持滑动续期
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from ..database import AuthSession

SESSION_TTL_DAYS = 7
SESSION_ID_BYTES = 32  # 256-bit random


def create_session(user_id: int, db: DBSession) -> str:
    """创建新 session，返回 session_id（随机 token）"""
    session_id = secrets.token_urlsafe(SESSION_ID_BYTES)
    now = datetime.utcnow()
    session = AuthSession(
        session_id=session_id,
        user_id=user_id,
        created_at=now,
        last_seen_at=now,
        expired_at=now + timedelta(days=SESSION_TTL_DAYS),
    )
    db.add(session)
    db.commit()
    return session_id


def get_session(session_id: str, db: DBSession) -> Optional[dict]:
    """
    读取 session 数据，同时刷新 last_seen_at 和过期时间（滑动续期）。
    返回 None 表示 session 不存在或已过期。
    """
    if not session_id:
        return None
    session = db.query(AuthSession).filter(
        AuthSession.session_id == session_id,
        AuthSession.expired_at > datetime.utcnow(),
    ).first()
    if not session:
        return None
    # 滑动续期
    session.last_seen_at = datetime.utcnow()
    session.expired_at = datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS)
    db.commit()
    return {
        "user_id": session.user_id,
        "created_at": session.created_at.isoformat(),
        "last_seen_at": session.last_seen_at.isoformat(),
    }


def delete_session(session_id: str, db: DBSession) -> None:
    """删除 session（退出登录）"""
    if not session_id:
        return
    db.query(AuthSession).filter(AuthSession.session_id == session_id).delete()
    db.commit()


def get_user_id_from_session(session_id: str, db: DBSession) -> Optional[int]:
    """从 session_id 获取 user_id"""
    sess = get_session(session_id, db)
    return sess["user_id"] if sess else None


def cleanup_expired_sessions(db: DBSession) -> int:
    """清理过期 session（可定期调用）"""
    count = db.query(AuthSession).filter(
        AuthSession.expired_at < datetime.utcnow()
    ).delete()
    db.commit()
    return count
