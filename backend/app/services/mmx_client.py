"""
MiniMax API client — calls the `mmx` CLI tool.
With retry logic, timeout handling, and thinking-block stripping.
"""
import subprocess
import json
import os
import time
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Label values (aligned with knowledge base) ─────────────────────────────

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
NOTES_TYPES = "|".join([
    "replaceable", "optimizable", "imitatable", "可替换", "可优化", "可模仿"
])


def _strip_thinking(raw: str) -> str:
    """
    Remove thinking blocks from mmx JSON responses.
    mmx returns content as [{"type":"thinking","text":"..."}, {"type":"text","text":"..."}]
    Returns the inner JSON string from the 'text' content item.
    """
    try:
        wrapper = json.loads(raw)
        content_list = wrapper.get("content", [])
        if isinstance(content_list, list):
            for item in content_list:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_content = item.get("text", "")
                    if text_content:
                        try:
                            parsed = json.loads(text_content)
                            return json.dumps(parsed, ensure_ascii=False)
                        except (json.JSONDecodeError, TypeError):
                            return text_content
        return raw
    except Exception:
        return raw



def _extract_json(text: str) -> Optional[dict]:
    """
    Parse JSON from mmx response, trying multiple strategies.
    """
    text = text.strip()

    # Strategy 1: direct parse (normal response)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: strip thinking blocks
    stripped = _strip_thinking(text)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Strategy 3: find first {...} block
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        try:
            return json.loads(text[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass

    # Strategy 4: extract all "text" fields from thinking blocks
    text_matches = re.findall(r'"text"\s*:\s*"([^"]{10,})"', stripped)
    if text_matches:
        # Return a partial result with just analysis_text
        return {"analysis_text": "\n".join(text_matches[:3])}

    return None


class MmXClient:
    def __init__(self, api_key: str, base_url: str = "https://api.minimax.chat"):
        self.api_key = api_key
        self.base_url = base_url
        self.model = "MiniMax-M2.7"

    def _run(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.7,
        retries: int = 2,
    ) -> str:
        """
        Invoke mmx text chat. Retries on failure.
        Returns raw stdout (possibly with thinking blocks).
        """
        prompt = self._build_prompt(messages)
        env = os.environ.copy()
        env["MINIMAX_API_KEY"] = self.api_key

        cmd = ["mmx", "text", "chat", "--model", self.model, "--message", prompt]
        if temperature != 0.7:
            cmd += ["--temperature", str(temperature)]

        for attempt in range(retries + 1):
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=180,
                    env=env,
                )
            except subprocess.TimeoutExpired:
                logger.warning(f"[MmX] attempt {attempt + 1} timeout after 180s")
                if attempt == retries:
                    raise RuntimeError(
                        f"mmx CLI timeout after {retries + 1} attempts (180s each)"
                    )
                time.sleep(2**attempt)
                continue

            if result.returncode == 0:
                return result.stdout.strip()

            # Non-zero exit — check for signal death (e.g. SIGABRT=6)
            signal_info = ""
            if result.returncode < 0:
                signal_info = f" (killed by signal {-result.returncode})"

            err = (
                f"mmx CLI error (code={result.returncode}{signal_info}): "
                f"stderr=[{result.stderr.strip()[:200]}]"
            )
            logger.warning(f"[MmX] attempt {attempt + 1} failed: {err}")

            if attempt == retries:
                raise RuntimeError(err)
            time.sleep(2**attempt)

        raise RuntimeError("mmx: unexpected loop exit")

    def _build_prompt(self, messages: list[dict]) -> str:
        parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            parts.append(f"<{role}>{content}</{role}>")
        return "\n".join(parts)

    def chat(self, user_message: str, system: Optional[str] = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_message})
        return self._run(messages)

    def analyze_segment(
        self, segment_text: str, context: Optional[dict] = None
    ) -> dict:
        system = (
            "You are a standup comedy script analyst. "
            "Analyze the segment and respond ONLY with valid JSON.\n"
            "{\n"
            f'  "structure": "{STRUCTURES}",\n'
            '  "structure_note": "...",\n'
            '  "attitude_object": "...",\n'
            f'  "attitude_type": "{ATTITUDES}",\n'
            '  "attitude_insight": "...",\n'
            f'  "techniques": "技巧1,技巧2,...",\n'
            '  "technique_notes": "...",\n'
            f'  "problems": "{PROBLEMS}",\n'
            '  "problem_notes": "...",\n'
            '  "notes": "...",\n'
            f'  "notes_type": "{NOTES_TYPES}",\n'
            '  "inspiration": "...",\n'
            '  "analysis_text": "..."\n'
            "}\n"
            "技巧请从以下列表选择（逗号分隔）：" + TECHNIQUES + "\n"
            "Respond ONLY with the JSON. No extra text."
        )

        ctx_str = ""
        if context:
            ctx_str = f"\nContext: {json.dumps(context, ensure_ascii=False)}"

        user = (
            f"Segment:\n{segment_text}\n"
            f"{ctx_str}\n"
            "Analyze this standup segment."
        )

        raw = self.chat(user, system=system)

        # Strip markdown fences
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                lines[1:-1] if lines[-1].startswith("```") else lines[1:]
            )

        result = _extract_json(raw)
        if result is not None:
            return result

        # Ultimate fallback
        logger.warning(f"[MmX] Could not parse JSON from response, using raw text")
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
            "analysis_text": raw[:500] if raw else "[Empty response from mmx]",
        }

    def generate_report(
        self, segments_data: list[dict], actor_name: str = "", title: str = ""
    ) -> dict:
        # Build compact segment summary (no full analysis_text — reduces prompt size)
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
            "Respond ONLY with valid JSON:\n"
            "{\n"
            '  "summary": "...",\n'
            '  "strengths": "...",\n'
            '  "weaknesses": "...",\n'
            '  "methodology": "...",\n'
            '  "key_insights": "...",\n'
            '  "overall_score": 0.85\n'
            "}\n"
            "overall_score should be 0.0-1.0. Respond ONLY with JSON."
        )

        user_content = (
            f"Actor: {actor_name or 'Unknown'}\n"
            f"Title: {title or 'Untitled'}\n"
            f"{segs_md}\n\n"
            "Generate the overall script report."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]

        raw = self._run(messages, temperature=0.0)

        # Strip markdown fences
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                lines[1:-1] if lines[-1].startswith("```") else lines[1:]
            )

        result = _extract_json(raw)
        if result is not None:
            return result

        # Fallback: extract text from thinking blocks
        text_matches = re.findall(r'"text"\s*:\s*"([^"]{20,})"', raw)
        readable = "\n".join(text_matches[:5]) if text_matches else raw[:500]

        return {
            "summary": readable or "[报告生成失败，请重试]",
            "strengths": "",
            "weaknesses": "",
            "methodology": "",
            "key_insights": "",
            "overall_score": 0.5,
        }
