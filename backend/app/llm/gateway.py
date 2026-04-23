"""
LLM Gateway - 多模型回退核心逻辑
"""
import time
import logging
from typing import Optional

import httpx

from ..config import settings
from ..utils.logging import llm_logger
from .schemas import LLMRequest, GatewayResult, ModelAttempt, LLMMessage, GatewayResult
from .errors import (
    LLMTimeoutError,
    LLMHTTPError,
    LLMParseError,
    LLMEmptyError,
    LLMAllModelsFailedError,
    is_retryable,
)
from .provider import TokenHubProvider


logger = logging.getLogger(__name__)


class LLMGateway:
    """
    统一 LLM 调用网关
    - 按优先级依次尝试模型
    - 单模型超时/失败自动切下一个
    - 记录每个 attempt 的耗时和结果
    - 最终返回成功结果或统一失败
    """

    def __init__(self, api_key: str):
        self.provider = TokenHubProvider(api_key)
        self._default_models = [
            m.strip() for m in settings.llm_fallback_models.split(",")
        ]
        self._single_timeout = settings.llm_single_timeout_seconds
        self._total_timeout = settings.llm_total_timeout_seconds
        self._stream_first_chunk = settings.llm_stream_first_chunk_timeout

    def _get_model_chain(self, request: LLMRequest) -> list[str]:
        return request.candidate_models or self._default_models

    def _call_single_sync(
        self, model: str, messages: list[dict], temperature: float, timeout: float
    ):
        """
        同步调用单模型，返回 (content: str, latency_ms: int)
        抛出 LLM* 异常表示可回退或不可回退
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

        return content, latency_ms

    def generate(self, request: LLMRequest) -> GatewayResult:
        """
        同步生成入口，按模型链依次尝试
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
            try:
                content, latency_ms = self._call_single_sync(
                    model=model,
                    messages=[{"role": m.role, "content": m.content} for m in request.messages],
                    temperature=request.temperature,
                    timeout=self._single_timeout,
                )
                total_latency = int((time.time() - start_time) * 1000)
                attempts.append(ModelAttempt(
                    model=model,
                    status="success",
                    latency_ms=latency_ms,
                ))
                llm_logger.log_done(f"gateway_{request.scene}", total_latency)

                return GatewayResult(
                    content=content,
                    selected_model=model,
                    request_id=request.request_id,
                    attempt_count=i + 1,
                    total_latency_ms=total_latency,
                    attempts=attempts,
                )

            except LLMTimeoutError as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                attempts.append(ModelAttempt(
                    model=model, status="timeout", latency_ms=latency_ms,
                    error_code=e.code, error_message=str(e),
                ))
                llm_logger.log_heartbeat(f"gateway_{request.scene}_timeout_{model}", latency_ms)

            except (LLMHTTPError, LLMParseError, LLMEmptyError) as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                status = "rate_limited" if e.code == "RATE_LIMITED" else "failed"
                attempts.append(ModelAttempt(
                    model=model, status=status, latency_ms=latency_ms,
                    error_code=e.code, error_message=str(e),
                ))
                if not e.retryable:
                    # Non-retryable: don't try next model
                    total_latency = int((time.time() - start_time) * 1000)
                    llm_logger.log_done(f"gateway_{request.scene}", total_latency, error_code=e.code, retryable=False)
                    return GatewayResult(
                        error=str(e),
                        selected_model=model,
                        request_id=request.request_id,
                        attempt_count=i + 1,
                        total_latency_ms=total_latency,
                        attempts=attempts,
                    )

            except Exception as e:
                latency_ms = int((time.time() - attempt_start) * 1000)
                attempts.append(ModelAttempt(
                    model=model, status="failed", latency_ms=latency_ms,
                    error_code="UNKNOWN", error_message=str(e),
                ))
                if not is_retryable(e):
                    total_latency = int((time.time() - start_time) * 1000)
                    return GatewayResult(
                        error=str(e),
                        selected_model=model,
                        request_id=request.request_id,
                        attempt_count=i + 1,
                        total_latency_ms=total_latency,
                        attempts=attempts,
                    )

        # All models failed
        total_latency = int((time.time() - start_time) * 1000)
        llm_logger.log_done(f"gateway_{request.scene}", total_latency, error_code="ALL_FAILED", retryable=True)
        return GatewayResult(
            error="所有模型均失败，请稍后重试",
            selected_model=models[-1] if models else "unknown",
            request_id=request.request_id,
            attempt_count=len(attempts),
            total_latency_ms=total_latency,
            attempts=attempts,
        )


# 全局 gateway 实例（lazy init）
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