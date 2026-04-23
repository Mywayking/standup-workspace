"""
找角度 API
输入：一个已有前提
输出：当前问题判断、6个新角度、推荐角度、继续展开建议
"""
import asyncio
import json
import logging
import re
import time
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..utils.logging import api_logger, llm_logger, new_request_id, set_request_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["find-angles"])

from ..utils.errors import _classify_error

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
你是一个专注于脱口秀内容创作的AI编剧，擅长为一个普通前提找到更新鲜、更狠、更有喜剧价值的切入角度。

## 你的任务
用户给出一个已有的喜剧前提，你来判断这个前提目前的问题，然后生成6个不同维度的新角度。

## 输入前提的常见类型
- 一个已经写出来的段子前提（"加班很烦"）
- 一个观众常说的泛泛而谈（"相亲像面试"）
- 一个演员自己提炼的前提（"成年人的'都行'是不想承担责任"）

## 你的工作流程

### 第一步：判断当前前提的问题
分析这个前提目前存在什么问题：
- 太泛 — 所有人都在说这个
- 太直给 — 没有意外，没有反转空间
- 缺少人物感 — 没有演员视角，没有性格
- 缺少冲突 — 太平，没有对立面
- 缺少意外 — 结果可预测
- 缺少场景 — 难以可视化

### 第二步：生成6个新角度
从不同维度给出6个角度：
1. 反常识角度 — 反着说，翻转认知
2. 人性角度 — 从人性的弱点/荒谬出发
3. 权力关系角度 — 从权力不对等出发
4. 自嘲角度 — 用自己的弱点/失败来说
5. 类比角度 — 用一个精准的比喻来重新框定
6. 更狠角度 — 更极端、更荒谬、更具体

每个角度包含：
- 角度名称
- 新前提（重构后的前提）
- 展开思路（一句话提示可以从哪里展开）
- 场景方向（适合写什么场景）
- 结尾方向（适合什么样的结尾）

### 第三步：推荐最优角度
从6个候选中选1个最有喜剧价值的，说明理由。

## 好角度的标准
- 不是同义改写
- 不是更文艺
- 能明显打开新思路
- 能带来新的场景或比喻
- 有舞台表达空间
- 有演员独特立场

## 输出格式
严格返回JSON，不要任何Schema以外文字：
{
  "current_problem": {
    "issues": ["问题1", "问题2"],
    "summary": "当前前提的核心问题概括"
  },
  "angles": [
    {
      "name": "反常识角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    },
    {
      "name": "人性角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    },
    {
      "name": "权力关系角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    },
    {
      "name": "自嘲角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    },
    {
      "name": "类比角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    },
    {
      "name": "更狠角度",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路的一句话提示",
      "scene_direction": "适合的场景方向",
      "ending_direction": "适合的结尾方向"
    }
  ],
  "recommendation": {
    "name": "推荐的角度名称",
    "reason": "推荐理由"
  }
}
"""


async def _call_llm(client: httpx.AsyncClient, user_prompt: str, deepseek_key: str) -> dict:
    """DeepSeek only - no MiniMax fallback"""
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
        logger.warning(f"[DeepSeek HTTP error in find-angles: {exc}]")
        return {"error": _classify_error(exc)}
    except Exception as exc:
        logger.warning(f"[DeepSeek failed in find-angles: {exc}]")
        return {"error": _classify_error(exc)}


@router.post("/find-angles")
async def find_angles(req: dict):
    premise = req.get("premise", "").strip()
    if len(premise) < 3:
        raise HTTPException(400, "输入的前提太短了（至少3个字）")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    user_prompt = (
        "以下是一个脱口秀前提，请为它找角度：\n\n"
        f"前提：\n{premise}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )

    async with httpx.AsyncClient() as client:
        result = await _call_llm(client, user_prompt, deepseek_key)

    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


@router.post("/find-angles/stream")
async def find_angles_stream(req: dict):
    import asyncio
    premise = req.get("premise", "").strip()
    if len(premise) < 3:
        raise HTTPException(400, "输入的前提太短了（至少3个字）")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    user_prompt = (
        "以下是一个脱口秀前提，请为它找角度：\n\n"
        f"前提：\n{premise}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )

    start_time = time.time()
    last_heartbeat = [0.0]
    request_id = new_request_id("fa")
    set_request_context(request_id, "find-angles/stream")

    async def event_generator():
        import json as _json
        client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))

        async def send_heartbeat():
            elapsed = time.time() - start_time
            if elapsed - last_heartbeat[0] >= 5.0:
                last_heartbeat[0] = elapsed
                llm_logger.log_heartbeat("find_angles_stream", int(elapsed * 1000))
                yield f"event: progress\ndata: " + _json.dumps({
                    "elapsed": int(elapsed),
                    "status": "找角度中...",
                    "request_id": request_id,
                }) + "\n\n"

        async def send_error(msg, error_code=None):
            extra = {"error": msg}
            if error_code:
                extra["error_code"] = error_code
            yield f"event: error\ndata: " + _json.dumps({"error": msg, "request_id": request_id}) + "\n\n"

        try:
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
                        body = (await resp.aread()).decode()
                        llm_logger.log_done("find_angles_stream", int((time.time() - start_time) * 1000), error_code="UPSTREAM_HTTP", retryable=True)
                        async for err in send_error("内容正在酝酿中，稍后重试一次~", "UPSTREAM_HTTP"): yield err
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
                                # Properly escape for SSE data field:
                                # 1. Escape backslashes first (to avoid confusion)
                                # 2. Replace actual newlines with literal \n (backslash + letter n)
                                # This keeps the SSE data on one line without triggering line split
                                safe = token.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r")
                                yield f"event: token\ndata: " + safe + "\n\n"
                                json_parts.append(token)
                        except Exception:
                            pass
                        async for hb in send_heartbeat(): yield hb

                    full = "".join(json_parts)
                    duration = int((time.time() - start_time) * 1000)
                    result = _extract_json(full)
                    if result:
                        llm_logger.log_done("find_angles_stream", duration)
                        yield f"event: done\ndata: " + _json.dumps(result) + "\n\n"
                    else:
                        llm_logger.log_done("find_angles_stream", duration, error_code="PARSE_FAILED", retryable=True)
                        async for err in send_error("解析失败，请稍后重试", "PARSE_FAILED"): yield err
            except httpx.HTTPStatusError as exc:
                llm_logger.log_done("find_angles_stream", int((time.time() - start_time) * 1000), error_code="UPSTREAM_HTTP", retryable=True)
                async for err in send_error(_classify_error(exc), "UPSTREAM_HTTP"): yield err
            except Exception as exc:
                logger.warning(f"[DeepSeek streaming failed: {exc}]")
                llm_logger.log_done("find_angles_stream", int((time.time() - start_time) * 1000), error_code="STREAM_FAILED", retryable=True)
                # ── Fallback: try non-stream call ──────────────────────────────
                yield f"event: progress\ndata: " + _json.dumps({"status": "stream failed, trying fallback...", "request_id": request_id}) + "\n\n"
                try:
                    fallback_result = _call_deepseek_sync(user_prompt, deepseek_key)
                    if "error" not in fallback_result:
                        llm_logger.log_done("find_angles_stream_fallback", int((time.time() - start_time) * 1000))
                        yield f"event: done\ndata: " + _json.dumps(fallback_result) + "\n\n"
                    else:
                        yield f"event: error\ndata: " + _json.dumps({"error": fallback_result["error"], "request_id": request_id, "error_code": "FALLBACK_FAILED", "retryable": True}) + "\n\n"
                except Exception as fb_exc:
                    yield f"event: error\ndata: " + _json.dumps({"error": _classify_error(fb_exc), "request_id": request_id, "error_code": "FALLBACK_EXC", "retryable": True}) + "\n\n"
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
