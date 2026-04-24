"""
流式 LLM Gateway - SSE 多模型回退（支持多 Provider）
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
from .provider import LLMProvider


logger = logging.getLogger(__name__)


class StreamGateway:
    """
    流式 LLM 调用网关
    - 支持多 Provider（TokenHub / BigModel / DeepSeek）
    - 优先尝试流式，yield token 事件
    - 流式完成后 yield done 事件（含解析后的 JSON 结果）
    - 流式失败自动尝试非流式 fallback
    - 所有模型失败后 yield event:error
    """

    def __init__(self, api_keys: dict):
        self.provider = LLMProvider(api_keys)
        self._default_models = [m.strip() for m in settings.llm_fallback_models.split(",")]
        self._single_timeout = settings.llm_single_timeout_seconds
        self._first_chunk_timeout = settings.llm_stream_first_chunk_timeout

    def _stream_models(self, request: LLMRequest) -> list[str]:
        return request.candidate_models or self._default_models

    async def generate(
        self, request: LLMRequest
    ) -> AsyncGenerator[str, None]:
        """
        异步流式生成。
        Yeilds SSE 事件串：
          event: token  → 流式 token（前端逐字显示）
          event: done   → 成功完成（含完整结果 JSON）
          event: error  → 当前模型失败（自动切下一模型）
          event: meta   → 最终元信息（selected_model / latency）
        所有模型失败 → 最后 yield event:error（retryable=true）
        """
        models = self._stream_models(request)
        attempts: list[ModelAttempt] = []
        start_time = time.time()
        total_deadline = start_time + settings.llm_total_timeout_seconds
        request_id = request.request_id or "unknown"
        scene = request.scene
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        llm_logger.log_start(
            f"stream_gateway_{scene}",
            model=models[0] if models else "unknown",
            provider=self.provider.get_provider_name(models[0]) if models else "tokenhub",
            extra={"scene": scene, "models": models, "request_id": request_id},
        )

        for i, model in enumerate(models):
            # Enforce total timeout across all model attempts
            if time.time() >= total_deadline:
                total_latency = int((time.time() - start_time) * 1000)
                llm_logger.log_done(
                    f"stream_gateway_{scene}",
                    total_latency,
                    error_code="TOTAL_TIMEOUT",
                    retryable=True,
                )
                yield f"event: error\ndata: " + json.dumps({
                    "type": "error",
                    "error": "总超时时间已到，所有模型均未完成",
                    "error_code": "TOTAL_TIMEOUT",
                    "retryable": True,
                    "_meta": {
                        "provider": "multi",
                        "model": models[-1] if models else "unknown",
                        "total_latency_ms": total_latency,
                    },
                }) + "\n\n"
                return

            attempt_start = time.time()
            model_provider = self.provider.get_provider_name(model)
            token_buffer: list[str] = []

            try:
                # Try stream first — yields token/error events, fills token_buffer
                async for chunk in self._stream_one(model, messages, request.temperature, request_id, token_buffer):
                    yield chunk

                # Stream finished without raising — parse result and emit done
                latency_ms = int((time.time() - attempt_start) * 1000)
                total_latency = int((time.time() - start_time) * 1000)
                content_str = "".join(token_buffer)

                # Parse accumulated content as JSON
                try:
                    result_dict = json.loads(content_str) if content_str else {}
                except json.JSONDecodeError:
                    result_dict = {"text": content_str, "_raw": True} if content_str else {}

                attempts.append(ModelAttempt(
                    model=model, status="success", latency_ms=latency_ms,
                ))
                llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                yield f"event: done\ndata: " + json.dumps({
                    "type": "done",
                    "result": result_dict,
                    "_meta": {
                        "provider": model_provider,
                        "model": model,
                        "latency_ms": latency_ms,
                        "total_latency_ms": total_latency,
                        "attempt": i + 1,
                        "mode": "stream",
                        "scene": scene,
                    },
                }) + "\n\n"
                yield f"event: meta\ndata: " + json.dumps({
                    "type": "meta",
                    "selected_model": model,
                    "provider": model_provider,
                    "request_id": request_id,
                    "attempt_count": i + 1,
                    "total_latency_ms": total_latency,
                    "scene": scene,
                }) + "\n\n"
                return

            except StopAsyncIteration:
                # Stream ended (non-200 error was already yielded), try next model
                pass

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
                    total_latency = int((time.time() - start_time) * 1000)
                    yield f"event: error\ndata: " + json.dumps({
                        "type": "error",
                        "error": f"模型请求失败：HTTP {e.code}",
                        "error_code": str(e.code) if e.code else "HTTP_ERROR",
                        "retryable": False,
                        "_meta": {
                            "provider": model_provider, "model": model,
                            "latency_ms": latency_ms, "total_latency_ms": total_latency,
                            "attempt": i + 1,
                        },
                    }) + "\n\n"
                    continue

                # Retryable: try non-stream fallback
                if is_timeout or is_http or isinstance(e, (LLMParseError, LLMEmptyError)):
                    attempts.append(ModelAttempt(
                        model=model,
                        status="timeout" if is_timeout else ("rate_limited" if isinstance(e, LLMHTTPError) and e.code == "RATE_LIMITED" else "failed"),
                        latency_ms=latency_ms,
                        error_code=getattr(e, 'code', 'UNKNOWN'),
                        error_message=error_str,
                    ))
                    try:
                        yield f"event: progress\ndata: " + json.dumps({
                            "type": "progress",
                            "phase": "fallback",
                            "message": f"stream failed, trying non-stream ({model})...",
                            "model": model, "attempt": i + 1, "request_id": request_id,
                        }) + "\n\n"
                        result_content, result_latency = await self._call_non_stream(
                            model, messages, request.temperature
                        )
                        total_latency = int((time.time() - start_time) * 1000)
                        attempts.append(ModelAttempt(
                            model=model, status="success", latency_ms=result_latency,
                        ))
                        llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                        yield f"event: done\ndata: " + json.dumps({
                            "type": "done",
                            "result": result_content,
                            "_meta": {
                                "provider": model_provider, "model": model,
                                "latency_ms": result_latency, "total_latency_ms": total_latency,
                                "attempt": i + 1, "fallback": "non-stream",
                                "scene": scene,
                            },
                        }) + "\n\n"
                        yield f"event: meta\ndata: " + json.dumps({
                            "type": "meta",
                            "selected_model": model,
                            "provider": model_provider,
                            "request_id": request_id, "attempt_count": i + 1,
                            "total_latency_ms": total_latency,
                            "scene": scene,
                        }) + "\n\n"
                        return
                    except Exception as non_stream_err:
                        ns_err_str = str(non_stream_err)
                        ns_is_timeout = "timeout" in ns_err_str.lower() or isinstance(non_stream_err, LLMTimeoutError)
                        ns_latency_ms = int((time.time() - attempt_start) * 1000)
                        attempts.append(ModelAttempt(
                            model=model, status="timeout" if ns_is_timeout else "failed",
                            latency_ms=ns_latency_ms,
                            error_code="NON_STREAM_FAILED", error_message=ns_err_str,
                        ))
                        total_latency = int((time.time() - start_time) * 1000)
                        yield f"event: error\ndata: " + json.dumps({
                            "type": "error",
                            "error": f"模型 {model} 调用失败：{ns_err_str[:100]}",
                            "error_code": "NON_STREAM_FAILED",
                            "retryable": True,
                            "_meta": {
                                "provider": model_provider, "model": model,
                                "latency_ms": ns_latency_ms, "total_latency_ms": total_latency,
                                "attempt": i + 1,
                            },
                        }) + "\n\n"
                        continue
                else:
                    attempts.append(ModelAttempt(
                        model=model, status="failed", latency_ms=latency_ms,
                        error_code="UNKNOWN", error_message=error_str,
                    ))
                    total_latency = int((time.time() - start_time) * 1000)
                    yield f"event: error\ndata: " + json.dumps({
                        "type": "error",
                        "error": f"未知错误：{error_str[:100]}",
                        "error_code": "UNKNOWN",
                        "retryable": True,
                        "_meta": {
                            "provider": model_provider, "model": model,
                            "latency_ms": latency_ms, "total_latency_ms": total_latency,
                            "attempt": i + 1,
                        },
                    }) + "\n\n"
                    continue

        # All models failed
        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"stream_gateway_{scene}", total_latency, error_code="ALL_FAILED", retryable=True)
        yield f"event: error\ndata: " + json.dumps({
            "type": "error",
            "error": "所有模型均失败，请稍后重试",
            "error_code": "ALL_FAILED",
            "retryable": True,
            "_meta": {
                "provider": "multi", "model": models[-1] if models else "unknown",
                "total_latency_ms": total_latency,
            },
        }) + "\n\n"

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _stream_one(
        self, model: str, messages: list[dict], temperature: float,
        request_id: str, token_buffer: list[str],
    ) -> AsyncGenerator[str, None]:
        """
        对单个模型尝试流式调用。
        - token 事件 → yield 出去（同时追加到 token_buffer）
        - non-200 响应 → yield error 事件，然后 raise StopAsyncIteration（通知 caller 切模型）
        - timeout → yield error 事件，raise LLMTimeoutError
        """
        base_url, api_key = self.provider._resolve(model)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self._first_chunk_timeout)) as client:
                async with client.stream(
                    "POST", base_url, json=payload, headers=headers
                ) as resp:
                    if resp.status_code != 200:
                        body_bytes = await resp.aread()
                        body = body_bytes.decode("utf-8", errors="ignore")[:500]
                        model_provider = self.provider.get_provider_name(model)
                        logger.warning(
                            "[_stream_one] provider=%s model=%s non-200 status=%s body=%s",
                            model_provider, model, resp.status_code, body,
                        )
                        yield f"event: error\ndata: " + json.dumps({
                            "type": "error",
                            "error": f"模型请求失败：HTTP {resp.status_code}",
                            "error_code": str(resp.status_code),
                            "retryable": True,
                            "_meta": {"provider": model_provider, "model": model},
                        }) + "\n\n"
                        # Signal caller to try next model
                        raise StopAsyncIteration()

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
                                token_buffer.append(token)
                                safe = (token
                                    .replace("\\", "\\\\")
                                    .replace("\n", "\\n")
                                    .replace("\r", "\\r"))
                                yield f"event: token\ndata: " + json.dumps({"type": "token", "content": token}) + "\n\n"
                        except Exception:
                            pass

        except httpx.TimeoutException as e:
            model_provider = self.provider.get_provider_name(model)
            logger.warning("[_stream_one] provider=%s model=%s timeout", model_provider, model)
            yield f"event: error\ndata: " + json.dumps({
                "type": "error",
                "error": "模型响应超时，请重试或稍后再试",
                "error_code": "TIMEOUT",
                "retryable": True,
                "_meta": {"provider": model_provider, "model": model},
            }) + "\n\n"
            raise LLMTimeoutError(f"Stream timeout for model {model}") from e

    async def _call_non_stream(
        self, model: str, messages: list[dict], temperature: float
    ) -> tuple[dict, int]:
        """异步调用单模型（非流式），返回 (content_dict, latency_ms)"""
        start = time.time()
        base_url, api_key = self.provider._resolve(model)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(self._single_timeout)) as client:
            resp = await client.post(base_url, json=payload, headers=headers)

        latency_ms = int((time.time() - start) * 1000)
        if resp.status_code != 200:
            body = resp.text[:200]
            raise LLMHTTPError(resp.status_code, body)

        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise LLMEmptyError(model)

        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise LLMEmptyError(model)

        try:
            content_dict = json.loads(content)
        except json.JSONDecodeError:
            content_dict = {"text": content, "_raw": True}

        return content_dict, latency_ms


# ── Module-level singleton ─────────────────────────────────────────────────────

def _build_api_keys() -> dict:
    return {
        "tokenhub_api_key": settings.tokenhub_api_key,
        "glm5_api_key": settings.glm5_api_key,
        "deepseek_api_key": settings.deepseek_api_key,
        "minimax_api_key": settings.minimax_api_key,
    }


_stream_gateway: StreamGateway | None = None


def get_stream_gateway() -> StreamGateway:
    global _stream_gateway
    if _stream_gateway is None:
        _stream_gateway = StreamGateway(_build_api_keys())
    return _stream_gateway
