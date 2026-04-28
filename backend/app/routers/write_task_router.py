"""
Phase 6-7 缺失端点：draft/stream 和 premise-check/stream
"""
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..llm import get_stream_gateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context
from .auth import _current_user
from ..database import SessionLocal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/write", tags=["write-task"])


_COMMON_STREAM_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


# ─── Prompt ──────────────────────────────────────────────────────────────────────

DRAFT_SYSTEM = """
你是一个专注于脱口秀内容创作的AI编剧，擅长将一个前提展开为完整的段子草稿。

## 你的任务
用户给出一个喜剧前提（premise）和一个切入角度（angle），你的任务是基于这些信息生成一个可上台表演的段子草稿。

## 工作流程
1. 分析前提和角度的核心喜剧价值
2. 设计段子结构（铺垫 → 递进 → 收尾）
3. 加入具体的场景、对话、细节
4. 植入笑点技巧（观察/类比/反转/夸张）
5. 给出一个收尾方向

## 输出格式（严格JSON）
{
  "premise": "输入的前提",
  "angle": "输入的角度",
  "type": "观察式/观点类/故事类",
  "structure": "铺垫,递进,收尾",
  "segments": [
    {
      "text": "段子原文",
      "structure": "铺垫/递进/反转/收尾",
      "technique": "使用的喜剧技巧",
      "laugh_point": "笑点位置说明"
    }
  ],
  "full_draft": "完整草稿全文",
  "estimated_duration": "预计时长（分钟）",
  "stage_direction": "舞台调度建议",
  "ending_suggestion": "结尾方向建议"
}
"""


PREMISE_CHECK_SYSTEM = """
你是一个专注于脱口秀内容评估的AI编剧，擅长判断一个前提是否是好前提，并提供改进建议。

## 你的任务
用户给出一个前提，你的任务是评估这个前提的喜剧价值，判断它是否值得展开，并给出改进建议。

## 评估标准
1. **有判断** — 有一句明确的观点或立场，不是泛泛而谈
2. **有矛盾** — 包含某种荒谬或冲突，有喜剧张力
3. **可延展** — 可以写出场景、对话、细节
4. **有独特视角** — 不是所有人都能说出来的，要有个人的独特角度
5. **适合舞台** — 像人话，不是写文章，口语化
6. **有意外感** — 听众能感到意外或惊喜

## 输出格式（严格JSON）
{
  "score": 1-10,
  "verdict": "pass/fail/needs_work",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["问题1", "问题2"],
  "improvement_suggestions": ["建议1", "建议2"],
  "comedy_potential": "喜剧潜力描述",
  "recommended_angle": "建议的切入角度",
  "comparable_premises": ["可类比的成熟前提1", "可类比的成熟前提2"],
  "final_verdict": "一句话最终评价"
}
"""


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _stream_llm(scene: str, system: str, user: str, request_id: str, user_id: str | None = None) -> AsyncGenerator[str, None]:
    """通用 stream_gateway 调用 generator"""
    from ..llm.user_model_resolver import resolve_user_model_runtime
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

@router.post("/draft/stream")
async def draft_stream(req: dict, request: Request):
    """写段子草稿（流式）— 输入 premise + angle，返回完整草稿"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None

    premise = req.get("premise", "").strip()
    angle = req.get("angle", "").strip()

    if len(premise) < 3:
        raise HTTPException(400, "前提太短了（至少3字）")
    if len(angle) < 2:
        raise HTTPException(400, "角度信息不足（至少2字）")

    request_id = new_request_id("wd")
    set_request_context(request_id, "write/draft/stream")

    user_prompt = f"前提：\n{premise}\n\n切入角度：\n{angle}\n\n请严格按JSON格式输出，不要输出任何Schema以外的文字。"

    return StreamingResponse(
        _stream_llm("write_draft", DRAFT_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )


@router.post("/premise-check/stream")
async def premise_check_stream(req: dict, request: Request):
    """前提质量检测（流式）— 输入前提，返回评估结果"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None

    text = req.get("text", "").strip() or req.get("premise", "").strip()
    if len(text) < 3:
        raise HTTPException(400, "前提太短了（至少3字）")

    request_id = new_request_id("wpc")
    set_request_context(request_id, "write/premise-check/stream")

    user_prompt = f"请评估以下脱口秀前提的质量：\n\n{text}\n\n请严格按JSON格式输出，不要输出任何Schema以外的文字。"

    return StreamingResponse(
        _stream_llm("write_premise_check", PREMISE_CHECK_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )
