"""
共用 LLM 调用工具函数
被 analyze.py / extract_premise.py / find_angles.py 共用
"""
import json
import re
import logging
from typing import Optional

import httpx

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
            result = _extract_json(resp)
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
            result = _extract_json(resp)
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


def _extract_json(text: str) -> Optional[dict]:
    """Parse JSON from LLM response text. Handles markdown fences, multiple JSON blocks."""
    import re as _re
    # Pre-clean: strip control chars
    text = _re.sub(r"[\x00-\x08\x0E-\x1F\x7F]", "", text)
    text = text.strip()

    # Strategy 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: strip markdown fences
    stripped = _re.sub(r"```json\s*\n?\s*", "", text)
    stripped = _re.sub(r"```\s*$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Strategy 3: find all complete top-level JSON objects, return LAST
    complete_jsons = []
    count = 0
    in_string = False
    escape = False
    json_start = -1
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if count == 0:
                json_start = i
            count += 1
        elif ch == "}":
            count -= 1
            if count == 0 and json_start >= 0:
                try:
                    complete_jsons.append(json.loads(text[json_start:i + 1]))
                except json.JSONDecodeError:
                    pass
                json_start = -1

    if complete_jsons:
        return complete_jsons[-1]
    return None
