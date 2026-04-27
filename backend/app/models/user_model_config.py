"""用户自定义模型配置（API Key）"""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, UniqueConstraint

from ..database import Base


class UserModelConfig(Base):
    """用户自定义 AI 模型配置"""
    __tablename__ = "user_model_configs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(32), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # zhipu, moonshot, minimax, deepseek, openai_compatible
    model = Column(String(100), nullable=False)
    base_url = Column(String(500))
    api_key_encrypted = Column(Text)  # 加密存储，绝不明文
    api_key_last4 = Column(String(20))  # 脱敏展示：sk-****abcd
    enabled = Column(Boolean, default=True)
    fallback_to_system = Column(Boolean, default=True)
    last_test_status = Column(String(20))  # success, failed
    last_test_error = Column(Text)
    last_test_latency_ms = Column(Integer)
    last_test_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_model_config_user_provider"),
    )