import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, Integer, JSON, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class WorkflowSession(Base):
    """工作流会话（登录用户云端版本）"""
    __tablename__ = "workflow_sessions"

    id = Column(String(64), primary_key=True, default=lambda: f"session-{uuid.uuid4().hex}")
    user_id = Column(String(128), nullable=False, index=True)
    title = Column(String(500), nullable=False, default="新会话")
    source_input = Column(Text, default="")
    status = Column(String(20), nullable=False, default="active")  # active / archived
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cards = relationship(
        "WorkflowCard",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="WorkflowCard.created_at",
    )


class WorkflowCard(Base):
    """工作流卡片（登录用户云端版本）"""
    __tablename__ = "workflow_cards"

    id = Column(String(64), primary_key=True, default=lambda: f"card-{uuid.uuid4().hex}")
    session_id = Column(String(64), ForeignKey("workflow_sessions.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)  # source/premise/angles/rewrite/stage_version
    title = Column(String(500), nullable=False)
    content = Column(Text, default="")
    summary = Column(Text, default="")
    raw_data = Column(JSON, default=dict)
    source_step = Column(String(50), nullable=True)
    source_card_id = Column(String(64), nullable=True)
    source_chain = Column(JSON, default=list)
    model = Column(String(100), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("WorkflowSession", back_populates="cards")
