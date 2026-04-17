import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

import dotenv

# Load .env from current working directory (where uvicorn starts: /root/standup-workspace/backend)
dotenv.load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="allow")

    database_url: str = "sqlite:///./data/standup.db"
    redis_url: str = "redis://localhost:6379/0"
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.chat"
    s3_bucket: str = "standup-exports"
    s3_endpoint: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    cors_origins: list[str] = ["http://localhost:3000"]
    deepseek_api_key: str = ""
    kb_dir: str = "/var/www/alwayshaha/comedy-kb/data"
    glm5_api_key: str = ""


settings = Settings()
