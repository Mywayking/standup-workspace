import logging
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict
import dotenv

# Load .env from current working directory (where uvicorn starts: /root/standup-workspace/backend)
dotenv.load_dotenv()

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="forbid")

    database_url: str = "sqlite:///./data/standup.db"
    redis_url: str = "redis://localhost:6379/0"
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.chat"
    s3_bucket: str = "standup-exports"
    s3_endpoint: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    cors_origins: list[str] = ["http://localhost:3000"]
    deepseek_api_key: str = ""
    tokenhub_api_key: str = ""
    kb_dir: str = "/var/www/alwayshaha/comedy-kb/data"
    glm5_api_key: str = ""
    llm_fallback_models: str = "deepseek-chat,minimax-m2.7,kimi-k2.6,glm-5"
    llm_single_timeout_seconds: float = 60.0
    llm_total_timeout_seconds: float = 70.0
    llm_stream_first_chunk_timeout: float = 12.0

    # Cookie settings
    ENV: str = "development"
    COOKIE_SECURE: bool | None = None
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() in {"prod", "production"}

    def model_post_init(self, __context: Any) -> None:
        """Called after Pydantic validates all fields. Use for runtime checks."""
        logger.info(
            "[config] LLM config loaded",
            extra={
                "struct": {
                    "event": "config_loaded",
                    "llm_fallback_models": self.llm_fallback_models,
                    "llm_single_timeout_seconds": self.llm_single_timeout_seconds,
                    "llm_total_timeout_seconds": self.llm_total_timeout_seconds,
                    "llm_stream_first_chunk_timeout": self.llm_stream_first_chunk_timeout,
                    "providers_configured": {
                        "tokenhub": bool(self.tokenhub_api_key),
                        "deepseek": bool(self.deepseek_api_key),
                        "minimax": bool(self.minimax_api_key),
                        "glm5": bool(self.glm5_api_key),
                    },
                }
            },
        )
        # Validate timeout hierarchy
        if self.llm_single_timeout_seconds >= self.llm_total_timeout_seconds:
            logger.warning(
                "[config] llm_single_timeout_seconds (%.1f) >= llm_total_timeout_seconds (%.1f). "
                "Single timeout should be less than total.",
                self.llm_single_timeout_seconds,
                self.llm_total_timeout_seconds,
            )


settings = Settings()
