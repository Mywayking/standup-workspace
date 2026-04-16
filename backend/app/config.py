import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/standup.db"
    redis_url: str = "redis://localhost:6379/0"
    minmax_api_key: str = ""
    minmax_base_url: str = "https://api.minimax.chat"
    s3_bucket: str = "standup-exports"
    s3_endpoint: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

# LLM providers
deepseek_api_key: str = ""
glm5_api_key: str = ""
