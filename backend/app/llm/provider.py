"""LLM Provider 路由层 - 按模型名自动选择 Provider（TokenHub / BigModel / DeepSeek）"""
import requests
import httpx
from typing import Optional


# Provider 配置：模型前缀 → (BASE_URL, Key 获取函数)
_PROVIDER_CONFIGS = {
    # BigModel 直接调用（GLM 系列）
    "glm-": (
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        lambda keys: keys.get("glm5_api_key", ""),
    ),
    # DeepSeek 直接调用
    "deepseek": (
        "https://api.deepseek.com/v1/chat/completions",
        lambda keys: keys.get("deepseek_api_key", ""),
    ),
    # MiniMax 直接调用
    "minimax": (
        "https://api.minimax.chat/v1/chat/completions",
        lambda keys: keys.get("minimax_api_key", ""),
    ),
}

# 默认：TokenHub
_DEFAULT_PROVIDER = (
    "https://tokenhub.tencentmaas.com/v1/chat/completions",
    lambda keys: keys.get("tokenhub_api_key", ""),
)


class LLMProvider:
    """
    统一 Provider 接口，支持多渠道（TokenHub / BigModel / DeepSeek）。
    按模型名前缀匹配 Provider，自动选择调用渠道。
    """

    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def _resolve(self, model: str) -> tuple[str, str]:
        """返回 (base_url, api_key)"""
        for prefix, (base_url, key_fn) in _PROVIDER_CONFIGS.items():
            if model.startswith(prefix):
                key = key_fn(self.api_keys)
                if key:
                    return base_url, key
        # 默认走 TokenHub
        base_url, key_fn = _DEFAULT_PROVIDER
        return base_url, key_fn(self.api_keys)

    def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> requests.Response:
        """同步调用（requests），返回 requests.Response"""
        base_url, api_key = self._resolve(model)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        session = requests.Session()
        try:
            resp = session.post(base_url, json=payload, headers=headers, timeout=timeout)
        finally:
            session.close()
        return resp

    def chat_completion_async(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> httpx.Response:
        """异步调用（httpx），返回 httpx.Response"""
        base_url, api_key = self._resolve(model)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        # 同步 httpx client
        with httpx.Client(timeout=timeout) as client:
            return client.post(base_url, json=payload, headers=headers)

    async def chat_completion_async_http(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> httpx.Response:
        """异步调用（httpx.AsyncClient），返回 httpx.Response"""
        base_url, api_key = self._resolve(model)
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
            return await client.post(base_url, json=payload, headers=headers)

    def get_provider_name(self, model: str) -> str:
        """返回 provider 名称，用于日志"""
        for prefix in _PROVIDER_CONFIGS:
            if model.startswith(prefix):
                if prefix == "glm-":
                    return "bigmodel"
                return prefix.rstrip("-")
        return "tokenhub"
