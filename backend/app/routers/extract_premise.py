"""
提炼前提 API
输入：一段素材/情绪/事件/观察
输出：主题、态度、核心矛盾、5条前提候选、推荐前提、段子类型建议、后续展开建议

全部模型调用统一走 LLM Gateway（TokenHub 多模型自动回退）
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
from ..llm import llm_gateway, StreamGateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context

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


def _build_user_prompt(text: str) -> str:
    return (
        "以下是一段脱口秀演员的素材，请提炼出喜剧前提：\n\n"
        f"素材：\n{text}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )


@router.post("/extract-premise")
async def extract_premise(req: dict):
    """Non-streaming version — 走 LLM Gateway 多模型回退"""
    text = req.get("text", "").strip()
    if len(text) < 5:
        raise HTTPException(400, "Text too short (min 5 chars)")

    request_id = new_request_id("ep")
    set_request_context(request_id, "extract-premise")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    result = await gateway.generate(LLMRequest(
        scene="extract_premise",
        messages=[
            LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
            LLMMessage(role="user", content=_build_user_prompt(text)),
        ],
        temperature=1.0,
        stream=False,
        request_id=request_id,
    ))

    if result.error:
        raise HTTPException(500, result.error)

    parsed = _extract_json(result.content)
    if not parsed:
        raise HTTPException(500, "返回格式解析失败，请稍后重试")
    return parsed


@router.post("/extract-premise/stream")
async def extract_premise_stream(req: dict):
    """Streaming version — 走 StreamGateway 多模型自动回退"""
    text = req.get("text", "").strip()
    if len(text) < 5:
        raise HTTPException(400, "素材太短了（至少5字）")

    request_id = new_request_id("ep")
    set_request_context(request_id, "extract-premise/stream")

    key = settings.tokenhub_api_key
    if not key:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    gateway = StreamGateway(key)

    return StreamingResponse(
        gateway.generate(LLMRequest(
            scene="extract_premise",
            messages=[
                LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
                LLMMessage(role="user", content=_build_user_prompt(text)),
            ],
            temperature=1.0,
            stream=True,
            request_id=request_id,
        )),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
