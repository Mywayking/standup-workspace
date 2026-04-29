"""
创作会话云端 API — /api/write/sessions
基于已有的 workflow_sessions 表，支持云端同步
"""
import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, User
from ..models.workflow import WorkflowSession, WorkflowCard
from ..services.session import get_user_id_from_session

router = APIRouter(prefix="/api/write/sessions", tags=["write-sessions"])

COOKIE_NAME = "session_id"


# ─── Auth Helper ───────────────────────────────────────────────────────────────

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


# ─── Schemas ───────────────────────────────────────────────────────────────────

class CreateSessionReq(BaseModel):
    title: str = "新会话"
    source_input: str = ""
    input_type: Optional[str] = None
    current_step: Optional[str] = None
    script_status: str = "idea"
    save_status: str = "saved_local"


class UpdateSessionReq(BaseModel):
    title: Optional[str] = None
    current_step: Optional[str] = None
    script_status: Optional[str] = None
    save_status: Optional[str] = None
    sync_status: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    title: str
    source_input: str
    input_type: Optional[str]
    current_step: Optional[str]
    script_status: str
    save_status: str
    sync_status: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def _dt_to_iso(dt) -> str:
    if dt is None:
        return datetime.utcnow().isoformat()
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def _session_to_dict(s: WorkflowSession) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "source_input": s.source_input or "",
        "input_type": s.input_type,
        "current_step": s.current_step,
        "script_status": s.script_status,
        "save_status": s.save_status,
        "sync_status": s.sync_status,
        "created_at": _dt_to_iso(s.created_at),
        "updated_at": _dt_to_iso(s.updated_at),
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
):
    """列出当前用户所有 session"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    sessions = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.user_id == user_id)
        .order_by(WorkflowSession.updated_at.desc())
        .all()
    )
    return {"sessions": [_session_to_dict(s) for s in sessions]}


@router.post("")
def create_session(
    req: CreateSessionReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """创建新 session"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    session = WorkflowSession(
        id=f"session-{uuid.uuid4().hex[:16]}",
        user_id=user_id,
        title=req.title,
        source_input=req.source_input,
        input_type=req.input_type,
        current_step=req.current_step,
        script_status=req.script_status,
        save_status=req.save_status,
        sync_status="synced",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.get("/{session_id}")
def get_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """获取单个 session"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    session = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.id == session_id, WorkflowSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")
    return _session_to_dict(session)


@router.put("/{session_id}")
def update_session(
    session_id: str,
    req: UpdateSessionReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """更新 session"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    session = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.id == session_id, WorkflowSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")
    if req.title is not None:
        session.title = req.title
    if req.current_step is not None:
        session.current_step = req.current_step
    if req.script_status is not None:
        session.script_status = req.script_status
    if req.save_status is not None:
        session.save_status = req.save_status
    if req.sync_status is not None:
        session.sync_status = req.sync_status
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """删除 session"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    session = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.id == session_id, WorkflowSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}
