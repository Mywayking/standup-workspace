import os
import sqlite3
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime

from .config import settings

# Ensure data directory exists
DATA_DIR = Path("./data")
DATA_DIR.mkdir(exist_ok=True)

# Support both SQLite and PostgreSQL
if settings.database_url.startswith("sqlite"):
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(settings.database_url, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Models ───────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scripts = relationship("Script", back_populates="project", cascade="all, delete-orphan")


class Script(Base):
    __tablename__ = "scripts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    raw_text = Column(Text, nullable=False)
    cleaned_text = Column(Text, default="")
    actor_name = Column(String(255), default="")
    show_name = Column(String(255), default="")
    title = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="scripts")
    segments = relationship("Segment", back_populates="script", cascade="all, delete-orphan")
    report = relationship("ScriptReport", back_populates="script", uselist=False, cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    script_id = Column(Integer, ForeignKey("scripts.id"), nullable=False)
    index = Column(Integer, nullable=False)  # order within script
    raw_text = Column(Text, nullable=False)
    start_char = Column(Integer, default=0)
    end_char = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    script = relationship("Script", back_populates="segments")
    analysis = relationship("SegmentAnalysis", back_populates="segment", uselist=False, cascade="all, delete-orphan")


class SegmentAnalysis(Base):
    __tablename__ = "segment_analyses"

    id = Column(Integer, primary_key=True, index=True)
    segment_id = Column(Integer, ForeignKey("segments.id"), unique=True, nullable=False)

    # 结构标签
    structure = Column(String(50), default="")  # opening/p_setup/example/escalation/callback/closing
    structure_note = Column(Text, default="")

    # 态度标签
    attitude_object = Column(String(255), default="")  # 对什么
    attitude_type = Column(String(255), default="")    # 奇怪/愚蠢/可怕/难过/讽刺/自嘲
    attitude_insight = Column(Text, default="")       # 洞察

    # 技巧标签 (逗号分隔)
    techniques = Column(String(500), default="")  # analogy/comparison/result假设/cause假设/pun/irony/double_entendre
    technique_notes = Column(Text, default="")

    # 问题标签 (逗号分隔)
    problems = Column(String(500), default="")   # premise_missing/resonance_weak/only_anecdote/performance_dependent/no_insight
    problem_notes = Column(Text, default="")

    # 备注标签
    notes = Column(Text, default="")             # 可替换/可优化/可模仿
    notes_type = Column(String(100), default="") # replaceable/optimizable/imitatable

    # 启发
    inspiration = Column(Text, default="")

    # 分析文本
    analysis_text = Column(Text, default="")

    # 收藏
    starred = Column(Integer, default=0)  # 0/1

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    segment = relationship("Segment", back_populates="analysis")


class ScriptReport(Base):
    __tablename__ = "script_reports"

    id = Column(Integer, primary_key=True, index=True)
    script_id = Column(Integer, ForeignKey("scripts.id"), unique=True, nullable=False)

    summary = Column(Text, default="")       # 整篇总结
    strengths = Column(Text, default="")     # 强项
    weaknesses = Column(Text, default="")    # 弱项
    methodology = Column(Text, default="")   # 方法论总结
    key_insights = Column(Text, default="")   # 关键洞察
    overall_score = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    script = relationship("Script", back_populates="report")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, index=True)
    script_id = Column(Integer, ForeignKey("scripts.id"), nullable=False)
    status = Column(String(50), default="pending")  # pending/running/completed/failed
    step = Column(Integer, default=0)                # 1-7 current step
    step_name = Column(String(100), default="")
    progress = Column(Float, default=0.0)            # 0.0-1.0
    message = Column(String(500), default="")
    error = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    script = relationship("Script")


# ─── Session ───────────────────────────────────────────────────────────────────

class AnalysisFeedback(Base):
    __tablename__ = "analysis_feedback"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1=👍 0=👎
    feedback_text = Column(Text, default="")   # 可选，用户写的理由
    created_at = Column(DateTime, default=datetime.utcnow)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), nullable=False)           # e.g. v1, v2
    fragment_name = Column(String(200), nullable=False)    # e.g. "attitude_definition"
    old_content = Column(Text, default="")
    new_content = Column(Text, nullable=False)
    reason = Column(Text, default="")
    test_case_ids = Column(Text, default="")               # JSON array of script_ids used for testing
    old_avg_score = Column(Float, default=0.0)
    new_avg_score = Column(Float, default=0.0)
    improvement = Column(Float, default=0.0)              # new_avg - old_avg
    deployed_at = Column(DateTime, default=datetime.utcnow)
    rolled_back_at = Column(DateTime, nullable=True)
    is_active = Column(Integer, default=1)                 # 1=active, 0=rolled_back


class PromptFragment(Base):
    """Current active prompt fragments, keyed by section name."""
    __tablename__ = "prompt_fragments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)  # e.g. "attitude_definition"
    content = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(100), default="human")          # human or agent name


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Safe to call multiple times."""
    Base.metadata.create_all(bind=engine)


# ─── Init command helper ───────────────────────────────────────────────────────

def init_command():
    init_db()
    print("✅ Database initialized.")


if __name__ == "__main__":
    init_command()
