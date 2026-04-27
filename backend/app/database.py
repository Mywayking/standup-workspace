import os
import sqlite3
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, UniqueConstraint
from sqlalchemy.orm import sessionmaker, Session, relationship, declarative_base, backref
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

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
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


# ─── Auth Models ───────────────────────────────────────────────────────────────

class User(Base):
    """用户主表（方案 B user_id 用自增 id，与 ULID 并存）"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    ulid = Column(String(32), unique=True, nullable=False, index=True)  # 对外暴露的 ID
    nickname = Column(String(100), default="")
    avatar_url = Column(String(500), default="")
    status = Column(String(20), default="active")  # active / suspended
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    auth_methods = relationship("UserAuthMethod", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class UserAuthMethod(Base):
    """用户的认证方式（邮箱/手机号 + 密码）"""
    __tablename__ = "user_auth_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    auth_type = Column(String(20), nullable=False)  # email / phone
    auth_identifier = Column(String(255), nullable=False)  # 邮箱或手机号
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Integer, default=0)  # V1 默认 false
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="auth_methods")

    __table_args__ = (
        # 同一 auth_identifier 全局唯一
        UniqueConstraint(auth_type, auth_identifier, name="uq_auth_type_identifier"),
    )


class PasswordResetToken(Base):
    """密码重置令牌"""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    auth_method_id = Column(Integer, ForeignKey("user_auth_methods.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expired_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reset_tokens")
    auth_method = relationship("UserAuthMethod")


class AuthSession(Base):
    """Session 存储（SQLite 版，省去 Redis 依赖）"""
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    expired_at = Column(DateTime, nullable=False)

    user = relationship("User")


class UserProfile(Base):
    """用户展示资料"""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    display_name = Column(String(100), default="")
    username = Column(String(50), unique=True, nullable=True)  # @xxx，全局唯一
    avatar_url = Column(String(500), default="")
    bio = Column(Text, default="")
    role = Column(String(20), default="creator")  # creator / pro / admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref=backref("profile", uselist=False))


class CreatorProfile(Base):
    """创作者偏好"""
    __tablename__ = "creator_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    creator_type = Column(String(20), default="新人")
    topics = Column(JSON, default=list)
    humor_styles = Column(JSON, default=list)
    stage_experience = Column(String(20), default="开放麦")
    preferred_output = Column(String(20), default="文本")
    avoid_topics = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 确保 UserModelConfig 表被创建（延迟导入避免循环）
from .models.user_model_config import UserModelConfig  # noqa: F401


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
