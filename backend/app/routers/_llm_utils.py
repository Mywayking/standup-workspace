"""
共用 LLM 调用工具函数
被 analyze.py / extract_premise.py / find_angles.py 共用
"""
import json
import re
import logging
from typing import Optional

import httpx

from ..utils.json_repair import parse_llm_json

logger = logging.getLogger(__name__)


def _build_extract_json(system_prompt: str, user_prompt: str, minimax_key: str, deepseek_key: str) -> dict:
    """Generate JSON using MiniMax first, fallback to DeepSeek. Returns dict or {"error": ...}."""
    json_parts = []
    client = httpx.Client(timeout=httpx.Timeout(150.0))

    if minimax_key:
        try:
            r = client.post(
                "https://api.minimax.chat/v1/chat/completions",
                json={
                    "model": "MiniMax-M2.7",
                    "messages": [
                        {"role": "system", "content": system_prompt.strip()},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 6000,
                },
                headers={"Authorization": "Bearer " + minimax_key, "Content-Type": "application/json"},
            )
            r.raise_for_status()
            resp = r.json()["choices"][0]["message"]["content"]
            resp = re.sub(r"<thinking>.*?</thinking>", "", resp, flags=re.DOTALL)
            result = parse_llm_json(resp)
            if result:
                client.close()
                return result
            logger.warning("[MiniMax parse failed in shared util]")
        except Exception as exc:
            logger.warning(f"[MiniMax failed in shared util: {exc}]")

    if deepseek_key:
        try:
            r = client.post(
                "https://api.deepseek.com/chat/completions",
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt.strip()},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 6000,
                },
                headers={"Authorization": "Bearer " + deepseek_key, "Content-Type": "application/json"},
            )
            r.raise_for_status()
            resp = r.json()["choices"][0]["message"]["content"]
            result = parse_llm_json(resp)
            if result:
                client.close()
                return result
            first = resp.find("{")
            last = resp.rfind("}")
            if first >= 0 and last > first:
                return json.loads(resp[first:last + 1])
            return {"error": "Parse Failed: " + resp[:150]}
        except Exception as exc:
            client.close()
            return {"error": "DeepSeek fallback failed: " + str(exc)}

    client.close()
    return {"error": "No LLM API key configured"}


