"""
Write page multi-mode API — supports:
  joke_to_premise, premise_extract, material_to_premise,
  find_angle, premise_to_angle, rewrite, analyze_full
"""
import asyncio
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
from ..llm import llm_gateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/write", tags=["write"])


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


# ─── Request/Response Models ──────────────────────────────────────────────────

class WriteRequest(BaseModel):
    text: str
    mode: str = "joke_to_premise"
    topic: Optional[str] = None
    style: Optional[str] = None
    depth: Optional[str] = "premise_with_setup"
    scene: Optional[str] = "standup"


class PremiseCandidate(BaseModel):
    id: str
    title: str
    why_it_works: str
    setup_direction: str
    persona: str
    emotion: str
    opening_line: str


class JokeAnalysis(BaseModel):
    joke_type: str
    core_topic: str
    core_conflict: str
    comparison_target: Optional[str] = None
    emotion: list[str]
    persona_candidates: list[str]
    humor_mechanism: str


class JokeToPremiseResponse(BaseModel):
    request_id: str
    input_type: str
    analysis: Optional[JokeAnalysis] = None
    premises: list[PremiseCandidate]
    error: Optional[str] = None


# ─── Prompts ─────────────────────────────────────────────────────────────────

JOKE_TO_PREMISE_SYSTEM = """你是一个专注于脱口秀创作的AI助手，擅长从一句梗反推出多个合理的前提方向。

## 你的任务
用户会输入一句梗/包袱句/吐槽句/类比句。你的任务是：
1. 先分析这句梗的机制（类型、核心冲突、笑点原理等）
2. 基于分析结果，生成3-5条不同角度的前提候选
3. 每条前提必须：角度明显不同、具体可写、有起手句

## 输出要求
- 只返回JSON，不要任何解释性文字
- 每条前提的角度要有明显区分，避免同质化
- 起手句要口语化、可直接上台讲
- 不要空泛，要具体到人物身份和场景

## 约束
- 不写完整段子，只反推前提
- 不输出写作建议类的空话
- 所有结果都要有画面感和人物身份"""

JOKE_TO_PREMISE_USER_TPL = """一句梗：{text}

主题偏好：{topic}
风格偏好：{style}
场景：{scene}
输出深度：{depth}

请按以下步骤输出JSON：

步骤1：分析这句梗
- 判断输入类型（joke_line / topic_line / raw_material / long_draft）
- 识别梗类型（类比型/反差型/结论型/夸张型/角色错位型/情绪判断型）
- 提取核心主题、核心冲突、类比对象（如有）、情绪色彩、潜在人设、笑点机制

步骤2：生成前提候选
基于分析结果，生成3-5条不同角度的前提候选。
每条包含：id、title、why_it_works、setup_direction、persona、emotion、opening_line

返回格式：
{{
  "request_id": "jtp_xxx",
  "input_type": "joke_line",
  "analysis": {{
    "joke_type": "类比型",
    "core_topic": "成年人情绪崩溃",
    "core_conflict": "崩溃 vs 责任",
    "comparison_target": "电脑死机前保存",
    "emotion": ["克制", "无奈"],
    "persona_candidates": ["上班族", "互联网从业者"],
    "humor_mechanism": "把情绪崩溃类比成系统被训练得极其克制的反差"
  }},
  "premises": [
    {{
      "id": "p1",
      "title": "成年人连崩溃都要先善后",
      "why_it_works": "笑点来自成年人即使情绪失控，也仍要先考虑后果",
      "setup_direction": "先讲小时候崩溃很纯粹，长大后连崩溃都要先处理后续",
      "persona": "普通上班族",
      "emotion": "克制中的无奈",
      "opening_line": "小时候崩溃是哭，长大后崩溃要先保存。"
    }}
  ]
}}"""

PREMISE_EXTRACT_SYSTEM = """你是一个专注于脱口秀创作的AI助手，擅长从素材中提炼核心前提。

## 你的任务
用户输入一段素材/经历/观察，你的任务是提炼出能够代表整个故事的核心前提。

## 输出要求
- 只返回JSON，不要任何解释性文字
- 前提要精准、具体、有喜剧张力
- 说明为什么这个前提好笑

返回格式：
{{
  "premise": "核心前提描述",
  "why_it_works": "为什么这个前提好笑",
  "suggested_angle": "建议从哪个角度展开"
}}"""

FIND_ANGLE_SYSTEM = """你是一个专注于脱口秀创作的AI助手，擅长为一个前提找到多个有趣的展开角度。

## 你的任务
用户输入一个前提，你的任务是找到多个可以展开的角度。

## 输出要求
- 只返回JSON，不要任何解释性文字
- 每个角度要有明显区分
- 要具体到人物身份和场景

返回格式：
{{
  "premise": "输入的前提",
  "angles": [
    {{
      "id": "a1",
      "title": "角度标题",
      "description": "角度描述",
      "persona": "适合的人设",
      "opening_line": "起手句"
    }}
  ]
}}"""

REWRITE_SYSTEM = """你是一个专注于脱口秀内容优化的AI助手，采用「单口喜剧优秀编剧」角色进行改稿。

## 你的任务
用户输入一段草稿或段子，你的任务是分析并优化。

## 输出要求
- 只返回JSON，不要任何解释性文字
- 指出问题所在
- 提供优化后的版本

返回格式：
{{
  "problems": ["问题1", "问题2"],
  "rewritten": "优化后的段子",
  "changes": [
    {{"original": "原句", "improved": "新句", "reason": "原因"}}
  ]
}}"""


# ─── LLM Call ─────────────────────────────────────────────────────────────────

async def _call_llm(system: str, user: str, api_key: str, model: str = "deepseek-chat") -> str:
    """Call LLM and return content string."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(150.0)) as client:
        r = await client.post(
            f"https://api.deepseek.com/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.3,
                "max_tokens": 3000,
            },
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


# ─── API Endpoints ────────────────────────────────────────────────────────────

@router.post("/joke-to-premise", response_model=JokeToPremiseResponse)
async def joke_to_premise(req: WriteRequest):
    """输入一句梗，反推3-5条前提候选 — 走 LLM Gateway 多模型回退"""
    if len(req.text) < 5:
        raise HTTPException(400, "梗太短了（至少5个字）")

    request_id = new_request_id("wt_jtp")
    set_request_context(request_id, "write/joke-to-premise")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    user_prompt = JOKE_TO_PREMISE_USER_TPL.format(
        text=req.text,
        topic=req.topic or "不限定",
        style=req.style or "不限定",
        scene=req.scene or "standup",
        depth=req.depth or "premise_with_setup",
    )

    try:
        result = gateway.generate(LLMRequest(
            scene="write_joke_to_premise",
            messages=[
                LLMMessage(role="system", content=JOKE_TO_PREMISE_SYSTEM),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,
            stream=False,
            request_id=request_id,
        ))
        if result.error:
            raise HTTPException(500, result.error)

        content = re.sub(r"<thinking>.*?</thinking>", "", result.content, flags=re.DOTALL)
        parsed = _extract_json(content)
        if not parsed:
            raise HTTPException(500, f"Parse failed: {result.content[:200]}")

        return JokeToPremiseResponse(
            request_id=request_id,
            input_type=parsed.get("input_type", "joke_line"),
            analysis=JokeAnalysis(**parsed["analysis"]) if parsed.get("analysis") else None,
            premises=[PremiseCandidate(**p) for p in parsed.get("premises", [])],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"joke_to_premise error: {exc}")
        return JokeToPremiseResponse(
            request_id=request_id,
            input_type="unknown",
            premises=[],
            error=str(exc),
        )


@router.post("/premise-extract")
async def premise_extract(req: WriteRequest):
    """从素材提炼前提 — 走 LLM Gateway 多模型回退"""
    if len(req.text) < 10:
        raise HTTPException(400, "素材太短了（至少10个字）")

    request_id = new_request_id("wt_pe")
    set_request_context(request_id, "write/premise-extract")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    user_prompt = f"素材：\n{req.text}\n\n请提炼核心前提，按指定JSON格式返回。"

    try:
        result = gateway.generate(LLMRequest(
            scene="write_premise_extract",
            messages=[
                LLMMessage(role="system", content=PREMISE_EXTRACT_SYSTEM),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,
            stream=False,
            request_id=request_id,
        ))
        if result.error:
            raise HTTPException(500, result.error)

        parsed = _extract_json(result.content)
        if not parsed:
            raise HTTPException(500, f"Parse failed: {result.content[:200]}")
        return parsed
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"premise_extract error: {exc}")
        return {"error": str(exc)}


@router.post("/find-angle")
async def find_angle(req: WriteRequest):
    """为一个前提找多个角度 — 走 LLM Gateway 多模型回退"""
    if len(req.text) < 5:
        raise HTTPException(400, "前提太短了（至少5个字）")

    request_id = new_request_id("wt_fa")
    set_request_context(request_id, "write/find-angle")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    user_prompt = f"前提：{req.text}\n\n请找多个展开角度，按指定JSON格式返回。"

    try:
        result = gateway.generate(LLMRequest(
            scene="write_find_angle",
            messages=[
                LLMMessage(role="system", content=FIND_ANGLE_SYSTEM),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,
            stream=False,
            request_id=request_id,
        ))
        if result.error:
            raise HTTPException(500, result.error)

        parsed = _extract_json(result.content)
        if not parsed:
            raise HTTPException(500, f"Parse failed: {result.content[:200]}")
        return parsed
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"find_angle error: {exc}")
        return {"error": str(exc)}


@router.post("/rewrite")
async def rewrite(req: WriteRequest):
    """改稿 — 走 LLM Gateway 多模型回退"""
    if len(req.text) < 10:
        raise HTTPException(400, "段子太短了（至少10个字）")

    request_id = new_request_id("wt_rw")
    set_request_context(request_id, "write/rewrite")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    user_prompt = f"段子：\n{req.text}\n\n请分析并改写，按指定JSON格式返回。"

    try:
        result = gateway.generate(LLMRequest(
            scene="write_rewrite",
            messages=[
                LLMMessage(role="system", content=REWRITE_SYSTEM),
                LLMMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,
            stream=False,
            request_id=request_id,
        ))
        if result.error:
            raise HTTPException(500, result.error)

        parsed = _extract_json(result.content)
        if not parsed:
            raise HTTPException(500, f"Parse failed: {result.content[:200]}")
        return parsed
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"rewrite error: {exc}")
        return {"error": str(exc)}
