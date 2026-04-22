"""
提炼前提 API
输入：一段素材/情绪/事件/观察
输出：主题、态度、核心矛盾、5条前提候选、推荐前提、段子类型建议、后续展开建议
"""
import asyncio
import json
import logging
import re
import time
import uuid
from typing import Optional



import httpx
from ..utils.errors import _classify_error
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["extract-premise"])


def _extract_json(text: str):
    import json
    text = re.sub(r"[\x00-\x08\x0E-\x1F\x7F]", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    stripped = re.sub(r"```json\s*\n?\s*", "", text)
    stripped = re.sub(r"```\s*$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    complete_jsons = []
    count = 0
    in_string = False
    escape = False
    json_start = -1
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            if count == 0:
                json_start = i
            count += 1
        elif ch == '}':
            count -= 1
            if count == 0 and json_start >= 0:
                try:
                    complete_jsons.append(json.loads(text[json_start:i+1]))
                except json.JSONDecodeError:
                    pass
                json_start = -1
    if complete_jsons:
        return complete_jsons[-1]
    return None


SYSTEM_PROMPT = """
你是一个专注于脱口秀内容创作的AI编剧，擅长从真实素材中提炼出最有喜剧价值的前提。

## 你的任务
用户会输入一段素材（可能是一件事、一句抱怨、一个观察、一段情绪），你的任务是将它转化为一组可以上台说的喜剧前提。

## 输入素材的常见类型
- 一段经历（开会、被催婚、相亲）
- 一种情绪（愤怒、无奈、被冒犯）
- 一个现象（成年人为啥都说"都行"）
- 一句聊天记录
- 一种荒谬的细节

## 你的工作流程

### 第一步：识别素材的本质
- 这个素材在讲什么？（主题）
- 用户对这件事的真实态度是什么？（态度）
- 素材里的核心矛盾是什么？（荒谬点在哪）

### 第二步：生成5个前提候选
从不同维度生成5个前提：
1. 直给型 — 简洁直接，有判断
2. 观点型 — 有立场，适合观点式喜剧
3. 观察型 — 更像演员在台上观察
4. 更狠型 — 更极端、更反常识
5. 自嘲型 — 适合自嘲型演员

### 第三步：推荐最优前提
从5个候选中选1个最值得展开的，说明原因。

### 第四步：给出后续建议
- 推荐适合的喜剧类型（观察式/观点式/故事式）
- 给出3个可写场景
- 给出2个延展方向
- 给出1个适合的结尾方向

## 好前提的标准
- 不空 — 有具体内容，不是泛泛而谈
- 不泛 — 不是"加班很烦"这种所有人都在说的
- 有判断 — 有一句明确的观点或立场
- 有矛盾 — 包含某种荒谬或冲突
- 可延展 — 可以写出场景、对话、细节
- 适合舞台 — 像人话，不是写文章

## 输出格式
严格返回JSON，不要任何Schema以外文字：
{
  "theme": "主题识别结果",
  "attitude": "态度识别结果",
  "conflict": "核心矛盾",
  "premise_candidates": [
    {"text": "前提1", "type": "直给型", "description": "这个前提的特点"},
    {"text": "前提2", "type": "观点型", "description": "这个前提的特点"},
    {"text": "前提3", "type": "观察型", "description": "这个前提的特点"},
    {"text": "前提4", "type": "更狠型", "description": "这个前提的特点"},
    {"text": "前提5", "type": "自嘲型", "description": "这个前提的特点"}
  ],
  "recommendation": {
    "text": "推荐的前提",
    "reason": "推荐理由（判断清晰/有冲突/可延展等）",
    "best_type": "观察式/观点式/故事式"
  },
  "scene_suggestions": ["场景1", "场景2", "场景3"],
  "expansion_directions": ["方向1", "方向2"],
  "ending_direction": "适合的结尾方向"
}
"""


async def _call_llm(client: httpx.AsyncClient, user_prompt: str, deepseek_key: str) -> dict:
    """Call DeepSeek only."""
    if not deepseek_key:
        return {"error": "DeepSeek API key 未配置"}
    try:
        r = await client.post(
            "https://api.deepseek.com/chat/completions",
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT.strip()},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 4000,
            },
            headers={"Authorization": "Bearer " + deepseek_key, "Content-Type": "application/json"},
            timeout=httpx.Timeout(150.0),
        )
        r.raise_for_status()
        resp = r.json()["choices"][0]["message"]["content"]
        result = _extract_json(resp)
        if result:
            return result
        first = resp.find('{')
        last = resp.rfind('}')
        if first >= 0 and last > first:
            import json as _j
            return _j.loads(resp[first:last+1])
        return {"error": "返回格式解析失败，请稍后重试"}
    except httpx.HTTPStatusError as exc:
        logger.warning(f"[DeepSeek HTTP error in extract-premise] status={exc.response.status_code}")
        return {"error": _classify_error(exc)}
    except Exception as exc:
        logger.warning(f"[DeepSeek failed in extract-premise: {exc}]")
        return {"error": _classify_error(exc)}


@router.post("/extract-premise")
async def extract_premise(req: dict):
    """
    Non-streaming version — input: { text: string }
    """
    text = req.get("text", "").strip()
    if len(text) < 5:
        raise HTTPException(400, "Text too short (min 5 chars)")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    user_prompt = (
        "以下是一段脱口秀演员的素材，请提炼出喜剧前提：\n\n"
        f"素材：\n{text}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )

    async with httpx.AsyncClient() as client:
        result = await _call_llm(client, user_prompt, deepseek_key)

    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


@router.post("/extract-premise/stream")
async def extract_premise_stream(req: dict):
    """Streaming version — SSE events: theme, attitude, conflict, candidate, recommendation, done"""
    import asyncio
    text = req.get("text", "").strip()
    if len(text) < 5:
        raise HTTPException(400, "素材太短了（至少5字）")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    user_prompt = (
        "以下是一段脱口秀演员的素材，请提炼出喜剧前提：\n\n"
        f"素材：\n{text}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )

    start_time = time.time()
    last_heartbeat = [0.0]

    async def event_generator():
        import json as _json
        client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))

        async def send_heartbeat():
            elapsed = time.time() - start_time
            if elapsed - last_heartbeat[0] >= 5.0:
                last_heartbeat[0] = elapsed
                yield f"event: progress\ndata: " + _json.dumps({
                    "elapsed": int(elapsed),
                    "status": "提炼前提中...",
                }) + "\n\n"

        async def send_error(msg):
            yield f"event: error\ndata: " + _json.dumps({"error": msg}) + "\n\n"

        try:
            async with client.stream(
                "POST",
                "https://api.deepseek.com/chat/completions",
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT.strip()},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000,
                    "stream": True,
                },
                headers={"Authorization": f"Bearer {deepseek_key}", "Content-Type": "application/json"},
            ) as resp:
                if resp.status_code != 200:
                    async for err in send_error(_classify_error(exc)): yield err
                    return

                json_parts = []
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        obj = _json.loads(data_str)
                        token = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if token:
                            encoded = _json.dumps(token)
                            inner = encoded[1:-1]  # strip JSON quotes
                            yield f"event: token\ndata: " + inner + "\n\n"
                            json_parts.append(token)
                    except Exception:
                        pass
                    async for hb in send_heartbeat(): yield hb

                full = "".join(json_parts)
                result = _extract_json(full)
                if result:
                    yield f"event: done\ndata: " + _json.dumps(result) + "\n\n"
                else:
                    async for err in send_error("解析失败，请稍后重试"): yield err
        except httpx.HTTPStatusError as exc:
            async for err in send_error(_classify_error(exc)): yield err
        except Exception as exc:
            logger.warning(f"[DeepSeek streaming failed: {exc}]")
            async for err in send_error(_classify_error(exc)): yield err
        finally:
            await client.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _call_deepseek_sync(user_prompt: str, api_key: str) -> dict:
    import httpx as _httpx
    with _httpx.Client(timeout=_httpx.Timeout(150.0)) as client:
        r = client.post(
            "https://api.deepseek.com/chat/completions",
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT.strip()},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 4000,
            },
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        )
        r.raise_for_status()
        resp = r.json()["choices"][0]["message"]["content"]
        result = _extract_json(resp)
        if result:
            return result
        first = resp.find('{')
        last = resp.rfind('}')
        if first >= 0 and last > first:
            import json as _j
            return _j.loads(resp[first:last+1])
        return {"error": "Parse Failed: " + resp[:150]}
