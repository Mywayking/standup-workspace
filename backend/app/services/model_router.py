"""
model_router.py — 多模型降级流式 API 封装
优先 DeepSeek，失败时降级到 GLM-5（通过 StreamGateway）
"""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator, Literal

from ..config import settings
from ..llm import get_stream_gateway, LLMRequest, LLMMessage
from ..utils.logging import llm_logger
from .llm_client import get_llm_client, get_fallback_client
from .prompt_builder import build_prompt, build_user_message

logger = logging.getLogger(__name__)


# ─── Chunk 类型 ────────────────────────────────────────────────

@dataclass
class ModelChunk:
    """流式输出单元"""
    type: Literal["token", "done", "error", "meta"]  # noqa: F811
    text: str = ""           # token / error 内容
    meta: dict = field(default_factory=dict)

    @property
    def content(self) -> str:
        """兼容 SSE data 字段"""
        return self.text


# ─── 公开 API ──────────────────────────────────────────────────

async def stream_model(
    task_type: str,
    user_input: str,
    context: dict,
    user_style: dict,
    request_id: str,
    user_id: str | None = None,
) -> AsyncGenerator[ModelChunk, None]:
    """
    统一的写作任务流式接口。

    Args:
        task_type: 任务类型 (premise|angles|draft|rewrite|...)
        user_input: 用户输入文本
        context:    上下文（前提、角度、上版草稿等）
        user_style: 用户风格偏好
        request_id: 请求 ID
        user_id:    用户 ID（可选，用于用户自定义模型）

    Yields:
        ModelChunk — type=token/done/error/meta
    """
    from ..llm.user_model_resolver import resolve_user_model_runtime

    scene = f"task_{task_type}"
    user_runtime = resolve_user_model_runtime(user_id) if user_id else None

    system_prompt = build_prompt(task_type, user_input, context, user_style, {})
    user_message = build_user_message(task_type, user_input, context)

    gateway = get_stream_gateway(user_model_runtime=user_runtime)
    start_time = time.time()

    llm_logger.log_start(
        f"model_router_{scene}",
        model="auto",
        provider="multi",
        extra={
            "task_type": task_type,
            "request_id": request_id,
            "user_id": user_id,
        },
    )

    total_tokens = 0
    used_provider = "unknown"
    used_model = "unknown"
    final_result = ""
    error_code = None
    retry_count = 0

    try:
        async for raw_event in gateway.generate(LLMRequest(
            scene=scene,
            messages=[
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_message),
            ],
            temperature=1.0,
            stream=True,
            request_id=request_id,
            user_id=user_id,
        )):
            chunk = _parse_sse_event(raw_event)
            if chunk is None:
                continue

            if chunk.type == "token":
                total_tokens += 1
                yield chunk
            elif chunk.type == "done":
                final_result = chunk.text
                used_provider = chunk.meta.get("provider", "unknown")
                used_model = chunk.meta.get("model", "unknown")
                error_code = None
                yield chunk
            elif chunk.type == "error":
                error_code = chunk.meta.get("error_code", "UNKNOWN")
                retry_count += 1
                yield chunk
            elif chunk.type == "meta":
                used_provider = chunk.meta.get("provider", used_provider)
                used_model = chunk.meta.get("model", used_model)
                yield chunk

    except Exception as e:
        error_code = "EXCEPTION"
        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"model_router_{scene}", total_latency, error_code=error_code)
        yield ModelChunk(
            type="error",
            text=f"内部错误：{str(e)}",
            meta={
                "error_code": error_code,
                "retryable": True,
                "total_latency_ms": total_latency,
            },
        )
        return

    total_latency = int((time.time() - start_time) * 1000)
    llm_logger.log_done(
        f"model_router_{scene}",
        total_latency,
        error_code=error_code,
        retryable=error_code in {"TIMEOUT", "RATE_LIMITED", "UPSTREAM_ERROR", "STREAM_FAILED"},
    )


# ─── SSE 解析 ──────────────────────────────────────────────────

def _parse_sse_event(raw: str) -> ModelChunk | None:
    """将 SSE 事件字符串解析为 ModelChunk"""
    raw = raw.strip()
    if not raw:
        return None

    # 解析 event: <type>
    event_type = "token"
    data_str = raw

    if raw.startswith("event:"):
        parts = raw.split("\n", 1)
        if len(parts) == 2:
            event_type = parts[0][6:].strip()
            data_str = parts[1]

    if not data_str.startswith("data:"):
        return None
    data_str = data_str[5:].strip()

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        logger.warning("[_parse_sse_event] JSON decode failed: %s", data_str[:100])
        return None

    t = data.get("type", event_type)

    if t == "token":
        return ModelChunk(
            type="token",
            text=data.get("content", ""),
            meta={"token_count": 1},
        )
    elif t == "done":
        return ModelChunk(
            type="done",
            text=data.get("result", ""),
            meta=data.get("_meta", {}),
        )
    elif t == "error":
        return ModelChunk(
            type="error",
            text=data.get("error", ""),
            meta=data.get("_meta", {}) or {},
        )
    elif t == "meta":
        return ModelChunk(
            type="meta",
            text="",
            meta=data,
        )
    elif t == "progress":
        return ModelChunk(
            type="meta",
            text=data.get("message", ""),
            meta={"attempt": data.get("attempt", 1)},
        )

    return None
