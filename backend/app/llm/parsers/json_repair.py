import json
import re
from typing import Optional

def extract_json_text(raw: str) -> str:
    """Extract JSON from markdown code blocks or raw text."""
    raw = raw.strip()
    
    # Try markdown code block
    code_block = re.search(r"```(?:json)?\s*(.*?)```", raw, re.DOTALL)
    if code_block:
        return code_block.group(1).strip()
    
    # Find first { or [
    start = min(
        [i for i in [raw.find("{"), raw.find("[")] if i != -1],
        default=-1,
    )
    if start == -1:
        raise ValueError("No JSON object found")
    
    # Find last } or ]
    end_obj = raw.rfind("}")
    end_arr = raw.rfind("]")
    end = max(end_obj, end_arr)
    
    if end == -1 or end <= start:
        raise ValueError("No JSON end found")
    
    return raw[start:end + 1]

def basic_json_repair(text: str) -> str:
    """Basic JSON repair for common issues."""
    text = text.strip()
    # Chinese punctuation
    text = text.replace("，", ",")
    text = text.replace("：", ":")
    text = text.replace(""", '"')
    text = text.replace(""", '"')
    text = text.replace("'", '"')
    # Trailing commas
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text

def parse_json_safely(raw: str) -> dict | list:
    """Parse JSON with repair fallback."""
    text = extract_json_text(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        repaired = basic_json_repair(text)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            raise ValueError(f"Failed to parse JSON after repair: {text[:200]}")
