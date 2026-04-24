"""
找角度 API
输入：一个已有前提
输出：当前问题判断、6个新角度、推荐角度、继续展开建议

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
from pydantic import BaseModel

from ..config import settings
from ..utils.logging import api_logger, llm_logger, new_request_id, set_request_context
from ..utils.errors import _classify_error
from ..llm import LLMGateway, llm_gateway, get_stream_gateway, LLMRequest, LLMMessage


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["find-angles"])


def _extract_json(text: str):
    """解析 JSON（保留，供内部用）"""
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
- 场景方向（适合什么场景）
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


def _build_user_prompt(premise: str) -> str:
    return (
        "以下是一个脱口秀前提，请为它找角度：\n\n"
        f"前提：\n{premise}\n\n"
        "请严格按JSON格式输出，不要输出任何Schema以外的文字。"
    )


@router.post("/find-angles")
async def find_angles(req: dict):
    """非流式找角度 - 走 LLM Gateway 多模型回退"""
    premise = req.get("premise", "").strip()
    if len(premise) < 3:
        raise HTTPException(400, "输入的前提太短了（至少3个字）")

    request_id = new_request_id("fa")
    set_request_context(request_id, "find-angles")

    try:
        gateway = llm_gateway()
    except ValueError:
        raise HTTPException(503, "TokenHub API key 未配置，请联系管理员")

    llm_req = LLMRequest(
        scene="find_angles",
        messages=[
            LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
            LLMMessage(role="user", content=_build_user_prompt(premise)),
        ],
        temperature=1.0,
        stream=False,
        request_id=request_id,
    )

    result = await gateway.generate(llm_req)

    if result.error:
        raise HTTPException(500, result.error)

    # Parse the JSON content
    parsed = _extract_json(result.content)
    if not parsed:
        raise HTTPException(500, "返回格式解析失败，请稍后重试")

    # Attach meta to response headers for observability
    return parsed


@router.post("/find-angles/stream")
async def find_angles_stream(req: dict):
    """流式找角度 - 走 StreamGateway 多模型自动回退"""
    premise = req.get("premise", "").strip()
    if len(premise) < 3:
        raise HTTPException(400, "输入的前提太短了（至少3个字）")

    request_id = new_request_id("fa")
    set_request_context(request_id, "find-angles/stream")

    gateway = get_stream_gateway()

    llm_req = LLMRequest(
        scene="find_angles",
        messages=[
            LLMMessage(role="system", content=SYSTEM_PROMPT.strip()),
            LLMMessage(role="user", content=_build_user_prompt(premise)),
        ],
        temperature=1.0,
        stream=True,
        request_id=request_id,
    )

    return StreamingResponse(
        gateway.generate(llm_req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )