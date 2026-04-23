"""
梗写前提 API
输入：一句梗/包袱句/吐槽句
输出：梗拆解分析 + 3-5条前提候选

全部模型调用统一走 LLM Gateway（TokenHub 多模型自动回退）
"""
import json
import logging
import re
import time
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..utils.logging import api_logger, llm_logger, new_request_id, set_request_context, get_request_id
from ..utils.errors import _classify_error
from ..llm import llm_gateway, LLMRequest, LLMMessage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["joke-to-premise"])


# ─── Request / Response Schemas ──────────────────────────────────────────────


class JokeToPremiseRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=500, description="一句梗/包袱句/吐槽句")
    topic: Optional[str] = Field(None, description="主题偏好：职场/亲密关系/日常生活等")
    style: Optional[str] = Field(None, description="风格偏好：自嘲/毒舌/冷幽默等")
    depth: Optional[str] = Field(
        default="premise_only",
        description="输出深度：premise_only | premise_with_setup | premise_with_draft",
    )
    scene: Optional[str] = Field(default="standup", description="表达场景：standup | short_video | social_post")


# ─── Prompt Templates ─────────────────────────────────────────────────────────

JOKE_ANALYSIS_SYSTEM = """你是一个中文脱口秀创作助手。

用户会输入一句梗、包袱句、类比句或吐槽句。
你的任务是将这句话拆解成结构化的创作素材。

请分析并输出以下字段（JSON格式）：
{
  "input_type": "joke_line" | "topic_line" | "raw_material" | "long_draft" | "unknown",
  "joke_type": "类比型" | "反差型" | "结论型" | "夸张型" | "角色错位型" | "情绪判断型" | "unknown",
  "core_topic": "一句话概括这个梗在说什么主题",
  "core_conflict": "核心冲突是什么",
  "comparison_target": "如果是类比型，类比的对象是什么",
  "emotion": ["情绪关键词1", "情绪关键词2"],
  "persona_candidates": ["适合说这句话的人设1", "人设2"],
  "humor_mechanism": "一句话描述这个梗的笑点是怎么产生的",
  "suggestion": "如果输入不像梗而像素材/主题，给出简短建议；否则为null"
}

要求：
- 只输出JSON，不要输出任何解释
- input_type 必须准确判断
- emotion 最多3个
- persona_candidates 最多3个"""


JOKE_ANALYSIS_USER = """分析这句梗：

{text}

{topic_hint}
{style_hint}"""


PREMISE_GENERATION_SYSTEM = """你是一个中文脱口秀创作助手。

用户的输入是一句已经成立的梗/包袱句。
基于前一步的拆解结果，你需要生成3-5条不同角度的前提候选。

每条前提应该：
- 有独特的切入角度（自嘲/社会观察/行业视角/人物物关系/角色错位等）
- 能让观众产生共鸣
- 有具体的铺垫方向和起手句
- 口语化、可直接上台讲

每条输出格式（JSON数组）：
[
  {{
    "id": "p1",
    "title": "前提标题（15字以内，有冲击力）",
    "why_it_works": "为什么这个前提好笑，30字以内",
    "setup_direction": "怎么铺垫，50字以内，要有具体场景和人物",
    "persona": "适合什么人设来说，10字以内",
    "emotion": "情绪色彩，5字以内",
    "opening_line": "一句可直接开场的起手句，20字以内，口语化"
  }},
  ...共3-5条
]

要求：
- 只输出JSON数组，不要有任何解释
- 每条角度必须明显不同
- 要有具体人物、场景、动作，不要空泛
- opening_line必须像人说的话，不是写作文的句子
- 如果前一步的suggestion不为null，优先按那个方向生成"""


PREMISE_GENERATION_USER = """梗：{text}

拆解结果：
- 梗类型：{joke_type}
- 核心主题：{core_topic}
- 核心冲突：{core_conflict}
- 情绪：{emotion}
- 笑点机制：{humor_mechanism}
- 适合人设：{persona}

生成3-5条差异化前提候选。"""


# ─── JSON Extraction ──────────────────────────────────────────────────────────


def _extract_json(text: str):
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
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
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
                    complete_jsons.append(json.loads(text[json_start : i + 1]))
                except json.JSONDecodeError:
                    pass
                json_start = -1
    if complete_jsons:
        return complete_jsons[-1]
    return None


# ─── Stream Generator ─────────────────────────────────────────────────────────


async def _stream_joke_to_premise(req: JokeToPremiseRequest):
    request_id = new_request_id("jtp")
    set_request_context(request_id, "joke-to-premise")
    _json = json.dumps

    topic_hint = f"主题偏好：{req.topic}" if req.topic else ""
    style_hint = f"风格偏好：{req.style}" if req.style else ""

    # ── Phase 1: 梗拆解 ───────────────────────────────────────────────────────
    analysis_user = JOKE_ANALYSIS_USER.format(
        text=req.text,
        topic_hint=topic_hint,
        style_hint=style_hint,
    ).strip()

    yield f"event: progress\ndata: {_json({'phase': 'analyzing', 'message': '正在拆解梗...', 'request_id': request_id})}\n\n"

    llm_logger.log_start("jtp_phase1_analysis", model="multi", provider="tokenhub")
    start_phase1 = time.time()

    try:
        gateway = llm_gateway()
        analysis_result_raw = await gateway.generate(LLMRequest(
            scene="joke_to_premise_phase1",
            messages=[
                LLMMessage(role="system", content=JOKE_ANALYSIS_SYSTEM.strip()),
                LLMMessage(role="user", content=analysis_user),
            ],
            temperature=1.0,
            stream=False,
            request_id=request_id,
        ))
        if analysis_result_raw.error:
            duration_phase1 = int((time.time() - start_phase1) * 1000)
            llm_logger.log_done("jtp_phase1_analysis", duration_phase1, error_code="ANALYSIS_FAILED", retryable=True)
            yield f"event: error\ndata: {_json({'error': analysis_result_raw.error, 'request_id': request_id, 'error_code': 'ANALYSIS_FAILED', 'retryable': True, 'selected_model': analysis_result_raw.selected_model, 'attempt_count': analysis_result_raw.attempt_count})}\n\n"
            return
        analysis_result = _extract_json(analysis_result_raw.content)
        if not analysis_result:
            duration_phase1 = int((time.time() - start_phase1) * 1000)
            llm_logger.log_done("jtp_phase1_analysis", duration_phase1, error_code="PARSE_FAILED", retryable=True)
            yield f"event: error\ndata: {_json({'error': '解析失败，请稍后重试', 'request_id': request_id, 'error_code': 'PARSE_FAILED', 'retryable': True})}\n\n"
            return
    except Exception as exc:
        duration_phase1 = int((time.time() - start_phase1) * 1000)
        llm_logger.log_done("jtp_phase1_analysis", duration_phase1, error_code="PHASE1_EXC", retryable=True)
        yield f"event: error\ndata: {_json({'error': _classify_error(exc), 'request_id': request_id, 'error_code': 'PHASE1_EXC', 'retryable': True})}\n\n"
        return

    duration_phase1 = int((time.time() - start_phase1) * 1000)
    llm_logger.log_done("jtp_phase1_analysis", duration_phase1)

    # Emit analysis phase
    yield f"event: analysis\ndata: {_json(analysis_result)}\n\n"

    # Check if input type is not a joke - warn user
    input_type = analysis_result.get("input_type", "unknown")
    if input_type in ("topic_line", "raw_material", "long_draft"):
        suggestion = analysis_result.get("suggestion")
        if suggestion:
            yield f"event: warning\ndata: {_json({'message': suggestion, 'input_type': input_type})}\n\n"

    # ── Phase 2: 前提生成 ────────────────────────────────────────────────────
    yield f"event: progress\ndata: {_json({'phase': 'generating', 'message': '正在生成前提候选...', 'request_id': request_id})}\n\n"

    premise_user = PREMISE_GENERATION_USER.format(
        text=req.text,
        joke_type=analysis_result.get("joke_type", "unknown"),
        core_topic=analysis_result.get("core_topic", ""),
        core_conflict=analysis_result.get("core_conflict", ""),
        emotion=", ".join(analysis_result.get("emotion", [])[:2]),
        humor_mechanism=analysis_result.get("humor_mechanism", ""),
        persona=", ".join(analysis_result.get("persona_candidates", [])[:2]),
    )

    llm_logger.log_start("jtp_phase2_premise", model="multi", provider="tokenhub")
    start_phase2 = time.time()

    try:
        gateway = llm_gateway()
        premises_result_raw = await gateway.generate(LLMRequest(
            scene="joke_to_premise_phase2",
            messages=[
                LLMMessage(role="system", content=PREMISE_GENERATION_SYSTEM.strip()),
                LLMMessage(role="user", content=premise_user),
            ],
            temperature=1.0,
            stream=False,
            request_id=request_id,
        ))
        if premises_result_raw.error:
            duration_phase2 = int((time.time() - start_phase2) * 1000)
            llm_logger.log_done("jtp_phase2_premise", duration_phase2, error_code="PREMISE_FAILED", retryable=True)
            yield f"event: error\ndata: {_json({'error': premises_result_raw.error, 'request_id': request_id, 'error_code': 'PREMISE_FAILED', 'retryable': True, 'selected_model': premises_result_raw.selected_model, 'attempt_count': premises_result_raw.attempt_count})}\n\n"
            return

        premises_result = _extract_json(premises_result_raw.content)
        if not premises_result:
            duration_phase2 = int((time.time() - start_phase2) * 1000)
            llm_logger.log_done("jtp_phase2_premise", duration_phase2, error_code="PARSE_FAILED", retryable=True)
            yield f"event: error\ndata: {_json({'error': '解析失败，请稍后重试', 'request_id': request_id, 'error_code': 'PARSE_FAILED', 'retryable': True})}\n\n"
            return

    except Exception as exc:
        duration_phase2 = int((time.time() - start_phase2) * 1000)
        llm_logger.log_done("jtp_phase2_premise", duration_phase2, error_code="PHASE2_EXC", retryable=True)
        yield f"event: error\ndata: {_json({'error': _classify_error(exc), 'request_id': request_id, 'error_code': 'PHASE2_EXC', 'retryable': True})}\n\n"
        return

    duration_phase2 = int((time.time() - start_phase2) * 1000)
    llm_logger.log_done("jtp_phase2_premise", duration_phase2)

    # Ensure we have a list
    if isinstance(premises_result, dict):
        if "premises" in premises_result:
            premises = premises_result["premises"]
        elif "result" in premises_result:
            premises = premises_result["result"]
        else:
            premises = premises_result
    elif isinstance(premises_result, list):
        premises = premises_result
    else:
        premises = []

    # Normalize each premise
    normalized = []
    for i, p in enumerate(premises[:5], 1):
        if isinstance(p, dict):
            normalized.append({
                "id": p.get("id", f"p{i}"),
                "title": p.get("title", "前提" + str(i)),
                "why_it_works": p.get("why_it_works", ""),
                "setup_direction": p.get("setup_direction", ""),
                "persona": p.get("persona", ""),
                "emotion": p.get("emotion", ""),
                "opening_line": p.get("opening_line", ""),
            })

    if not normalized:
        yield f"event: error\ndata: {_json({'error': '生成前提失败，请重试', 'request_id': request_id, 'error_code': 'NORMALIZE_FAILED', 'retryable': True})}\n\n"
        return

    # ── Done ──────────────────────────────────────────────────────────────────
    total_duration = int((time.time() - start_phase1) * 1000)
    llm_logger.log_done("jtp_total", total_duration)
    final = {
        "request_id": request_id,
        "input_type": input_type,
        "analysis": analysis_result,
        "premises": normalized,
    }
    yield f"event: done\ndata: {_json(final)}\n\n"


# ─── API Routes ───────────────────────────────────────────────────────────────


@router.post("/joke-to-premise")
async def joke_to_premise(req: JokeToPremiseRequest):
    """
    梗写前提 - 输入一句梗，反推多个可能成立的前提

    SSE 事件流：
      progress → 阶段提示
      analysis → 梗拆解结果
      warning  → 输入类型警告（可选）
      done     → 最终结果
      error    → 错误（带 error_code / retryable / selected_model / attempt_count）
    """
    if len(req.text.strip()) < 3:
        raise HTTPException(400, "请输入一句完整的梗（至少3个字）")

    return StreamingResponse(
        _stream_joke_to_premise(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )