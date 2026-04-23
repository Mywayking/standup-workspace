"""
流式 LLM Gateway - SSE 多模型回退
"""
import json
import time
import logging
from typing import AsyncGenerator

import httpx

from ..config import settings
from ..utils.logging import llm_logger
from .schemas import LLMRequest, ModelAttempt
from .errors import LLMTimeoutError, LLMHTTPError, LLMParseError, LLMEmptyError
from .provider import TokenHubProvider


logger = logging.getLogger(__name__)


class StreamGateway:
    """
    流式 LLM 调用网关
    - 优先尝试流式
    - 流式失败自动切换非流式
    - 非流式也失败则尝试下一个模型
    """

    BASE_URL = "https://tokenhub.tencentmaas.com/v1/chat/completions"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._default_models = [m.strip() for m in settings.llm_fallback_models.split(",")]
        self._single_timeout = settings.llm_single_timeout_seconds
        self._first_chunk_timeout = settings.llm_stream_first_chunk_timeout

    def _build_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _stream_models(self, request: LLMRequest) -> list[str]:
        return request.candidate_models or self._default_models

    async def generate(
        self, request: LLMRequest
    ) -> AsyncGenerator[str, None]:
        """
        异步流式生成。
        Yeilds SSE 字符串事件。
        最终 yield 一个 meta 事件包含 selected_model / latency_ms / attempt_count。
        """
        models = self._stream_models(request)
        attempts: list[ModelAttempt] = []
        start_time = time.time()
        request_id = request.request_id or "unknown"
        scene = request.scene
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        llm_logger.log_start(
            f"stream_gateway_{scene}",
            model=models[0] if models else "unknown",
            provider="tokenhub",
            extra={"scene": scene, "models": models, "request_id": request_id},
        )

        for i, model in enumerate(models):
            attempt_start = time.time()
            try:
                # Try stream first
                async for chunk in self._try_stream(model, messages, request.temperature, request_id):
                    yield chunk

                # Stream succeeded
                latency_ms = int((time.time() - attempt_start) * 1000)
                total_latency = int((time.time() - start_time) * 1000)
                attempts.append(ModelAttempt(
                    model=model, status="success", latency_ms=latency_ms,
                ))
                llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                yield f"event: meta\ndata: " + json.dumps({
                    "selected_model": model,
                    "request_id": request_id,
                    "attempt_count": i + 1,
                    "total_latency_ms": total_latency,
                }) + "\n\n"
                return

            except Exception as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                error_str = str(e)
                is_timeout = "timeout" in error_str.lower() or isinstance(e, LLMTimeoutError)
                is_http = isinstance(e, LLMHTTPError)

                if is_http and not e.retryable:
                    attempts.append(ModelAttempt(
                        model=model, status="failed", latency_ms=latency_ms,
                        error_code=e.code, error_message=error_str,
                    ))
                elif is_timeout or is_http or isinstance(e, (LLMParseError, LLMEmptyError)):
                    attempts.append(ModelAttempt(
                        model=model,
                        status="timeout" if is_timeout else ("rate_limited" if isinstance(e, LLMHTTPError) and e.code == "RATE_LIMITED" else "failed"),
                        latency_ms=latency_ms,
                        error_code=getattr(e, 'code', 'UNKNOWN'),
                        error_message=error_str,
                    ))
                else:
                    attempts.append(ModelAttempt(
                        model=model, status="failed", latency_ms=latency_ms,
                        error_code="UNKNOWN", error_message=error_str,
                    ))

                # Try non-stream fallback for this model
                try:
                    yield f"event: progress\ndata: " + json.dumps({
                        "status": f"stream failed, trying non-stream...",
                        "model": model,
                        "attempt": i + 1,
                        "request_id": request_id,
                    }) + "\n\n"
                    result_content, result_latency = await self._call_non_stream(
                        model, messages, request.temperature
                    )
                    # Non-stream succeeded
                    total_latency = int((time.time() - start_time) * 1000)
                    attempts.append(ModelAttempt(
                        model=model, status="success", latency_ms=result_latency,
                    ))
                    llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                    yield f"event: done\ndata: " + json.dumps(result_content) + "\n\n"
                    yield f"event: meta\ndata: " + json.dumps({
                        "selected_model": model,
                        "request_id": request_id,
                        "attempt_count": i + 1,
                        "total_latency_ms": total_latency,
                    }) + "\n\n"
                    return
                except Exception:
                    pass

        # All models failed
        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"stream_gateway_{scene}", total_latency, error_code="ALL_FAILED", retryable=True)
        yield f"event: error\ndata: " + json.dumps({
            "error": "所有模型均失败，请稍后重试",
            "request_id": request_id,
            "error_code": "ALL_FAILED",
            "retryable": True,
        }) + "\n\n"

    async def _try_stream(
        self, model: str, messages: list[dict], temperature: float, request_id: str
    ) -> AsyncGenerator[str, None]:
        """尝试流式调用，成功则 yield token，失败则抛出异常"""
        headers = self._build_headers()
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        json_dumps = json.dumps

        async with httpx.AsyncClient(timeout=httpx.Timeout(self._first_chunk_timeout)) as client:
            async with client.stream(
                "POST", self.BASE_URL, json=payload, headers=headers
            ) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode()[:200]
                    raise LLMHTTPError(resp.status_code, body)

                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        obj = json.loads(data_str)
                        token = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if token:
                            safe = token.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r")
                            yield f"event: token\ndata: " + safe + "\n\n"
                    except Exception:
                        pass

    async def _call_non_stream(
        self, model: str, messages: list[dict], temperature: float
    ) -> tuple[str, int]:
        """同步调用单模型（非流式），返回 (content, latency_ms)"""
        start = time.time()
        headers = self._build_headers()
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(self._single_timeout)) as client:
            resp = await client.post(self.BASE_URL, json=payload, headers=headers)

        latency_ms = int((time.time() - start) * 1000)
        if resp.status_code != 200:
            raise LLMHTTPError(resp.status_code, resp.text[:200])

        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise LLMEmptyError(model)

        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise LLMEmptyError(model)

        return content, latency_ms