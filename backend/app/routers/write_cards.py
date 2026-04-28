"""
创作卡片云端 API — /api/write/sessions/:session_id/cards, /api/write/cards/:id
基于已有的 workflow_cards 表，支持云端同步
"""
import uuid
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, User
from ..models.workflow import WorkflowSession, WorkflowCard
from ..services.session import get_user_id_from_session

router = APIRouter(prefix="/api/write", tags=["write-cards"])

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


def _dt_to_iso(dt) -> str:
    if dt is None:
        return datetime.utcnow().isoformat()
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


# ─── Schemas ───────────────────────────────────────────────────────────────────

class CreateCardReq(BaseModel):
    id: Optional[str] = None
    session_id: str
    parent_id: Optional[str] = None
    type: str
    title: str
    content: str = ""
    structured_data: Optional[str] = None
    source_path: Optional[str] = None
    is_selected: int = 0
    is_mainline: int = 1
    version: int = 1
    model: Optional[str] = None
    provider: Optional[str] = None
    latency_ms: Optional[int] = None
    token_usage: Optional[str] = None


class UpdateCardReq(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_selected: Optional[int] = None
    is_mainline: Optional[int] = None
    version: Optional[int] = None
    structured_data: Optional[str] = None


def _card_to_dict(c: WorkflowCard) -> dict:
    return {
        "id": c.id,
        "session_id": c.session_id,
        "parent_id": c.parent_id,
        "type": c.type,
        "title": c.title,
        "content": c.content or "",
        "structured_data": c.raw_data,
        "source_path": c.source_chain,
        "is_selected": c.is_selected,
        "is_mainline": c.is_mainline,
        "version": c.version,
        "model": c.model,
        "provider": c.provider,
        "latency_ms": c.latency_ms,
        "token_usage": c.token_usage,
        "created_at": _dt_to_iso(c.created_at),
        "updated_at": _dt_to_iso(c.updated_at),
    }


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _get_session_for_user(session_id: str, user_id: str, db: Session) -> WorkflowSession:
    """Verify session belongs to user."""
    session = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.id == session_id, WorkflowSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Session not found")
    return session


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/cards")
def list_cards(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """列出某 session 所有 cards"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    _get_session_for_user(session_id, user_id, db)
    cards = (
        db.query(WorkflowCard)
        .filter(WorkflowCard.session_id == session_id)
        .order_by(WorkflowCard.created_at)
        .all()
    )
    return {"cards": [_card_to_dict(c) for c in cards]}


@router.post("/sessions/{session_id}/cards")
def create_card(
    session_id: str,
    req: CreateCardReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """创建 card"""
    user = _get_user(request, db)
    user_id = str(user.ulid)
    _get_session_for_user(session_id, user_id, db)

    card = WorkflowCard(
        id=req.id or f"card-{uuid.uuid4().hex[:16]}",
        session_id=session_id,
        parent_id=req.parent_id,
        type=req.type,
        title=req.title,
        content=req.content,
        raw_data=json.loads(req.structured_data) if req.structured_data else {},
        source_chain=json.loads(req.source_path) if req.source_path else [],
        is_selected=req.is_selected,
        is_mainline=req.is_mainline,
        version=req.version,
        model=req.model,
        provider=req.provider,
        latency_ms=req.latency_ms,
        token_usage=req.token_usage,
    )
    db.add(card)
    # Update session updated_at
    session = db.query(WorkflowSession).filter(WorkflowSession.id == session_id).first()
    if session:
        session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)


@router.put("/cards/{card_id}")
def update_card(
    card_id: str,
    req: UpdateCardReq,
    request: Request,
    db: Session = Depends(get_db),
):
    """更新 card（content、is_selected 等）"""
    user = _get_user(request, db)
    user_id = str(user.ulid)

    card = db.query(WorkflowCard).filter(WorkflowCard.id == card_id).first()
    if not card:
        raise HTTPException(404, "Card not found")

    # Verify ownership via session
    _get_session_for_user(card.session_id, user_id, db)

    if req.title is not None:
        card.title = req.title
    if req.content is not None:
        card.content = req.content
    if req.is_selected is not None:
        card.is_selected = req.is_selected
    if req.is_mainline is not None:
        card.is_mainline = req.is_mainline
    if req.version is not None:
        card.version = req.version
    if req.structured_data is not None:
        card.raw_data = json.loads(req.structured_data) if req.structured_data else {}
    card.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(card)
    return _card_to_dict(card)


@router.delete("/cards/{card_id}")
def delete_card(
    card_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """删除 card"""
    user = _get_user(request, db)
    user_id = str(user.ulid)

    card = db.query(WorkflowCard).filter(WorkflowCard.id == card_id).first()
    if not card:
        raise HTTPException(404, "Card not found")

    # Verify ownership via session
    _get_session_for_user(card.session_id, user_id, db)

    db.delete(card)
    db.commit()
    return {"ok": True}
