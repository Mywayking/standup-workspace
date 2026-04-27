"""
流式 LLM Gateway - SSE 多模型回退（支持多 Provider + 用户自填 Key）
"""
import json
import time
import logging
from typing import AsyncGenerator

import httpx

from ..config import settings
from .parsers.json_repair import parse_json_safely
from ..utils.logging import llm_logger
from .schemas import LLMRequest, ModelAttempt
from .errors import LLMTimeoutError, LLMHTTPError, LLMParseError, LLMEmptyError
from .provider import LLMProvider

logger = logging.getLogger(__name__)


def _build_api_keys() -> dict:
    return {
        "tokenhub_api_key": settings.tokenhub_api_key,
        "glm5_api_key": settings.glm5_api_key,
        "deepseek_api_key": settings.deepseek_api_key,
        "minimax_api_key": settings.minimax_api_key,
    }


class StreamGateway:
    """
    流式 LLM 调用网关
    - 支持多 Provider（TokenHub / BigModel / DeepSeek）
    - 优先尝试流式，yield token 事件
    - 流式失败自动尝试非流式 fallback
    - 所有模型失败后 yield event:error
    - 支持用户自填 API Key（user_id 非空时优先使用）
    """

    def __init__(self, api_keys: dict, user_model_runtime: dict | None = None):
        self.provider = LLMProvider(api_keys)
        self._default_models = [m.strip() for m in settings.llm_fallback_models.split(",")]
        self._single_timeout = settings.llm_single_timeout_seconds
        self._first_chunk_timeout = settings.llm_stream_first_chunk_timeout
        self._user_model_runtime = user_model_runtime  # 非 None 时优先使用用户模型

    def _stream_models(self, request: LLMRequest) -> list[str]:
        models = request.candidate_models or self._default_models
        # 用户自填 Key 时，优先使用用户模型
        if self._user_model_runtime and self._user_model_runtime.get("source") == "user":
            user_model = self._user_model_runtime["model"]
            if user_model not in models:
                models = [user_model] + models
        return models

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

        # 用户模型凭证（供 _stream_one 使用）
        user_runtime = self._user_model_runtime

        llm_logger.log_start(
            f"stream_gateway_{scene}",
            model=models[0] if models else "unknown",
            provider=self.provider.get_provider_name(models[0]) if models else "tokenhub",
            extra={
                "scene": scene,
                "models": models,
                "request_id": request_id,
                "user_model": user_runtime.get("model") if user_runtime else None,
            },
        )

        for i, model in enumerate(models):
            # 判断是否为用户模型
            is_user_model = (
                user_runtime
                and user_runtime.get("source") == "user"
                and model == user_runtime["model"]
            )

            # Enforce total timeout across all model attempts
            if time.time() >= total_deadline:
                total_latency = int((time.time() - start_time) * 1000)
                llm_logger.log_done(
                    f"stream_gateway_{scene}",
                    total_latency,
                    error_code="TOTAL_TIMEOUT",
                    retryable=True,
                )
                yield self._error_event(
                    "总超时时间已到，所有模型均未完成",
                    "TOTAL_TIMEOUT",
                    True,
                    "multi",
                    models[-1] if models else "unknown",
                    total_latency,
                )
                return

            attempt_start = time.time()

            if is_user_model:
                model_provider = user_runtime.get("provider", "custom")
            else:
                model_provider = self.provider.get_provider_name(model)

            token_buffer: list[str] = []

            try:
                # Try stream first — yields token/error events, fills token_buffer
                async for chunk in self._stream_one(
                    model, messages, request.temperature, request_id, token_buffer,
                    is_user_model=is_user_model,
                    user_api_key=user_runtime["api_key"] if is_user_model else None,
                    user_base_url=user_runtime.get("base_url") if is_user_model else None,
                ):
                    yield chunk

                # Stream finished without raising — parse result and emit done
                latency_ms = int((time.time() - attempt_start) * 1000)
                total_latency = int((time.time() - start_time) * 1000)
                content_str = "".join(token_buffer)

                # Parse accumulated content as JSON
                try:
                    result_dict = parse_json_safely(content_str)
                except ValueError:
                    total_latency = int((time.time() - start_time) * 1000)
                    # 用户模型失败 + fallback_to_system 时，尝试系统模型
                    if is_user_model and user_runtime.get("fallback_to_system"):
                        fallback_models = [m for m in models if m != model]
                        if fallback_models:
                            # 构造纯系统模型 gateway 并 yield 其结果
                            sys_gw = StreamGateway(_build_api_keys(), user_model_runtime=None)
                            async for chunk in sys_gw.generate(request):
                                yield chunk
                            return
                    yield self._error_event(
                        "模型返回格式异常，请重试。",
                        "LLM_RESULT_PARSE_ERROR",
                        True,
                        model_provider,
                        model,
                        total_latency,
                        attempt=i + 1,
                        latency_ms=latency_ms,
                    )
                    return

                attempts.append(ModelAttempt(
                    model=model, status="success", latency_ms=latency_ms,
                ))
                llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                yield self._done_event(
                    result_dict, model_provider, model, latency_ms, total_latency, i + 1, scene
                )
                yield self._meta_event(
                    model, model_provider, request_id, i + 1, total_latency, scene
                )
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
                    yield self._error_event(
                        f"模型请求失败：HTTP {e.code}",
                        str(e.code) if e.code else "HTTP_ERROR",
                        False,
                        model_provider, model, total_latency,
                        attempt=i + 1, latency_ms=latency_ms,
                    )
                    continue

                # Retryable: try non-stream fallback, then next model
                if is_timeout or is_http or isinstance(e, (LLMParseError, LLMEmptyError)):
                    attempts.append(ModelAttempt(
                        model=model,
                        status="timeout" if is_timeout else "failed",
                        latency_ms=latency_ms,
                        error_code=getattr(e, "code", "UNKNOWN"),
                        error_message=error_str,
                    ))
                    try:
                        yield self._progress_event(
                            f"stream failed, trying non-stream ({model})...",
                            model, i + 1, request_id,
                        )
                        result_content, result_latency = await self._call_non_stream(
                            model, messages, request.temperature,
                            is_user_model=is_user_model,
                            user_api_key=user_runtime["api_key"] if is_user_model else None,
                            user_base_url=user_runtime.get("base_url") if is_user_model else None,
                        )
                        total_latency = int((time.time() - start_time) * 1000)
                        attempts.append(ModelAttempt(
                            model=model, status="success", latency_ms=result_latency,
                        ))
                        llm_logger.log_done(f"stream_gateway_{scene}", total_latency)
                        yield self._done_event(
                            result_content, model_provider, model, result_latency,
                            total_latency, i + 1, scene, fallback="non-stream",
                        )
                        yield self._meta_event(
                            model, model_provider, request_id, i + 1, total_latency, scene
                        )
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
                        yield self._error_event(
                            f"模型 {model} 调用失败：{ns_err_str[:100]}",
                            "NON_STREAM_FAILED",
                            True,
                            model_provider, model, total_latency,
                            attempt=i + 1, latency_ms=ns_latency_ms,
                        )
                        continue
                else:
                    attempts.append(ModelAttempt(
                        model=model, status="failed", latency_ms=latency_ms,
                        error_code="UNKNOWN", error_message=error_str,
                    ))
                    total_latency = int((time.time() - start_time) * 1000)
                    yield self._error_event(
                        f"未知错误：{error_str[:100]}",
                        "UNKNOWN",
                        True,
                        model_provider, model, total_latency,
                        attempt=i + 1, latency_ms=latency_ms,
                    )
                    continue

        # All models failed
        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"stream_gateway_{scene}", total_latency, error_code="ALL_FAILED", retryable=True)
        yield self._error_event(
            "所有模型均失败，请稍后重试",
            "ALL_FAILED",
            True,
            "multi",
            models[-1] if models else "unknown",
            total_latency,
        )

    # ── SSE event helpers ────────────────────────────────────────────────────────

    def _error_event(self, error: str, code: str, retryable: bool,
                     provider: str, model: str, total_latency: int,
                     attempt: int = 1, latency_ms: int = 0) -> str:
        return (
            f"event: error\ndata: "
            + json.dumps({
                "type": "error",
                "error": error,
                "error_code": code,
                "retryable": retryable,
                "_meta": {
                    "provider": provider, "model": model,
                    "latency_ms": latency_ms,
                    "total_latency_ms": total_latency,
                    "attempt": attempt,
                },
            }, ensure_ascii=False)
            + "\n\n"
        )

    def _done_event(self, result, provider: str, model: str,
                    latency_ms: int, total_latency: int, attempt: int, scene: str,
                    fallback: str | None = None) -> str:
        meta = {
            "provider": provider, "model": model,
            "latency_ms": latency_ms, "total_latency_ms": total_latency,
            "attempt": attempt, "scene": scene,
        }
        if fallback:
            meta["fallback"] = fallback
        return (
            f"event: done\ndata: "
            + json.dumps({"type": "done", "result": result, "_meta": meta}, ensure_ascii=False)
            + "\n\n"
        )

    def _meta_event(self, model: str, provider: str, request_id: str,
                    attempt: int, total_latency: int, scene: str) -> str:
        return (
            f"event: meta\ndata: "
            + json.dumps({
                "type": "meta",
                "selected_model": model,
                "provider": provider,
                "request_id": request_id,
                "attempt_count": attempt,
                "total_latency_ms": total_latency,
                "scene": scene,
            }, ensure_ascii=False)
            + "\n\n"
        )

    def _progress_event(self, message: str, model: str, attempt: int, request_id: str) -> str:
        return (
            f"event: progress\ndata: "
            + json.dumps({
                "type": "progress",
                "phase": "fallback",
                "message": message,
                "model": model,
                "attempt": attempt,
                "request_id": request_id,
            }, ensure_ascii=False)
            + "\n\n"
        )

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _stream_one(
        self, model: str, messages: list[dict], temperature: float,
        request_id: str, token_buffer: list[str],
        is_user_model: bool = False,
        user_api_key: str | None = None,
        user_base_url: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        对单个模型尝试流式调用。
        - token 事件 → yield 出去（同时追加到 token_buffer）
        - non-200 响应 → yield error 事件，然后 raise StopAsyncIteration（通知 caller 切模型）
        - timeout → yield error 事件，raise LLMTimeoutError

        is_user_model=True 时使用用户的 api_key 和 base_url
        """
        if is_user_model and user_api_key and user_base_url:
            base_url = f"{user_base_url.rstrip('/')}/chat/completions"
            api_key = user_api_key
            model_provider_name = "custom"
        else:
            base_url, api_key = self.provider._resolve(model)
            model_provider_name = self.provider.get_provider_name(model)

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
                        logger.warning(
                            "[_stream_one] provider=%s model=%s non-200 status=%s body=%s",
                            model_provider_name, model, resp.status_code, body,
                        )
                        yield self._error_event(
                            f"模型请求失败：HTTP {resp.status_code}",
                            str(resp.status_code),
                            True,
                            model_provider_name, model, 0,
                        )
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
                                yield f"event: token\ndata: " + json.dumps(
                                    {"type": "token", "content": token}, ensure_ascii=False
                                ) + "\n\n"
                        except Exception:
                            pass

        except httpx.TimeoutException as e:
            logger.warning("[_stream_one] provider=%s model=%s timeout", model_provider_name, model)
            yield self._error_event(
                "模型响应超时，请重试或稍后再试",
                "TIMEOUT",
                True,
                model_provider_name, model, 0,
            )
            raise LLMTimeoutError(f"Stream timeout for model {model}") from e

    async def _call_non_stream(
        self, model: str, messages: list[dict], temperature: float,
        is_user_model: bool = False,
        user_api_key: str | None = None,
        user_base_url: str | None = None,
    ) -> tuple[dict, int]:
        """异步调用单模型（非流式），返回 (content_dict, latency_ms)"""
        start = time.time()
        if is_user_model and user_api_key and user_base_url:
            base_url = f"{user_base_url.rstrip('/')}/chat/completions"
            api_key = user_api_key
        else:
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
            content_dict = parse_json_safely(content)
        except ValueError:
            raise LLMParseError(f"JSON parse failed after repair: {content[:200]}")

        return content_dict, latency_ms


# ── Module-level singleton ─────────────────────────────────────────────────────

_stream_gateway: StreamGateway | None = None


def get_stream_gateway(user_model_runtime: dict | None = None) -> StreamGateway:
    """返回 StreamGateway 实例。用户填 Key 时传 user_model_runtime。"""
    global _stream_gateway
    # 有用户模型配置时，每次创建新实例（因为配置可能不同）
    if user_model_runtime:
        return StreamGateway(_build_api_keys(), user_model_runtime=user_model_runtime)
    if _stream_gateway is None:
        _stream_gateway = StreamGateway(_build_api_keys())
    return _stream_gateway