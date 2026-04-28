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


PERFORMANCE_REVIEW_SYSTEM = """
你是一个资深脱口秀演员和编剧，专注于演后复盘分析。

## 你的任务
用户刚完成一场演出，提供了演出反馈（哪里笑了、哪里冷了、哪里忘了），你的任务是为他提供专业的复盘分析，告诉他下一版应该怎么改。

## 输入信息
用户会告诉你：
- 哪些部分获得了笑声/好的反应
- 哪些部分反应不好（冷场）
- 哪些部分忘记了/卡壳了
- 原始段子文本（如果有）

## 评估与改进维度
1. **笑点保留** — 哪些笑点有效，下一版要保留并加强
2. **铺垫问题** — 冷场的原因是什么（太快/太绕/缺乏情景）
3. **节奏问题** — 哪里太拖沓，哪里太赶
4. **记忆技巧** — 忘掉的部分怎么改才容易记住
5. **个人风格** — 哪些是你的独特优势，下一版要放大
6. **具体修改建议** — 逐段给出下一版的修改方向

## 输出格式（严格JSON）
{
  "what_worked": {
    "laugh_points": ["有效的笑点1", "有效的笑点2"],
    "why_it_worked": "这些笑点有效的原因分析",
    "keep_and_strengthen": ["要保留并加强的部分"]
  },
  "what_flopped": {
    "cold_spots": ["冷场的部分"],
    "root_cause": "冷场根本原因分析",
    "delete_or_revise": ["建议删除或重写的内容"]
  },
  "forgot_parts": {
    "locations": ["忘记/卡壳的位置"],
    "memory_tips": "帮助记忆的技巧建议"
  },
  "next_version_suggestions": [
    {
      "location": "位置/段落",
      "current_issue": "当前问题",
      "suggested_fix": "下一版建议修改方式",
      "reason": "修改原因"
    }
  ],
  "personal_style_notes": "关于你的个人风格的观察和建议",
  "overall_verdict": "一句话总结：这次演出最值得记住的是什么"
}
"""


@router.post("/performance-review/stream")
async def performance_review_stream(req: dict, request: Request):
    """演后复盘（流式）— 输入演出反馈，返回复盘分析"""
    from ..database import SessionLocal
    user = _current_user(request, SessionLocal())
    user_id = str(user.ulid) if user else None

    laugh_parts = req.get("laugh_parts", "").strip()
    flop_parts = req.get("flop_parts", "").strip()
    forgot_parts = req.get("forgot_parts", "").strip()
    original_script = req.get("original_script", "").strip()

    if not laugh_parts and not flop_parts:
        raise HTTPException(400, "请提供至少一段笑声反馈或冷场反馈")

    request_id = new_request_id("wpr")
    set_request_context(request_id, "write/performance-review/stream")

    prompt_parts = ["## 演出反馈\n"]
    if laugh_parts:
        prompt_parts.append(f"### 笑声部分（观众笑了）：\n{laugh_parts}\n")
    if flop_parts:
        prompt_parts.append(f"### 冷场部分（反应不好）：\n{flop_parts}\n")
    if forgot_parts:
        prompt_parts.append(f"### 忘记/卡壳的部分：\n{forgot_parts}\n")
    if original_script:
        prompt_parts.append(f"### 原始段子文本：\n{original_script}\n")

    user_prompt = "".join(prompt_parts) + "\n请严格按JSON格式输出，不要输出任何Schema以外的文字。"

    return StreamingResponse(
        _stream_llm("write_performance_review", PERFORMANCE_REVIEW_SYSTEM, user_prompt, request_id, user_id),
        media_type="text/event-stream",
        headers=_COMMON_STREAM_HEADERS,
    )
