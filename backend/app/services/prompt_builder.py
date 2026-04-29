"""
prompt_builder.py — Task-type-driven system prompt builder
Standup Workspace v3.0
"""

from typing import Any

# ─── Task Instructions ────────────────────────────────────────

TASK_INSTRUCTIONS: dict[str, str] = {
    "premise": (
        "从用户素材中提炼3个可讲的脱口秀前提。"
        "每个前提要包含判断、情绪和可笑点。"
    ),
    "joke_to_premise": (
        "用户给的是一句梗，请反推这个梗成立的生活前提，并扩展出可讲场景。"
    ),
    "angles": (
        "围绕前提找5个喜剧角度，要求角度彼此不同，包含反差、自嘲、类比、荒谬升级。"
    ),
    "draft": (
        "根据前提和角度写一版1-2分钟脱口秀初稿，结构为铺垫、递进、反转、收尾。"
    ),
    "rewrite": (
        "优化用户草稿，让表达更口语、更好笑、更适合上台。"
        "保留原意，增加punchline。"
    ),
    "performance_review": (
        "根据演出反馈分析哪里有效、哪里冷场，并给下一版修改建议。"
    ),
}

# ─── System Prompt Templates ─────────────────────────────────

SYSTEM_PROMPT_TEMPLATES: dict[str, str] = {
    "premise": """你是一个专注于脱口秀内容创作的AI编剧，擅长将素材提炼为有价值的喜剧前提。

## 你的任务
用户给出一段素材（可能是故事、吐槽、观察、情绪），你的任务是从中提炼出3个可以发展成段子的前提（premise）。

## 前提的定义
一个好的脱口秀前提包含：
- **判断** — 明确的观点或立场，不是泛泛而谈
- **情绪** — 有真实的情感驱动，不是纯理性分析
- **可笑点** — 有潜在的喜剧张力，指向一个有趣的反转或荒谬

## 输出要求
输出严格JSON格式，不要包含任何Schema以外的文字：

{
  "premises": [
    {
      "title": "前提标题（10字以内）",
      "premise": "前提的完整描述",
      "judgment": "核心判断是什么",
      "emotion": "这个前提背后的情绪是什么",
      "laugh_seed": "这个前提的笑点可能在哪里",
      "angle_hint": "建议的切入角度"
    }
  ]
}

请给出3个彼此不同、各有特色的前提。""",

    "angles": """你是一个专注于脱口秀创作的AI编剧，擅长为前提找到独特的喜剧角度。

## 你的任务
用户提供一个脱口秀前提（premise），你需要围绕它找到5个彼此不同的喜剧角度。

## 角度的类型
5个角度要求覆盖不同的喜剧技巧：
- **反差** — 找出前提中违背常理的部分
- **自嘲** — 用自己的经历或弱点切入
- **类比** — 把前提类比到另一个荒谬的场景
- **荒谬升级** — 把前提推向极端看会发生什么
- **身份错位** — 换个身份视角看同一个问题

## 输出格式（严格JSON）
{
  "angles": [
    {
      "title": "角度标题（5字以内）",
      "description": "这个角度的具体描述",
      "technique": "使用的喜剧技巧名称",
      "setup_approach": "如何铺垫这个角度",
      "punchline_seed": "可能的笑点方向"
    }
  ]
}""",

    "rewrite": """你是一个资深脱口秀演员和编剧，专注于段子优化和舞台表现力。

## 你的任务
用户给出一段脱口秀草稿（或任何文本素材），你的任务是分析并优化它，让它更口语、更好笑、更适合上台表演。

## 优化维度
1. **口语化** — 像人说话，不像写文章；断句自然
2. **好笑** — 加强笑点，让punchline更有力；减少铺垫
3. **舞台感** — 适合现场表演，有节奏感，有表演空间
4. **保留原意** — 不要改变用户想表达的核心观点
5. **增加意外感** — 让听众感到意外或惊喜

## 输出格式（严格JSON）
{
  "analysis": {
    "current_strengths": ["当前段子的优点"],
    "current_issues": ["当前段子的问题"],
    "target_audience": "目标观众描述"
  },
  "improved_script": "优化后的完整段子文本",
  "stage_notes": {
    "punchline_timing": "笑点节奏建议",
    "body_language": "身体语言建议",
    "volume_mapping": "音量高低标注"
  },
  "alternatives": [
    {
      "version": "版本描述",
      "script": "另一个版本的段子"
    }
  ]
}""",

    "performance_review": """你是一个资深脱口秀演员和编剧，专注于演后复盘分析。

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
}""",
}


# ─── User Style Presets ───────────────────────────────────────

STYLE_PRESETS: dict[str, dict[str, str]] = {
    "aggressive": {
        "tone": "激进、直接、不怕得罪人",
        "topics": "社会观察、职场冲突、人际关系",
        "forbidden": "不要温情、不要鸡汤",
    },
    "relatable": {
        "tone": "亲切、共鸣、日常观察",
        "topics": "生活琐事、社交尴尬、平凡日常",
        "forbidden": "不要太过激烈，保持温暖",
    },
    "intellectual": {
        "tone": "理性、有深度、概念拆解",
        "topics": "社会现象、文化评论、哲学思考",
        "forbidden": "不要浅尝辄止，要有洞察",
    },
    "whimsical": {
        "tone": "荒诞、跳跃、打破常规",
        "topics": "奇思妙想、反向思维、夸张类比",
        "forbidden": "不要太严肃，保持玩感",
    },
}


# ─── Builder Function ───────────────────────────────────────

def build_prompt(
    task_type: str,
    user_input: str,
    context: dict[str, Any],
    user_style: dict[str, Any],
    options: dict[str, Any],
) -> str:
    """
    Build a full system prompt for a given task type.

    Args:
        task_type: One of the keys in TASK_INSTRUCTIONS
        user_input: The user's raw input text
        context: Additional context (e.g. {premise, angles, previous_draft})
        user_style: User's style preferences (e.g. from creator profile)
        options: Task-specific options (temperature, scene, etc.)

    Returns:
        A complete system prompt string (does NOT include the user message)
    """
    instruction = TASK_INSTRUCTIONS.get(
        task_type,
        "帮助用户完成脱口秀写作任务。"
    )

    # Base system prompt
    lines = [
        "你是一个专注于脱口秀内容创作的AI编剧。",
        "",
        f"## 当前任务",
        instruction,
        "",
    ]

    # Add style guidance from user_style or presets
    style_name = user_style.get("style_name") or user_style.get("preset")
    if style_name and style_name in STYLE_PRESETS:
        preset = STYLE_PRESETS[style_name]
        lines.extend([
            "## 用户风格偏好",
            f"- 语气：{preset['tone']}",
            f"- 话题方向：{preset['topics']}",
            f"- 禁忌：{preset['forbidden']}",
            "",
        ])
    elif user_style:
        # Inline style dict
        tone = user_style.get("tone", "")
        topics = user_style.get("topics", "")
        forbidden = user_style.get("forbidden", "")
        if tone or topics or forbidden:
            lines.append("## 用户风格偏好")
            if tone: lines.append(f"- 语气：{tone}")
            if topics: lines.append(f"- 话题方向：{topics}")
            if forbidden: lines.append(f"- 禁忌：{forbidden}")
            lines.append("")

    # Add context (previous results)
    if context:
        context_parts = []
        if "premise" in context:
            context_parts.append(f"前提：{context['premise']}")
        if "angles" in context:
            angles_raw = context["angles"]
            if isinstance(angles_raw, list):
                angles_str = "\n".join(
                    f"  {i+1}. {a.get('title', a) if isinstance(a, dict) else a}"
                    for i, a in enumerate(angles_raw)
                )
                context_parts.append(f"已有关角度：\n{angles_str}")
            else:
                context_parts.append(f"角度：{angles_raw}")
        if "previous_draft" in context:
            context_parts.append(f"上一版草稿：\n{context['previous_draft']}")
        if "original_script" in context:
            context_parts.append(f"原始段子：\n{context['original_script']}")
        if context_parts:
            lines.extend(["## 当前上下文", *context_parts, ""])

    # Add task-specific options
    if options.get("temperature"):
        lines.append(f"## 生成参数")
        lines.append(f"- temperature: {options['temperature']}")
        lines.append("")

    # Close with output instruction
    lines.extend([
        "## 输出格式要求",
        "严格按JSON格式输出，不要输出任何JSON Schema以外的文字或解释。",
        "如果无法完成，输出：{\"error\": \"原因\"}",
    ])

    return "\n".join(lines)


def build_user_message(
    task_type: str,
    user_input: str,
    context: dict[str, Any],
) -> str:
    """
    Build the user message for a given task type and input.
    """
    if task_type == "premise":
        return f"素材：\n{user_input}\n\n请根据以上素材提炼3个脱口秀前提，严格按JSON格式输出。"

    elif task_type == "joke_to_premise":
        topic = context.get("topic", "")
        topic_line = f"\n主题方向：{topic}" if topic else ""
        return (
            f"给出一句梗或笑话：\n{user_input}\n{topic_line}\n\n"
            "请反推这个梗成立的生活前提，并扩展出可讲的场景，严格按JSON格式输出。"
        )

    elif task_type == "angles":
        premise = context.get("premise", user_input)
        return f"前提：\n{premise}\n\n请围绕这个前提找5个喜剧角度，严格按JSON格式输出。"

    elif task_type == "draft":
        premise = context.get("premise", "")
        angles = context.get("angles", [])
        lines = []
        if premise:
            lines.append(f"前提：\n{premise}\n")
        if angles:
            if isinstance(angles, list):
                angles_str = "\n".join(
                    f"{i+1}. {a.get('title', a) if isinstance(a, dict) else a}"
                    for i, a in enumerate(angles)
                )
            else:
                angles_str = str(angles)
            lines.append(f"切入角度：\n{angles_str}\n")
        lines.append("请根据以上信息写一版1-2分钟的脱口秀初稿，严格按JSON格式输出。")
        return "\n".join(lines)

    elif task_type == "rewrite":
        return (
            f"需要优化的段子/文本：\n{user_input}\n\n"
            "请优化这段文本，让它更口语、更好笑、更适合上台，保留原意，严格按JSON格式输出。"
        )

    elif task_type == "performance_review":
        laugh_parts = context.get("laugh_parts", "")
        flop_parts = context.get("flop_parts", "")
        forgot_parts = context.get("forgot_parts", "")
        original_script = context.get("original_script", "")

        parts = ["## 演出反馈\n"]
        if laugh_parts:
            parts.append(f"### 笑声部分（观众笑了）：\n{laugh_parts}\n")
        if flop_parts:
            parts.append(f"### 冷场部分（反应不好）：\n{flop_parts}\n")
        if forgot_parts:
            parts.append(f"### 忘记/卡壳的部分：\n{forgot_parts}\n")
        if original_script:
            parts.append(f"### 原始段子文本：\n{original_script}\n")
        parts.append("请严格按JSON格式输出，不要输出任何Schema以外的文字。")
        return "".join(parts)

    else:
        return f"任务：{task_type}\n输入：\n{user_input}\n\n请按要求完成任务，严格按JSON格式输出。"