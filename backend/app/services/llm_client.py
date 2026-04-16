"""
Direct HTTP LLM client — no CLI dependency.
Uses DeepSeek as primary, GLM-5 as fallback.
"""
import os
import json
import time
import logging
import re
from typing import Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

STRUCTURES = "|".join([
    "开场", "铺垫", "举例", "递进", "callback", "收尾", "过渡",
    "自我介绍", "情绪铺垫", "冲突建立", "解构", "反转"
])
ATTITUDES = "|".join([
    "strange", "stupid", "terrible", "sad", "ironic", "self_deprecating", "neutral",
    "荒诞", "紧张", "害怕", "生气", "尴尬", "难受", "可怕",
    "焦虑", "无奈", "羞耻", "后悔", "愤怒", "委屈"
])
TECHNIQUES = "|".join([
    "故事段子", "自嘲", "细节深挖", "对比反差", "夸张", "类比",
    "观察", "callback", "谐音梗", "双关", "修辞梗", "反转",
    "画面感", "场景化", "结果假设", "三段式", "层层递进",
    "观察式喜剧", "现挂", "连接型洞察", "陌生化"
])
PROBLEMS = "|".join([
    "前提缺失", "共鸣不足", "只有趣事", "依赖表演",
    "结构散乱", "节奏拖沓", "技巧堆砌", "主题模糊"
])


def _extract_json(text: str) -> Optional[dict]:
    """Parse JSON from LLM response with thinking-block stripping."""
    text = text.strip()

    # Strategy 1: direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: find first {...} block
    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        try:
            return json.loads(text[first:last + 1])
        except json.JSONDecodeError:
            pass

    # Strategy 3: strip markdown code fences
    stripped = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    stripped = re.sub(r"\s*```$", "", stripped, flags=re.MULTILINE)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    return None


class DeepSeekClient:
    """DeepSeek Chat API via direct HTTP."""

    BASE_URL = "https://api.deepseek.com"
    MODEL = "deepseek-chat"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(timeout=120.0)

    def _post(self, messages: list[dict], temperature: float = 0.3) -> str:
        r = self.client.post(
            f"{self.BASE_URL}/chat/completions",
            json={
                "model": self.MODEL,
                "messages": messages,
                "temperature": temperature,
            },
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]

    def chat(self, user_message: str, system: Optional[str] = None, temperature: float = 0.3) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_message})
        return self._post(messages, temperature=temperature)

    def analyze_segment(self, segment_text: str) -> dict:
        system = (
            "You are a standup comedy script analyst. "
            "Analyze the segment and respond ONLY with valid JSON (no markdown, no thinking).\n"
            "Schema:\n"
            f'{{"structure":"{STRUCTURES}","structure_note":"...",'
            '"attitude_object":"...",'
            f'"attitude_type":"{ATTITUDES}",'
            '"attitude_insight":"...",'
            f'"techniques":"技巧1,技巧2,...",'
            '"technique_notes":"...",'
            f'"problems":"{PROBLEMS}",'
            '"problem_notes":"...",'
            '"notes":"...",'
            '"notes_type":"可替换|可优化|可模仿",'
            '"inspiration":"...",'
            '"analysis_text":"..."}}\n'
            "技巧必须从以下列表选择（逗号分隔）：" + TECHNIQUES
        )
        user = f"Segment:\n{segment_text}\n\nAnalyze this standup segment."
        raw = self.chat(user, system=system, temperature=0.2)
        result = _extract_json(raw)
        if result:
            return result
        return {
            "structure": "unknown",
            "structure_note": "",
            "attitude_object": "",
            "attitude_type": "neutral",
            "attitude_insight": "",
            "techniques": "",
            "technique_notes": "",
            "problems": "",
            "problem_notes": "",
            "notes": "",
            "notes_type": "",
            "inspiration": "",
            "analysis_text": raw[:500] if raw else "[Empty response]",
        }

    def generate_report(self, segments_data: list[dict], actor_name: str = "", title: str = "") -> dict:
        # Compact summary (no full analysis_text)
        tech_counts: dict[str, int] = {}
        structure_counts: dict[str, int] = {}
        attitude_counts: dict[str, int] = {}
        for s in segments_data:
            for t in (s.get("techniques", "") or "").split(","):
                t = t.strip()
                if t:
                    tech_counts[t] = tech_counts.get(t, 0) + 1
            struct = s.get("structure", "") or "?"
            structure_counts[struct] = structure_counts.get(struct, 0) + 1
            att = s.get("attitude_type", "") or "neutral"
            attitude_counts[att] = attitude_counts.get(att, 0) + 1

        top_techs = sorted(tech_counts.items(), key=lambda x: -x[1])[:5]
        top_structs = sorted(structure_counts.items(), key=lambda x: -x[1])
        top_atts = sorted(attitude_counts.items(), key=lambda x: -x[1])

        segs_md = (
            f"Segments: {len(segments_data)}\n"
            f"Structures: {', '.join(f'{s}({c})' for s, c in top_structs)}\n"
            f"Attitudes: {', '.join(f'{a}({c})' for a, c in top_atts)}\n"
            f"Top techniques: {', '.join(f'{t}({c})' for t, c in top_techs)}"
        )

        system = (
            "You are a standup comedy script analyst. "
            "Based on the segment summary, generate a script report. "
            "Respond ONLY with valid JSON (no markdown, no thinking).\n"
            "Schema:\n"
            '{"summary":"...","strengths":"...","weaknesses":"...",'
            '"methodology":"...","key_insights":"...","overall_score":0.85}'
        )
        user = f"Actor: {actor_name or 'Unknown'}\nTitle: {title or 'Untitled'}\n{segs_md}\n\nGenerate the overall script report."
        raw = self.chat(user, system=system, temperature=0.2)
        result = _extract_json(raw)
        if result:
            score = result.get("overall_score", 0.5)
            if isinstance(score, str):
                nums = re.findall(r"0\.\d+", score)
                if nums:
                    score = float(nums[0])
            result["overall_score"] = max(0.0, min(1.0, float(score) if score else 0.5))
            return result
        return {
            "summary": raw[:500] if raw else "[Report generation failed]",
            "strengths": "",
            "weaknesses": "",
            "methodology": "",
            "key_insights": "",
            "overall_score": 0.5,
        }

    def close(self):
        self.client.close()


class GLM5Client:
    """GLM-5 API via direct HTTP (Zhipu AI)."""

    BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
    MODEL = "glm-5"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(timeout=120.0)

    def _post(self, messages: list[dict], temperature: float = 0.3) -> str:
        r = self.client.post(
            f"{self.BASE_URL}/chat/completions",
            json={
                "model": self.MODEL,
                "messages": messages,
                "temperature": temperature,
            },
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]

    def chat(self, user_message: str, system: Optional[str] = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_message})
        return self._post(messages)

    def analyze_segment(self, segment_text: str) -> dict:
        system = (
            "You are a standup comedy script analyst. "
            "Analyze the segment and respond ONLY with valid JSON (no markdown, no thinking).\n"
            "Schema:\n"
            f'{{"structure":"{STRUCTURES}","structure_note":"...",'
            '"attitude_object":"...",'
            f'"attitude_type":"{ATTITUDES}",'
            '"attitude_insight":"...",'
            f'"techniques":"技巧1,技巧2,...",'
            '"technique_notes":"...",'
            f'"problems":"{PROBLEMS}",'
            '"problem_notes":"...",'
            '"notes":"...",'
            '"notes_type":"可替换|可优化|可模仿",'
            '"inspiration":"...",'
            '"analysis_text":"..."}}\n'
            "技巧必须从以下列表选择（逗号分隔）：" + TECHNIQUES
        )
        user = f"Segment:\n{segment_text}\n\nAnalyze this standup segment."
        raw = self.chat(user, system=system, temperature=0.2)
        result = _extract_json(raw)
        if result:
            return result
        return {
            "structure": "unknown",
            "structure_note": "",
            "attitude_object": "",
            "attitude_type": "neutral",
            "attitude_insight": "",
            "techniques": "",
            "technique_notes": "",
            "problems": "",
            "problem_notes": "",
            "notes": "",
            "notes_type": "",
            "inspiration": "",
            "analysis_text": raw[:500] if raw else "[Empty response]",
        }

    def generate_report(self, segments_data: list[dict], actor_name: str = "", title: str = "") -> dict:
        tech_counts: dict[str, int] = {}
        structure_counts: dict[str, int] = {}
        attitude_counts: dict[str, int] = {}
        for s in segments_data:
            for t in (s.get("techniques", "") or "").split(","):
                t = t.strip()
                if t:
                    tech_counts[t] = tech_counts.get(t, 0) + 1
            struct = s.get("structure", "") or "?"
            structure_counts[struct] = structure_counts.get(struct, 0) + 1
            att = s.get("attitude_type", "") or "neutral"
            attitude_counts[att] = attitude_counts.get(att, 0) + 1

        top_techs = sorted(tech_counts.items(), key=lambda x: -x[1])[:5]
        top_structs = sorted(structure_counts.items(), key=lambda x: -x[1])
        top_atts = sorted(attitude_counts.items(), key=lambda x: -x[1])

        segs_md = (
            f"Segments: {len(segments_data)}\n"
            f"Structures: {', '.join(f'{s}({c})' for s, c in top_structs)}\n"
            f"Attitudes: {', '.join(f'{a}({c})' for a, c in top_atts)}\n"
            f"Top techniques: {', '.join(f'{t}({c})' for t, c in top_techs)}"
        )

        system = (
            "You are a standup comedy script analyst. "
            "Based on the segment summary, generate a script report. "
            "Respond ONLY with valid JSON (no markdown, no thinking).\n"
            '{"summary":"...","strengths":"...","weaknesses":"...",'
            '"methodology":"...","key_insights":"...","overall_score":0.85}'
        )
        user = f"Actor: {actor_name or 'Unknown'}\nTitle: {title or 'Untitled'}\n{segs_md}\n\nGenerate the overall script report."
        raw = self.chat(user, system=system, temperature=0.2)
        result = _extract_json(raw)
        if result:
            score = result.get("overall_score", 0.5)
            if isinstance(score, str):
                nums = re.findall(r"0\.\d+", score)
                if nums:
                    score = float(nums[0])
            result["overall_score"] = max(0.0, min(1.0, float(score) if score else 0.5))
            return result
        return {
            "summary": raw[:500] if raw else "[Report generation failed]",
            "strengths": "",
            "weaknesses": "",
            "methodology": "",
            "key_insights": "",
            "overall_score": 0.5,
        }

    def close(self):
        self.client.close()


def get_llm_client() -> DeepSeekClient:
    """Get primary LLM client (DeepSeek)."""
    api_key = settings.deepseek_api_key or os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not set")
    return DeepSeekClient(api_key)


def get_fallback_client() -> GLM5Client:
    """Get fallback LLM client (GLM-5)."""
    api_key = settings.glm5_api_key or os.environ.get("GLM5_API_KEY", "")
    if not api_key:
        raise RuntimeError("GLM5_API_KEY not set")
    return GLM5Client(api_key)
