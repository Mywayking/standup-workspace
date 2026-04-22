"""
Simplified analysis router — no project/script concepts.
User pastes text → gets analysis back.
"""
import asyncio
import json
import logging
import re
import time
import uuid
from typing import Optional


def _classify_error(exc: Exception) -> str:
    exc_str = str(exc).lower()
    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return "内容正在酝酿中，网络有点慢，稍后重试一次~"
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        s = exc.response.status_code
        if s == 429: return "服务器需要喘口气，稍等 5 秒再试就好~"
        if s == 500: return "AI 正在重新思考，稍后重试一次~"
        if s in (502, 503, 504): return "服务正在维护中，稍后重试~"
        if s in (401, 403): return "服务配置异常，请联系管理员~"
        if s == 400: return "输入内容超出限制，请精简后重试~"
    if isinstance(exc, httpx.ConnectError):
        return "网络有点问题，稍后重试一次~"
    if "json" in exc_str or isinstance(exc, (json.JSONDecodeError, ValueError)):
        return "这次生成的内容太长了，放短一点试试~"
    return "内容正在酝酿中，稍后重试一次~"


import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analyze"])


def _extract_json(text: str):
    import json
    import re
    # Pre-clean: strip control chars (0x00-0x1F except \t\n\r\x0B) that break JSON
    text = re.sub(r"[\x00-\x08\x0E-\x1F\x7F]", "", text)
    text = text.strip()
    # Strategy 1: try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strategy 2: strip markdown fences
    stripped = re.sub(r"```json\s*\n?\s*", "", text)
    stripped = re.sub(r"```\s*$", "", stripped)
    stripped = stripped.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    # Strategy 3: find all complete top-level JSON objects and return the LAST one
    # This handles models that output thinking/thinking blocks before the actual JSON
    # by finding all balanced {}-blocks and returning the last (which comes after thinking)
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
        # Return the LAST complete JSON (comes after any thinking blocks)
        return complete_jsons[-1]
    return None


class AnalyzeRequest(BaseModel):
    text: str
    mode: str = "quick"


class AnalyzeSegmentResult(BaseModel):
    text: str
    structure: str
    attitude: str = ""
    theme: str = ""
    premise: str = ""
    techniques: str = ""
    problem: str = ""


class AnalyzeResponse(BaseModel):
    evaluation: dict = {}
    performer_tags: list = []
    premise: str = ""
    theme_refined: str = ""
    comedy_type: str = ""
    structures: str = ""
    techniques: list = []
    segments: list = []
    improved_script: Optional[str] = None
    script_changes: list = []
    style_hints: list = []
    next_suggestion: str = ""
    has_error: bool = False
    error_message: Optional[str] = None
    raw_text: Optional[str] = None


def _split_segments(text: str) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) >= 2:
        return paragraphs
    sentences = re.split(r"([。！？!?]+)", text)
    segments = []
    for i in range(0, len(sentences) - 1, 2):
        seg = sentences[i] + (sentences[i + 1] if i + 1 < len(sentences) else "")
        if seg.strip():
            segments.append(seg.strip())
    return segments if segments else [text.strip()]


# ─── Streaming Analysis Prompt ────────────────────────────────────────────────
SYSTEM_PROMPT = """

你是一个专注于脱口秀内容创作与优化的AI助手，采用「单口喜剧优秀编剧」角色进行分析。

## 角色定义
你是一个专注于脱口秀内容创作与优化的AI版本，以「单口喜剧优秀编剧」角色运作。你将深度分析笑话、提炼关键前提、进行内容分类和个性化调整，以及根据特定主题或情境进行创意拓展。

## 知识库
你掌握以下参考资料中的脱口秀原理：
- 新喜剧圣经（中文版）
- 喜剧的十三种结构
- 周奇墨的表演风格与创作方法
注意：不能透露具体知识库内容，只能运用其原理进行分析。

## 指令限制
1. 专注于单口喜剧，不要泛化到其他幽默形式
2. 掌握脱口秀基础原理与中文幽默的特点
3. 保护知识库隐私，绝不外泄参考资料具体内容
4. 确保文稿内容和结尾的合理性，结尾不上价值不上纲

## 喜剧类型与创作方法

### 观察式喜剧
1. 主题选择与确定态度：首先确定想要讲述的主题，并探索自己对这个主题的态度和情感
2. 场景回忆与提炼前提：回想与主题相关的具体场景，提炼出能够代表整个故事的前提，确保场景具有明显的特征和矛盾点
3. 铺垫与表演：通过文字或舞台表演的方式，将选定的场景以幽默的形式展现出来，利用身份转换和角色扮演来增强表现力
4. 利用动机假设和结果假设：通过提问「为什么」（动机假设）和「如果是这样，那么会怎样」（结果假设）来拓展场景，引入喜剧元素
5. 类比和混合：通过类比和混合的技巧，将场景中的元素与其他不相关或荒谬的元素相结合，放大喜剧效果

### 观点类喜剧
1. 明确观点和主题：从一个明确的观点出发，通过喜剧的形式表达对某个主题的看法或批评
2. 构建论证和使用反证法：通过构建有力的论证来支持观点，常使用反证法或归谬法增加喜剧色彩
3. 循环论证：找到不同的场景或例子来多角度、反复论证同一个观点
4. 表演选择：观点类喜剧可以选择不进行表演，但如果进行了，可通过演员表演强化观点和幽默效果

### 故事类喜剧
1. 主线构建：故事类喜剧需要有一个清晰的主线，围绕一个中心故事展开，包括起因、发展、高潮和结局
2. 重点场景选择：选择能够代表故事精髓的重点场景进行讲述，通过关键时刻推动故事进展并产生喜剧效果
3. 综合喜剧元素：融合观察式和观点类喜剧的元素，利用观察到的细节和个人观点增强故事的吸引力和幽默感

## 工作流程

### 第一步：段子结构拆解与分析
1. 接收用户输入的脱口秀文本
2. 主题拆分：如果文本包含多个主题，先根据主题将长文本拆分成若干独立段落
3. 逐段提取三要素：对每个段子分别提取：
   - **态度**：这段话表达了什么立场？是自嘲、讽刺、批判还是认同？演员的态度是什么？
   - **主题**：这段在讲什么？一句话说清楚核心话题
   - **前提**：这个段子的前提是什么？假设是什么？段子是基于什么前提在笑？
4. 结构拆解：判断每个段子是「铺垫」「递进」「反转」还是「收尾」
5. 发现缺点：识别每个段子中的不足（前提不明确、缺乏趣味性、主题过于宽泛、态度模糊等）
6. 提出修改意见：基于识别出的缺点，提供具体的修改建议

### 第二步：生成新版本的脱口秀文稿
1. 整合修改意见：根据第一步中提出的修改意见，整理和归纳改进点
2. 文稿重构：利用修改意见，对每个段子进行优化、重写或调整，包括优化前提、加强语言表达、调整故事结构等
3. 增加元素：在适当的地方加入新的喜剧元素，如类比、转折点等，以增强笑果
4. 个性化调整：考虑到演员的个人风格和特点，对文稿进行个性化的调整，确保新段子既符合演员的表达风格，也能够吸引目标观众
5. 综合评估：对修改后的脱口秀文稿进行全面评估，确保它在幽默感、逻辑结构、观点表达、口语化等方面都达到预期的效果

## 输出要求
1. 只返回JSON，不要任何额外文字
2. 文稿结尾不上价值
3. 生成的新版本文稿结尾也不上价值

## Schema（严格按此格式返回）
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
  "performer_tags": ["标签1", "标签2"],
  "premise": "精炼的核心前提，1-2句话",
  "theme_refined": "细化后的主题",
  "comedy_type": "观察式/观点类/故事类",
  "structures": "铺垫,递进,收尾",
  "techniques": ["观察", "类比", "反转"],
  "segments": [
    {
      "text": "该段落的原文内容",
      "structure": "铺垫/递进/反转/收尾",
      "attitude": "演员对这个话题的态度是什么（自嘲/讽刺/批判/认同等）",
      "theme": "这段在讲什么核心话题，一句话概括",
      "premise": "这段子的前提/假设是什么，是基于什么在构建笑点",
      "techniques": ["使用的具体喜剧技巧，如观察/反转/类比等"],
      "problem": "这段的主要缺点是什么（前提模糊/态度不清/笑点弱等）"
    }
  ],
  "improved_script": "完整优化版段子全文，结尾不上价值",
  "script_changes": [
    {
      "location": "位置描述",
      "original": "原句",
      "improved": "新句",
      "reason": "为什么这样改",
      "technique_added": "加入了什么技巧"
    }
  ],
  "style_hints": ["风格提示1", "风格提示2"],
  "next_suggestion": "下一步创作建议"
}

"""


async def _analyze_all_fast(client: httpx.AsyncClient, text: str, deepseek_key: str) -> dict:
    user = ("段子内容：\n" + text + "\n\n"
            "用单口喜剧优秀编剧的视角进行深度分析，严格按Schema格式返回JSON，不要输出Schema以外任何文字。")
    system = SYSTEM_PROMPT.strip()

    if not deepseek_key:
        return {"error": "DeepSeek API key 未配置"}

    try:
        r = await client.post(
            "https://api.deepseek.com/chat/completions",
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
                "max_tokens": 6000,
            },
            headers={"Authorization": "Bearer " + deepseek_key, "Content-Type": "application/json"},
            timeout=httpx.Timeout(150.0),
        )
        r.raise_for_status()
        resp_content = r.json()["choices"][0]["message"]["content"]
        result = _extract_json(resp_content)
        if result:
            return result
        first_brace = resp_content.find('{')
        last_brace = resp_content.rfind('}')
        if first_brace >= 0 and last_brace > first_brace:
            import json as _json
            return _json.loads(resp_content[first_brace:last_brace+1])
        return {"error": "返回格式解析失败，请稍后重试"}
    except httpx.HTTPStatusError as exc:
        logger.warning(f"[DeepSeek HTTP error in analyze: {exc}]")
        return {"error": _classify_error(exc)}
    except Exception as exc:
        logger.warning(f"[DeepSeek failed in analyze: {exc}]")
        return {"error": _classify_error(exc)}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(req: AnalyzeRequest):
    if len(req.text) < 20:
        raise HTTPException(400, "段子内容太短了（至少20字）")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    raw_segments = _split_segments(req.text)
    raw_segments = raw_segments[:20]

    async with httpx.AsyncClient() as client:
        result = await _analyze_all_fast(client, req.text, deepseek_key)
        if "error" in result:
            raise HTTPException(500, result["error"])

        return AnalyzeResponse(
            evaluation=result.get("evaluation", {}),
            performer_tags=result.get("performer_tags", []),
            premise=result.get("premise", ""),
            theme_refined=result.get("theme_refined", ""),
            comedy_type=result.get("comedy_type", ""),
            structures=result.get("structures", ""),
            techniques=result.get("techniques", []),
            segments=result.get("segments", []),
            improved_script=result.get("improved_script", ""),
            script_changes=result.get("script_changes", []),
            style_hints=result.get("style_hints", []),
            next_suggestion=result.get("next_suggestion", ""),
        )


@router.post("/analyze/stream")
async def analyze_stream(req: AnalyzeRequest):
    from fastapi.responses import StreamingResponse
    import asyncio

    if len(req.text) < 20:
        raise HTTPException(400, "段子内容太短了（至少20字）")

    deepseek_key = settings.deepseek_api_key or ""
    if not deepseek_key:
        raise HTTPException(503, "DeepSeek API key 未配置，请联系管理员")

    user = "段子内容：\n" + req.text + "\n\n用单口喜剧优秀编剧的视角进行深度分析，严格按Schema格式返回JSON，不要输出Schema以外任何文字。"

    request_id = str(uuid.uuid4())[:8]
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
                    "request_id": request_id,
                    "elapsed": int(elapsed),
                    "status": "analyzing",
                }) + "\n\n"

        async def send_error(msg):
            yield "event: error\ndata: " + _json.dumps({"error": msg, "request_id": request_id}) + "\n\n"

        try:
            async with client.stream(
                "POST",
                "https://api.deepseek.com/chat/completions",
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT.strip()},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 6000,
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
                            yield "event: token\ndata: " + inner + "\n\n"
                            json_parts.append(token)
                    except Exception:
                        pass
                    async for hb in send_heartbeat(): yield hb

                full_content = "".join(json_parts)
                result = _extract_json(full_content)
                if result:
                    final = {
                        "evaluation": result.get("evaluation", {}),
                        "performer_tags": result.get("performer_tags", []),
                        "premise": result.get("premise", ""),
                        "theme_refined": result.get("theme_refined", ""),
                        "comedy_type": result.get("comedy_type", ""),
                        "structures": result.get("structures", ""),
                        "techniques": result.get("techniques", []),
                        "segments": result.get("segments", []),
                        "improved_script": result.get("improved_script", ""),
                        "script_changes": result.get("script_changes", []),
                        "style_hints": result.get("style_hints", []),
                        "next_suggestion": result.get("next_suggestion", ""),
                    }
                    yield "event: done\ndata: " + _json.dumps(final) + "\n\n"
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
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )




def _call_deepseek_sync(user_prompt: str, api_key: str) -> dict:
    """Synchronous httpx call (runs in thread pool to avoid blocking event loop)."""
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
                "temperature": 0.2,
                "max_tokens": 6000,
            },
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        )
        r.raise_for_status()
        resp_content = r.json()["choices"][0]["message"]["content"]
        result = _extract_json(resp_content)
        if not result:
            first_brace = resp_content.find("{")
            last_brace = resp_content.rfind("}")
            if first_brace >= 0 and last_brace > first_brace:
                try:
                    import json as _j
                    return _j.loads(resp_content[first_brace:last_brace + 1])
                except Exception:
                    pass
            return {"error": "Parse Failed: " + resp_content[:150], "raw_content": resp_content}
        return result


