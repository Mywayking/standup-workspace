"""
公共 JSON 解析工具 — 从 LLM 输出中提取可靠 JSON。
所有 router 统一调用此模块的 parse_llm_json()。
"""
import json
import re
from typing import Any, Optional


def parse_llm_json(text: str) -> Optional[dict]:
    """
    从 LLM 返回文本中提取 JSON 对象。
    策略：
    1. 直接 json.loads
    2. 剥除 ```json ... ``` 包装
    3. 剥除 ``` ... ``` 包装
    4. 从第一个 { 到最后一个 } 逐字符解析，取最末完整对象
    """
    if not text:
        return None

    # 清理控制字符
    text = re.sub(r"[\x00-\x08\x0E-\x1F\x7F]", "", text)
    text = text.strip()
    if not text:
        return None

    # 策略 1：直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 策略 2：剥除 ```json\n ... ```
    stripped = re.sub(r"```json\s*\n?\s*", "", text)
    stripped = re.sub(r"```\s*$", "", stripped).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # 策略 3：逐字符括号匹配，取最末完整 JSON 对象
    complete_jsons = []
    in_string = False
    escape = False
    json_start = -1
    count = 0

    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
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
