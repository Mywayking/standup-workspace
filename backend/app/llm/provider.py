"""TokenHub API 客户端（每个请求独立 session，避免连接复用问题）"""
import requests


class TokenHubProvider:
    """TokenHub API 调用封装"""

    BASE_URL = "https://tokenhub.tencentmaas.com/v1/chat/completions"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 1.0,
        stream: bool = False,
        timeout: float = 25.0,
    ) -> requests.Response:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        # 每个请求用独立 session，避免连接复用/阻塞问题
        session = requests.Session()
        try:
            resp = session.post(
                self.BASE_URL,
                json=payload,
                headers=headers,
                timeout=timeout,
            )
        finally:
            session.close()
        return resp
