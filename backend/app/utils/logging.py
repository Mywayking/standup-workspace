"""
结构化日志工具
所有 LLM 调用和 API 请求必须使用此模块记录日志
包含: request_id / route / step / duration / provider / model / error_code / retryable
"""
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Optional

# Context variable for request-scoped request_id
_request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
_route_var: ContextVar[Optional[str]] = ContextVar("route", default=None)


def new_request_id(prefix: str = "req") -> str:
    """生成带前缀的 request_id"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def set_request_context(request_id: str, route: str):
    _request_id_var.set(request_id)
    _route_var.set(route)


def get_request_id() -> Optional[str]:
    return _request_id_var.get()


def get_route() -> Optional[str]:
    return _route_var.get()


class StructuredLogger:
    """
    结构化日志记录器。
    自动注入: request_id, route, timestamp
    输出格式: JSON 兼容的 key=value 对
    """

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._step_stack = []

    def _build_base(self) -> dict:
        base = {}
        if get_request_id():
            base["request_id"] = get_request_id()
        if get_route():
            base["route"] = get_route()
        return base

    def log_start(self, step: str, *, model: str = "deepseek-chat", provider: str = "deepseek", extra: dict = None):
        self._step_stack.append(step)
        base = self._build_base()
        base.update({
            "event": "step_start",
            "step": step,
            "provider": provider,
            "model": model,
            "ts": int(time.time() * 1000),
        })
        if extra:
            base.update(extra)
        self.logger.info(f"[{step}] START", extra={"struct": base})

    def log_done(self, step: str, duration_ms: int, *, error_code: str = None, retryable: bool = None, extra: dict = None):
        if self._step_stack and self._step_stack[-1] == step:
            self._step_stack.pop()
        base = self._build_base()
        base.update({
            "event": "step_done",
            "step": step,
            "duration_ms": duration_ms,
            "ts": int(time.time() * 1000),
        })
        if error_code:
            base["error_code"] = error_code
        if retryable is not None:
            base["retryable"] = retryable
        if extra:
            base.update(extra)
        status = "ERROR" if error_code else "OK"
        self.logger.info(f"[{step}] DONE ({duration_ms}ms)", extra={"struct": base})

    def log_heartbeat(self, step: str, elapsed_ms: int):
        base = self._build_base()
        base.update({
            "event": "heartbeat",
            "step": step,
            "elapsed_ms": elapsed_ms,
            "ts": int(time.time() * 1000),
        })
        self.logger.debug(f"[{step}] heartbeat {elapsed_ms}ms", extra={"struct": base})

    def log_request(self, method: str, path: str, *, status_code: int = None, duration_ms: int = None, error: str = None):
        base = self._build_base()
        base.update({
            "event": "api_request",
            "method": method,
            "path": path,
            "ts": int(time.time() * 1000),
        })
        if status_code:
            base["status_code"] = status_code
        if duration_ms is not None:
            base["duration_ms"] = duration_ms
        if error:
            base["error"] = error
        self.logger.info(f"{method} {path} {status_code or 'ERR'} ({duration_ms}ms if any)", extra={"struct": base})


# 模块级 logger 实例
api_logger = StructuredLogger("standup.api")
llm_logger = StructuredLogger("standup.llm")


def timed(fn):
    """装饰器: 自动记录函数执行时间"""
    def wrapper(*args, **kwargs):
        start = time.time()
        result = fn(*args, **kwargs)
        duration_ms = int((time.time() - start) * 1000)
        return result, duration_ms
    return wrapper