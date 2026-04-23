"""
TokenHub API 客户端
统一调用腾讯云 TokenHub 大模型网关
"""
import httpx
from typing import Literal

from ..config import settings
from .schemas import LLMMessage


class TokenHubProvider:
    """TokenHub API 调用封装"""

    BASE_URL = "https://tokenhub.tencentmaas.com/v1/chat/completions"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} if isinstance(m, LLMMessage) else m for m in messages],
            "temperature": temperature,
            "stream": stream,
        }
        client = httpx.Client(timeout=httpx.Timeout(timeout))
        try:
            resp = client.post(self.BASE_URL, json=payload, headers=headers)
            client.close()
            return resp
        except Exception:
            client.close()
            raise

    async def chat_completion_async(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.7,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} if isinstance(m, LLMMessage) else m for m in messages],
            "temperature": temperature,
            "stream": stream,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
            return await client.post(self.BASE_URL, json=payload, headers=headers)


def get_provider() -> TokenHubProvider:
    key = settings.tokenhub_api_key or ""
    if not key:
        raise ValueError("TOKENHUB_API_KEY is not configured")
    return TokenHubProvider(key)