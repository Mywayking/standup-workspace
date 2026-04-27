"""
统一 LLM 请求/响应数据结构
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant"] = "user"
    content: str


class LLMRequest(BaseModel):
    """Gateway 层统一请求格式"""
    scene: str = Field(..., description="业务场景: extract_premise / find_angles / joke_to_premise / rewrite / analyze")
    messages: list[LLMMessage]
    temperature: float = 0.7
    stream: bool = False
    timeout_seconds: float = 25.0
    candidate_models: list[str] | None = None  # 覆盖默认模型链
    request_id: str = ""
    user_id: str | None = None  # 用于解析用户自定义模型配置


class ModelAttempt(BaseModel):
    """单次模型尝试记录"""
    model: str
    status: Literal["success", "timeout", "failed", "rate_limited"]
    latency_ms: int
    error_code: str | None = None
    error_message: str | None = None


class GatewayResult(BaseModel):
    """Gateway 层统一返回格式"""
    content: str | None = None  # non-stream 时填充
    error: str | None = None
    selected_model: str
    request_id: str
    attempt_count: int
    total_latency_ms: int
    attempts: list[ModelAttempt]
    # stream 时 content 为 None，最终结果通过 SSE events 传递


class LLMErrorCode:
    # 可回退
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    PARSE_FAILED = "PARSE_FAILED"
    STREAM_FAILED = "STREAM_FAILED"
    # 不回退
    AUTH_FAILED = "AUTH_FAILED"
    INVALID_REQUEST = "INVALID_REQUEST"
    CONTENT_EMPTY = "CONTENT_EMPTY"