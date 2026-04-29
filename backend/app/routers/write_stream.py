"""
统一流式写作 API（Task 4）
所有 /api/write/*/stream 端点统一使用 stream_gateway，输出标准 SSE 协议。

SSE 事件类型（全部 JSON data）：
  event: progress → {"type":"progress","phase":"...","message":"...","request_id":"..."}
  event: token    → {"type":"token","content":"汉字内容"}
  event: done     → {"type":"done","result":{...},"_meta":{...}}
  event: error    → {"type":"error","error":"...","error_code":"...","retryable":true,"_meta":{...}}
  event: meta     → {"type":"meta","selected_model":"...","provider":"...","request_id":"...","attempt_count":1,"total_latency_ms":1234,"scene":"..."}
"""
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..config import settings
from ..llm import get_stream_gateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context
from .auth import _current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/write", tags=["write-stream"])

_COMMON_STREAM_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


# ─── Shared prompts (imported from existing routers for consistency) ─────────────

PREMISE_SYSTEM = """
你是一个专注于脱口秀内容创作的AI编剧，擅长从真实素材中提炼出最有喜剧价值的前提。

## 你的任务
用户会输入一段素材（可能是一件事、一句抱怨、一个观察、一段情绪），你的任务是将它转化为一组可以上台说的喜剧前提。

## 工作流程
1. 识别素材本质（主题/态度/核心矛盾）
2. 生成5个前提候选（直给型/观点型/观察型/更狠型/自嘲型）
3. 推荐最优前提
4. 给出后续建议

## 输出格式（严格JSON）
{
  "theme": "主题识别结果",
  "attitude": "态度识别结果",
  "conflict": "核心矛盾",
  "premise_candidates": [
    {"text": "前提1", "type": "直给型", "description": "特点"},
    {"text": "前提2", "type": "观点型", "description": "特点"},
    {"text": "前提3", "type": "观察型", "description": "特点"},
    {"text": "前提4", "type": "更狠型", "description": "特点"},
    {"text": "前提5", "type": "自嘲型", "description": "特点"}
  ],
  "recommendation": {
    "text": "推荐的前提",
    "reason": "推荐理由",
    "best_type": "观察式/观点式/故事式"
  },
  "scene_suggestions": ["场景1", "场景2", "场景3"],
  "expansion_directions": ["方向1", "方向2"],
  "ending_direction": "适合的结尾方向"
}
"""


ANGLES_SYSTEM = """
你是一个专注于脱口秀内容创作的AI编剧，擅长为一个普通前提找到更新鲜、更狠、更有喜剧价值的切入角度。

## 工作流程
1. 判断当前前提的问题（太泛/太直给/缺少人物感/缺少冲突/缺少意外/缺少场景）
2. 生成6个新角度（反常识/人性/权力关系/自嘲/类比/更狠）
3. 推荐最优角度

## 输出格式（严格JSON）
{
  "current_problem": {
    "issues": ["问题1", "问题2"],
    "summary": "核心问题概括"
  },
  "angles": [
    {
      "name": "角度名称",
      "premise": "重构后的新前提",
      "expansion_idea": "展开思路",
      "scene_direction": "适合的场景",
      "ending_direction": "适合的结尾"
    }
  ],
  "recommendation": {
    "name": "推荐的角度名称",
    "reason": "推荐理由"
  }
}
"""


REWRITE_SYSTEM = """
你是一个专注于脱口秀内容创作与优化的AI助手，以「单口喜剧优秀编剧」角色进行分析。

## 工作流程
1. 段子结构拆解（态度/主题/前提/结构/缺点/修改意见）
2. 生成新版本文稿（整合修改意见/重构/增加元素/个性化调整/综合评估）

## 输出格式（严格JSON）
{
  "evaluation": {
    "观点和立场": "一句话描述",
    "紧扣主题": "一句话描述",
    "前提清晰": "一句话描述",
    "语言幽默精炼": "一句话描述",
    "包含转折和惊喜": "一句话描述",
    "情感共鸣": "一句话描述",
    "展现个性": "一句话描述",
    "结构完整": "一句话描述"
  },
  "performer_tags": ["标签1"],
  "premise": "核心前提",
  "theme_refined": "细化后的主题",
  "comedy_type": "观察式/观点类/故事类",
  "structures": "铺垫,递进,收尾",
  "techniques": ["观察", "类比", "反转"],
  "segments": [
    {
      "text": "原文",
      "structure": "铺垫/递进/反转/收尾",
      "attitude": "态度",
      "theme": "主题",
      "premise": "前提",
      "techniques": ["技巧"],
      "problem": "缺点"
    }
  ],
  "improved_script": "优化版全文",
  "script_changes": [
    {
      "location": "位置",
      "original": "原句",
      "improved": "新句",
      "reason": "原因",
      "technique_added": "加入的技巧"
    }
  ],
  "style_hints": ["风格提示"],
  "next_suggestion": "下一步建议"
}
"""


# ─── Joke-to-premise combined prompt (single stream, no two-phase) ──────────────

JOKE_TO_PREMISE_SYSTEM = """
你是一个中文脱口秀创作助手。用户输入一句梗/包袱句/吐槽句，你需要将其拆解并生成3-5条不同角度的前提候选。

## 输出格式（严格JSON）
{
  "input_type": "joke_line/topic_line/raw_material",
  "joke_type": "类比型/反差型/结论型/夸张型/角色错位型/情绪判断型",
  "core_topic": "一句话概括主题",
  "core_conflict": "核心冲突",
  "comparison_target": "类比对象（如有）",
  "emotion": ["情绪词1", "情绪词2"],
  "persona_candidates": ["人设1", "人设2"],
  "humor_mechanism": "笑点机制描述",
  "premises": [
    {
      "id": "p1",
      "title": "前提标题（15字以内）",
      "why_it_works": "好笑原因（30字以内）",
      "setup_direction": "铺垫方向（50字以内）",
      "persona": "适合人设（10字以内）",
      "emotion": "情绪色彩（5字以内）",
      "opening_line": "开场句（20字以内）"
    }
  ],
  "recommendation": {
    "title": "推荐前提标题",
    "reason": "推荐理由"
  }
}
"""


# ─── Route helpers ──────────────────────────────────────────────────────────────

async def _stream_llm(scene: str, system: str, user: str, request_id: str, user_id: str | None = None) -> AsyncGenerator[str, None]:
    """通用 stream_gateway 调用 generator。
    
    user_id 非空时会解析用户自填模型配置，优先使用。
    """
    from app.llm.user_model_resolver import resolve_user_model_runtime
    user_runtime = resolve_user_model_runtime(user_id) if user_id else None
    gateway = get_stream_gateway(user_model_runtime=user_runtime)
    async for chunk in gateway.generate(LLMRequest(
        scene=scene,
        messages=[
            LLMMessage(role="system", content=system.strip()),
            LLMMessage(role="user", content=user.strip()),
        ],
        temperature=1.0,
        stream=True,
        request_id=request_id,
        user_id=user_id,
    )):
        yield chunk


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.post("/premise/stream")
async def premise_stream(req: dict, request: Request):
    """提炼前提（流式）— 统一端点"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None
    text = (req.get("text") or req.get("material") or "").strip()
    if len(text) < 3:
        raise HTTPException(400, "素材太短了（至少3字）")

    request_id = new_request_id("wp")
    set_request_context(request_id, "write/premise/stream")

    user_prompt = f"素材：\n{text}\n\n请严格按JSON格式输出，不要输出任何Schema以外的文字。"

    return StreamingResponse(
        _stream_llm("write_premise", PREMISE_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )


@router.post("/joke-to-premise/stream")
async def joke_to_premise_stream(req: dict, request: Request):
    """梗写前提（流式）— 统一端点，单一 prompt"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None
    text = (req.get("text") or req.get("joke") or "").strip()
    if len(text) < 3:
        raise HTTPException(400, "请输入一句完整的梗（至少3个字）")

    topic = req.get("topic") or ""
    style = req.get("style") or ""

    request_id = new_request_id("wjtpc")
    set_request_context(request_id, "write/joke-to-premise/stream")

    topic_hint = f"主题偏好：{topic}" if topic else ""
    style_hint = f"风格偏好：{style}" if style else ""
    user_prompt = f"分析这句梗：\n{text}\n\n{topic_hint}\n{style_hint}\n\n请严格按JSON格式输出。"

    return StreamingResponse(
        _stream_llm("write_joke_to_premise", JOKE_TO_PREMISE_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )


@router.post("/angles/stream")
async def angles_stream(req: dict, request: Request):
    """找角度（流式）— 统一端点"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None
    premise = (req.get("premise") or req.get("text") or "").strip()
    if len(premise) < 2:
        raise HTTPException(400, "输入的前提太短了（至少2个字）")

    request_id = new_request_id("wfa")
    set_request_context(request_id, "write/angles/stream")

    user_prompt = f"前提：\n{premise}\n\n请严格按JSON格式输出，不要输出任何Schema以外的文字。"

    return StreamingResponse(
        _stream_llm("write_angles", ANGLES_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )


@router.post("/rewrite/stream")
async def rewrite_stream(req: dict, request: Request):
    """改稿分析（流式）— 统一端点"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None
    text = (req.get("text") or req.get("draft") or "").strip()
    if len(text) < 20:
        raise HTTPException(400, "段子内容太短了（至少20字）")

    request_id = new_request_id("wrw")
    set_request_context(request_id, "write/rewrite/stream")

    user_prompt = f"段子内容：\n{text}\n\n用单口喜剧优秀编剧的视角进行深度分析，严格按Schema格式返回JSON，不要输出Schema以外任何文字。"

    return StreamingResponse(
        _stream_llm("write_rewrite", REWRITE_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )
