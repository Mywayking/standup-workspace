"""
Session 管理（Redis 版）
- 创建 / 读取 / 删除 session
- 支持滑动续期
"""
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis

from ..config import settings

_redis: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


SESSION_TTL_DAYS = 7
SESSION_PREFIX = "session:"
SESSION_ID_BYTES = 32  # 256-bit random session ID


def create_session(user_id: int) -> str:
    """创建新 session，返回 session_id（随机 token）"""
    session_id = secrets.token_urlsafe(SESSION_ID_BYTES)
    key = f"{SESSION_PREFIX}{session_id}"
    now = datetime.now(timezone.utc).isoformat()
    data = {
        "user_id": user_id,
        "created_at": now,
        "last_seen_at": now,
    }
    get_redis().setex(key, timedelta(days=SESSION_TTL_DAYS), json.dumps(data))
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """
    读取 session 数据，同时刷新 TTL（滑动续期）。
    返回 None 表示 session 不存在或已过期。
    """
    if not session_id:
        return None
    key = f"{SESSION_PREFIX}{session_id}"
    r = get_redis()
    data = r.get(key)
    if data is None:
        return None
    # 滑动续期
    r.expire(key, timedelta(days=SESSION_TTL_DAYS))
    return json.loads(data)


def delete_session(session_id: str) -> None:
    """删除 session（退出登录）"""
    if not session_id:
        return
    get_redis().delete(f"{SESSION_PREFIX}{session_id}")


def get_user_id_from_session(session_id: str) -> Optional[int]:
    """从 session_id 获取 user_id"""
    sess = get_session(session_id)
    return sess["user_id"] if sess else None
