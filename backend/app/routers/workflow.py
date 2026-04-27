import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.workflow import WorkflowSession, WorkflowCard


router = APIRouter(prefix="/api/workflow-sessions", tags=["workflow"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CardSchema(BaseModel):
    id: str
    type: str
    title: str
    content: str = ""
    summary: str = ""
    raw_data: dict = Field(default_factory=dict)
    source_step: str | None = None
    source_card_id: str | None = None
    source_chain: list = Field(default_factory=list)
    model: str | None = None
    latency_ms: int | None = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SessionSchema(BaseModel):
    id: str
    user_id: str
    title: str
    source_input: str = ""
    status: str = "active"
    cards: list[CardSchema] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class CreateSessionRequest(BaseModel):
    user_id: str
    title: str = "新会话"
    source_input: str = ""


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    status: str | None = None


class AddCardRequest(BaseModel):
    card: CardSchema


class UpdateCardRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    raw_data: dict | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _to_iso(dt) -> str:
    if dt is None:
        return datetime.utcnow().isoformat()
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def _session_to_dict(s: WorkflowSession) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "title": s.title,
        "source_input": s.source_input or "",
        "status": s.status,
        "cards": [
            {
                "id": c.id,
                "type": c.type,
                "title": c.title,
                "content": c.content or "",
                "summary": c.summary or "",
                "raw_data": c.raw_data or {},
                "source_step": c.source_step,
                "source_card_id": c.source_card_id,
                "source_chain": c.source_chain or [],
                "model": c.model,
                "latency_ms": c.latency_ms,
                "created_at": _to_iso(c.created_at),
                "updated_at": _to_iso(c.updated_at),
            }
            for c in s.cards
        ],
        "created_at": _to_iso(s.created_at),
        "updated_at": _to_iso(s.updated_at),
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
def list_sessions(
    user_id: Annotated[str, Query(...)],
    db: Session = Depends(get_db),
):
    """获取用户所有会话（按 updated_at 倒序）"""
    sessions = (
        db.query(WorkflowSession)
        .filter(WorkflowSession.user_id == user_id)
        .order_by(WorkflowSession.updated_at.desc())
        .all()
    )
    return [_session_to_dict(s) for s in sessions]


@router.post("")
def create_session(
    req: CreateSessionRequest,
    db: Session = Depends(get_db),
):
    """创建新会话"""
    session = WorkflowSession(
        id=f"session-{uuid.uuid4().hex[:16]}",
        user_id=req.user_id,
        title=req.title,
        source_input=req.source_input,
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.get("/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    """获取单个会话（含所有卡片）"""
    session = db.query(WorkflowSession).filter(WorkflowSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_to_dict(session)


@router.put("/{session_id}")
def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    db: Session = Depends(get_db),
):
    """更新会话（标题或状态）"""
    session = db.query(WorkflowSession).filter(WorkflowSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if req.title is not None:
        session.title = req.title
    if req.status is not None:
        session.status = req.status
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    """删除会话（级联删除卡片）"""
    session = db.query(WorkflowSession).filter(WorkflowSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"ok": True}


@router.post("/{session_id}/cards")
def add_card(
    session_id: str,
    req: AddCardRequest,
    db: Session = Depends(get_db),
):
    """为会话添加卡片"""
    session = db.query(WorkflowSession).filter(WorkflowSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    card = WorkflowCard(
        id=req.card.id or f"card-{uuid.uuid4().hex[:16]}",
        session_id=session_id,
        type=req.card.type,
        title=req.card.title,
        content=req.card.content,
        summary=req.card.summary,
        raw_data=req.card.raw_data,
        source_step=req.card.source_step,
        source_card_id=req.card.source_card_id,
        source_chain=req.card.source_chain,
        model=req.card.model,
        latency_ms=req.card.latency_ms,
    )
    session.updated_at = datetime.utcnow()
    db.add(card)
    db.commit()
    db.refresh(card)
    return {
        "id": card.id,
        "created_at": _to_iso(card.created_at),
        "updated_at": _to_iso(card.updated_at),
    }


@router.put("/{session_id}/cards/{card_id}")
def update_card(
    session_id: str,
    card_id: str,
    req: UpdateCardRequest,
    db: Session = Depends(get_db),
):
    """更新卡片"""
    card = (
        db.query(WorkflowCard)
        .filter(WorkflowCard.id == card_id, WorkflowCard.session_id == session_id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if req.title is not None:
        card.title = req.title
    if req.content is not None:
        card.content = req.content
    if req.summary is not None:
        card.summary = req.summary
    if req.raw_data is not None:
        card.raw_data = req.raw_data
    card.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/{session_id}/cards/{card_id}")
def delete_card(
    session_id: str,
    card_id: str,
    db: Session = Depends(get_db),
):
    """删除卡片"""
    card = (
        db.query(WorkflowCard)
        .filter(WorkflowCard.id == card_id, WorkflowCard.session_id == session_id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"ok": True}
