"""
输入类型识别 API
识别用户输入的是素材、前提、梗、还是草稿
"""
import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..llm import get_stream_gateway, LLMRequest, LLMMessage
from ..utils.logging import new_request_id, set_request_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["detect-input"])


SYSTEM_PROMPT = """
你是一个脱口秀内容分类器。根据用户输入的文本，判断它属于以下哪种类型：

1. **material（素材）**: 原始素材/事件/观察/情绪。
   - 特征：没有明确结论，描述一件事、一个场景、一种感受
   - 示例："我发现同事离职后工位像被回收了一样"、"我妈总觉得我写脱口秀不算正经工作"

2. **premise（前提）**: 已有判断或结论的前提。
   - 特征：有明确的观点或判断，像"我觉得..."、"...的事实是..."
   - 示例："成年人的体面就是把委屈说成释然"、"相亲市场上最值钱的是正常"

3. **punchline（梗）**: 纯梗/金句/吐槽句。
   - 特征：短句，无铺垫，直接是笑点或吐槽（通常10字以内）
   - 示例："我不是不想努力，是努力的方向选错了"、"加班到十点不是努力，是效率低"

4. **draft（草稿）**: 完整段子/草稿。
   - 特征：有结构、有铺垫、有节奏，像可以上台表演的文本，至少3句以上

## 输出格式（严格返回JSON，不要输出其他内容）
{
  "input_type": "material",
  "confidence": 0.85,
  "reason": "一段关于同事离职后工位被回收的观察性素材",
  "recommended_next_step": "提炼前提"
}
"""

def _build_user_prompt(text: str) -> str:
    return f"请分析以下文本，判断它的类型：\n\n{text}"


class DetectInputRequest(BaseModel):
    text: str


@router.post("/detect-input")
async def detect_input(req: DetectInputRequest):
    """Non-streaming 输入类型检测"""
    text = req.text.strip()
    if len(text) < 5:
        raise HTTPException(400, "Text too short (min 5 chars)")

    request_id = new_request_id("di")
    set_request_context(request_id, "detect-input")

    gateway = get_stream_gateway()

    result = {
        "input_type": "material",
        "confidence": 0.5,
        "reason": "默认素材",
        "recommended_next_step": "提炼前提"
    }
    collected = ""

    async for chunk in gateway.generate(LLMRequest(
        scene="detect_input",
        messages=[
            LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
            LLMMessage(role="user", content=_build_user_prompt(text)),
        ],
        temperature=0.0,
        stream=True,
        request_id=request_id,
    )):
        collected += chunk

    # Parse the final JSON from the done event in collected
    try:
        # Find the 'event: done' line and extract the JSON from the next line
        lines = collected.split('\n')
        json_text = ""
        for i, line in enumerate(lines):
            if line.strip() == "event: done" and i + 1 < len(lines):
                data_line = lines[i + 1].strip()
                if data_line.startswith("data:"):
                    json_text = data_line[5:].strip()
                    break

        if json_text:
            done_obj = json.loads(json_text)
            parsed = done_obj.get("result", {})
            result = {
                "input_type": parsed.get("input_type", "material"),
                "confidence": float(parsed.get("confidence", 0.5)),
                "reason": parsed.get("reason", ""),
                "recommended_next_step": parsed.get("recommended_next_step", "提炼前提"),
            }
        else:
            logger.warning(f"[detect-input] no done event found, collected: {collected[:400]}")
    except Exception:
        logger.warning(f"[detect-input] parse failed: {collected[:200]}")

    return result