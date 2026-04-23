"""
LLM 层统一错误分类
"""
from typing import Optional


class LLMError(Exception):
    def __init__(self, message: str, code: str, retryable: bool = True, details: dict = None):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.details = details or {}


class LLMTimeoutError(LLMError):
    def __init__(self, model: str, latency_ms: int):
        super().__init__(
            f"{model} timeout after {latency_ms}ms",
            code="TIMEOUT",
            retryable=True,
            details={"model": model, "latency_ms": latency_ms},
        )


class LLMHTTPError(LLMError):
    def __init__(self, status_code: int, body: str = ""):
        code = "RATE_LIMITED" if status_code == 429 else "UPSTREAM_ERROR"
        super().__init__(
            f"HTTP {status_code}",
            code=code,
            retryable=True,
            details={"status_code": status_code, "body": body[:200]},
        )


class LLMParseError(LLMError):
    def __init__(self, raw: str = ""):
        super().__init__(
            "Failed to parse LLM response as JSON",
            code="PARSE_FAILED",
            retryable=True,
            details={"raw_preview": raw[:200]},
        )


class LLMEmptyError(LLMError):
    def __init__(self, model: str):
        super().__init__(
            f"{model} returned empty content",
            code="CONTENT_EMPTY",
            retryable=True,
            details={"model": model},
        )


class LLMAllModelsFailedError(LLMError):
    def __init__(self, attempts: list):
        super().__init__(
            "All models failed",
            code="ALL_FAILED",
            retryable=True,
            details={"attempts": [a.model_dump() for a in attempts]},
        )


def is_retryable(err: Exception) -> bool:
    if isinstance(err, LLMError):
        return err.retryable
    if "timeout" in str(err).lower():
        return True
    if isinstance(err, type(None)):
        return True  # network errors often come as NoneType
    return False