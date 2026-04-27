"""
上台口语化版 API
将段子/草稿转化为适合上台表演的口语化版本
"""
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ..llm import get_stream_gateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["stage-version"])


SYSTEM_PROMPT = """
你是一个专业脱口秀演员和编剧，擅长将段子文本转化为适合上台表演的口语化版本。

## 你的任务
将输入的段子/草稿转化为上台表演版本，同时标注表演提示。

## 转化要求

### 口语化规则
1. 删除书面表达：因此、然而、综上所述、因而、于是
2. 短句为主：每句话不超过15字，方便呼吸和节奏
3. 口语化：像人说话，不是写作文

### 标注规则（用于标注表演提示）
- 停顿：`（停顿）` 或 `（长停顿）`
- 重音：`【重】`
- 笑点：`←笑点`
- 回扣：`【回扣】`
- call back：`【CB】`

### 不上价值原则
- 结尾不上价值、不升华
- 笑点结束后自然收束

## 输出格式
请严格按以下JSON格式输出，不要输出任何额外文字：
{
  "stage_version": "口语化版本全文（包含标注）",
  "annotations": [
    {"type": "pause", "position": 5, "text": "(停顿)", "note": "观众预期建立"},
    {"type": "stress", "position": 12, "text": "【重】", "note": "强调笑点"},
    {"type": "laugh", "position": 20, "text": "←笑点", "note": "此处应有笑声"},
    {"type": "callback", "position": 35, "text": "【CB】", "note": "呼应前面的call"}
  ],
  "stats": {
    "word_count": 280,
    "estimated_duration": "3分30秒",
    "punchline_count": 3
  }
}
"""


def _build_user_prompt(text: str) -> str:
    return (
        "以下是一段脱口秀段子/草稿，请转化为上台表演版本：\n\n"
        f"原文：\n{text}\n\n"
        "严格按JSON格式输出，不要有其他文字。"
    )


class StageVersionRequest(BaseModel):
    text: str


@router.post("/stage-version/stream")
async def stage_version_stream(req: StageVersionRequest):
    """上台口语化版流式 API"""
    text = req.text.strip()
    if len(text) < 10:
        raise HTTPException(400, "文本太短（至少10字）")

    request_id = new_request_id("sv")
    set_request_context(request_id, "stage-version/stream")

    gateway = get_stream_gateway()

    return StreamingResponse(
        _generate_stage_version(gateway, text, request_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _generate_stage_version(gateway, text: str, request_id: str):
    """
    Gateway already yields SSE-formatted events:
      event: token / event: done / event: error / event: meta
    We just yield them directly as the outer response.
    But we need to intercept the 'done' event to extract stage_version.
    """
    done_received = False

    async for raw_chunk in gateway.generate(LLMRequest(
        scene="stage_version",
        messages=[
            LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
            LLMMessage(role="user", content=_build_user_prompt(text)),
        ],
        temperature=0.7,
        stream=True,
        request_id=request_id,
    )):
        # Gateway yields pre-formatted SSE, just pass through
        if raw_chunk.startswith("event: done"):
            # Extract JSON from done event
            try:
                data_start = raw_chunk.index("data:") + len("data:")
                raw_json = raw_chunk[data_start:].strip()
                inner = json.loads(raw_json)
                # inner.result is the analyzed JSON from the prompt
                parsed = inner.get("result", {})
                if isinstance(parsed, str):
                    # Non-stream fallback returned plain text
                    stage_v = parsed
                    annotations = []
                    stats = {}
                else:
                    stage_v = parsed.get("stage_version", parsed.get("text", ""))
                    annotations = parsed.get("annotations", [])
                    stats = parsed.get("stats", {})
            except Exception:
                stage_v = ""
                annotations = []
                stats = {}

            done_payload = {
                "type": "done",
                "result": {
                    "stage_version": stage_v,
                    "annotations": annotations,
                    "stats": stats,
                }
            }
            done_line = f"event: done\ndata: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            yield done_line
            done_received = True
        else:
            # token / error / meta — pass through as-is
            yield raw_chunk

    if not done_received:
        error_payload = json.dumps({"type": "error", "error": "上游未返回结果"})
        yield f"event: error\ndata: {error_payload}\n\n"