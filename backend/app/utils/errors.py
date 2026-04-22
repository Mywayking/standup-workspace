"""
公共错误处理和日志工具
"""
import asyncio
import json
import logging
import httpx

logger = logging.getLogger(__name__)


def _classify_error(exc: Exception) -> str:
    """将异常映射为用户友好的错误消息。"""
    exc_str = str(exc).lower()
    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return "内容正在酝酿中，网络有点慢，稍后重试一次~"
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        s = exc.response.status_code
        if s == 429: return "服务器需要喘口气，稍等 5 秒再试就好~"
        if s == 500: return "AI 正在重新思考，稍后重试一次~"
        if s in (502, 503, 504): return "服务正在维护中，稍后重试~"
        if s in (401, 403): return "服务配置异常，请联系管理员~"
        if s == 400: return "输入内容超出限制，请精简后重试~"
    if isinstance(exc, httpx.ConnectError):
        return "网络有点问题，稍后重试一次~"
    if "json" in exc_str or isinstance(exc, (json.JSONDecodeError, ValueError)):
        return "这次生成的内容太长了，放短一点试试~"
    return "内容正在酝酿中，稍后重试一次~"


def send_error(msg: str):
    """生成 SSE error 事件字符串（用于 async generator）。"""
    import json as _json
    yield f"event: error\ndata: {_json.dumps({'error': msg})}\n\n"


def send_error_with_request_id(msg: str, request_id: str):
    """带 request_id 的 error 事件。"""
    import json as _json
    yield f"event: error\ndata: {_json.dumps({'error': msg, 'request_id': request_id})}\n\n"


async def timeout_yield(seconds: float, generator, fallback_msg: str):
    """
    为 async generator 包装超时。
    超时时yield一个error事件，然后抛出 asyncio.TimeoutError。
    """
    import asyncio
    import json as _json
    try:
        async with asyncio.timeout(seconds):
            async for item in generator:
                yield item
    except asyncio.TimeoutError:
        yield f"event: error\ndata: {_json.dumps({'error': fallback_msg})}\n\n"
        raise
