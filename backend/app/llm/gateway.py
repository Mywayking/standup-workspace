"""LLM Gateway - 多模型回退核心逻辑"""
import asyncio
import time
import logging
from typing import Optional

from ..config import settings
from ..utils.logging import llm_logger
from .schemas import LLMRequest, GatewayResult, ModelAttempt, LLMMessage
from .errors import (
    LLMTimeoutError,
    LLMHTTPError,
    LLMParseError,
    LLMEmptyError,
    is_retryable,
)
from .provider import TokenHubProvider


logger = logging.getLogger(__name__)


class LLMGateway:
    """统一 LLM 调用网关 — 多模型自动回退"""

    def __init__(self, api_key: str):
        self.provider = TokenHubProvider(api_key)
        self._default_models = [
            m.strip() for m in settings.llm_fallback_models.split(",")
        ]
        self._single_timeout = settings.llm_single_timeout_seconds

    def _get_model_chain(self, request: LLMRequest) -> list[str]:
        return request.candidate_models or self._default_models

    def _call_sync(self, model: str, messages: list[dict], temperature: float, timeout: float):
        """
        同步调用单模型，返回 (content: str, latency_ms: int)
        运行在线程池中，避免阻塞事件循环
        """
        start = time.time()
        resp = self.provider.chat_completion(
            model=model,
            messages=messages,
            temperature=temperature,
            stream=False,
            timeout=timeout,
        )
        latency_ms = int((time.time() - start) * 1000)
        logger.info(f"[_call_sync] model={model} status={resp.status_code} latency={latency_ms}ms")

        if resp.status_code != 200:
            body = str(resp.text[:200]) if resp.text else f"status={resp.status_code}"
            logger.warning(f"[_call_sync] non-200 model={model} body={body}")
            raise LLMHTTPError(resp.status_code, body)

        try:
            data = resp.json()
        except Exception as e:
            logger.warning(f"[_call_sync] JSON parse error: {e}")
            raise LLMParseError(str(e))

        choices = data.get("choices", [])
        if not choices:
            logger.warning(f"[_call_sync] model={model} empty choices")
            raise LLMEmptyError(model)

        content = choices[0].get("message", {}).get("content", "") or ""
        if not content:
            logger.warning(f"[_call_sync] model={model} empty content")
            raise LLMEmptyError(model)

        return content, latency_ms

    async def generate(self, request: LLMRequest) -> GatewayResult:
        """
        异步入口 — asyncio.to_thread 把同步阻塞调用扔进线程池
        """
        models = self._get_model_chain(request)
        attempts: list[ModelAttempt] = []
        start_time = time.time()

        llm_logger.log_start(
            f"gateway_{request.scene}",
            model=models[0] if models else "unknown",
            provider="tokenhub",
            extra={"scene": request.scene, "models": models, "request_id": request.request_id},
        )

        for i, model in enumerate(models):
            attempt_start = time.time()
            msgs = [{"role": m.role, "content": m.content or ""} for m in request.messages]

            try:
                # Run sync HTTP in thread pool without blocking event loop
                content, latency_ms = await asyncio.to_thread(
                    self._call_sync,
                    model,
                    msgs,
                    request.temperature,
                    self._single_timeout,
                )
                total_latency = int((time.time() - start_time) * 1000)
                attempts.append(ModelAttempt(model=model, status="success", latency_ms=latency_ms))
                llm_logger.log_done(f"gateway_{request.scene}", total_latency)
                logger.info(f"[gateway] model={model} succeeded content_len={len(content)}")

                return GatewayResult(
                    content=content,
                    selected_model=model,
                    request_id=request.request_id,
                    attempt_count=i + 1,
                    total_latency_ms=total_latency,
                    attempts=attempts,
                )

            except (LLMHTTPError, LLMParseError, LLMEmptyError) as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                status = "rate_limited" if e.code == "RATE_LIMITED" else "failed"
                attempts.append(ModelAttempt(
                    model=model, status=status, latency_ms=latency_ms,
                    error_code=e.code, error_message=str(e),
                ))
                logger.warning(f"[gateway] model={model} error={e.code} retryable={e.retryable}")
                if not e.retryable:
                    total_latency = int((time.time() - start_time) * 1000)
                    llm_logger.log_done(f"gateway_{request.scene}", total_latency, error_code=e.code, retryable=False)
                    return GatewayResult(
                        error=str(e), selected_model=model, request_id=request.request_id,
                        attempt_count=i + 1, total_latency_ms=total_latency, attempts=attempts,
                    )

            except Exception as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                attempts.append(ModelAttempt(
                    model=model, status="failed", latency_ms=latency_ms,
                    error_code="UNKNOWN", error_message=str(e),
                ))
                logger.error(f"[gateway] model={model} unexpected error={type(e).__name__}: {e}")
                if not is_retryable(e):
                    total_latency = int((time.time() - start_time) * 1000)
                    return GatewayResult(
                        error=str(e), selected_model=model, request_id=request.request_id,
                        attempt_count=i + 1, total_latency_ms=total_latency, attempts=attempts,
                    )

        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"gateway_{request.scene}", total_latency, error_code="ALL_FAILED", retryable=True)
        return GatewayResult(
            error="所有模型均失败，请稍后重试",
            selected_model=models[-1] if models else "unknown",
            request_id=request.request_id, attempt_count=len(attempts),
            total_latency_ms=total_latency, attempts=attempts,
        )


_gateway: Optional[LLMGateway] = None


def get_gateway() -> LLMGateway:
    global _gateway
    if _gateway is None:
        key = settings.tokenhub_api_key
        if not key:
            raise ValueError("TOKENHUB_API_KEY not configured")
        _gateway = LLMGateway(key)
    return _gateway


def llm_gateway() -> LLMGateway:
    return get_gateway()
