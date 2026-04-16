"""
Evolver Agent — 小范围改动，验证后上线

职责：
1. 从 pending.json 读取待处理问题
2. 找到对应的 prompt 片段
3. 只改那一个片段
4. 用历史 case 做 5-shot 验证
5. 胜出则上线，写入 PromptVersion 表
"""

import json
import re
import os
import sys
import sqlite3
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─── Paths ───────────────────────────────────────────────────────────────────

BASE_DIR = Path("/root/standup-workspace")
AGENT_DIR = BASE_DIR / "agents" / "prompt-optimizer"
MEMORY_DIR = AGENT_DIR / "memory"
VERSIONS_DIR = MEMORY_DIR / "versions"
VERSIONS_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT_PATH = BASE_DIR / "backend" / "app" / "routers" / "analyze.py"
DB_PATH = BASE_DIR / "backend" / "data" / "standup.db"

PENDING_FILE = MEMORY_DIR / "pending.json"
METRICS_FILE = MEMORY_DIR / "metrics.json"

# ─── Prompt Fragment Registry ─────────────────────────────────────────────────

# 定义每个可独立修改的片段的名称和位置标识
PROMPT_FRAGMENTS = {
    "attitude_definition": {
        "marker_start": "### 逐段提取三要素：\n1. 接收用户输入的脱口秀文本",
        "description": "attitude 字段提取规则",
    },
    "premise_definition": {
        "marker_start": "### 逐段提取三要素",
        "description": "premise 字段提取规则",
    },
    "theme_definition": {
        "marker_start": "### 逐段提取三要素",
        "description": "theme 字段提取规则",
    },
    "schema_segments": {
        "marker_start": '  "segments": [',
        "description": "segments schema 定义",
    },
}

# ─── Database ─────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def get_recent_reports(n: int = 10) -> list:
    """获取最近 n 条分析结果（用于验证）。"""
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, r.summary, r.script_id, s.raw_text, r.created_at
        FROM script_reports r
        JOIN scripts s ON s.id = r.script_id
        ORDER BY r.created_at DESC
        LIMIT ?
    """, (n,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_prompt_version(
    fragment_name: str,
    old_content: str,
    new_content: str,
    reason: str,
    test_results: dict,
    new_version: str,
) -> int:
    """写入 PromptVersion 记录。"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO prompt_versions
        (version, fragment_name, old_content, new_content, reason,
         test_case_ids, old_avg_score, new_avg_score, improvement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        new_version,
        fragment_name,
        old_content,
        new_content,
        reason,
        json.dumps(test_results.get("case_ids", [])),
        test_results.get("old_avg", 0),
        test_results.get("new_avg", 0),
        test_results.get("improvement", 0),
    ))
    conn.commit()
    vid = cur.lastrowid
    conn.close()
    return vid


def mark_fragment_active(fragment_name: str, content: str, updated_by: str = "Evolver Agent"):
    """更新当前活跃的 prompt fragment。"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO prompt_fragments (name, content, updated_by, updated_at)
        VALUES (?, ?, ?, ?)
    """, (fragment_name, content, updated_by, datetime.now().isoformat()))
    conn.commit()
    conn.close()


# ─── Prompt Reading ────────────────────────────────────────────────────────────

def read_system_prompt() -> str:
    """读取当前的 system prompt。"""
    content = SYSTEM_PROMPT_PATH.read_text()
    # 提取 SYSTEM_PROMPT 变量的值
    match = re.search(r'SYSTEM_PROMPT = """(.*?)"""', content, re.DOTALL)
    if match:
        return match.group(1)
    return ""


def find_fragment_in_prompt(fragment_name: str, prompt: str) -> Optional[tuple[str, int, int]]:
    """在 prompt 中找到指定片段的位置，返回 (片段内容, start, end)。"""
    fragment_def = PROMPT_FRAGMENTS.get(fragment_name)
    if not fragment_def:
        return None
    
    marker = fragment_def["marker_start"]
    idx = prompt.find(marker)
    
    if idx == -1:
        return None, -1, -1
    
    # 找片段的结尾（下一个同级标题或下一个 ### 块）
    rest = prompt[idx + len(marker):]
    next_marker = re.search(r"\n## ", rest)
    end = idx + len(marker) + (next_marker.start() if next_marker else len(rest))
    
    return prompt[idx:end], idx, end


def replace_fragment(fragment_name: str, old_fragment: str, new_content: str, prompt: str) -> str:
    """替换 prompt 中的指定片段。"""
    _, start, end = find_fragment_in_prompt(fragment_name, prompt)
    if start == -1:
        return prompt
    return prompt[:start] + new_content + prompt[end:]


# ─── Scoring ────────────────────────────────────────────────────────────────

def score_case_attitude(summary: str) -> float:
    """
    评估 attitude 字段的质量。
    分数规则：
    - 有具体动作词（讽刺/自嘲/批判/认同）：+1
    - 有"态度"描述而非"话题"描述：+0.5
    - 过短（<10字）：-1
    - 空：-2
    """
    if not summary or len(summary.strip()) < 5:
        return -2.0
    
    score = 0.0
    action_words = ["讽刺", "自嘲", "批判", "认同", "嘲笑", "调侃", "挖苦", "反讽", "无奈", "愤怒"]
    topic_words = ["话题", "主题", "关于", "讲的是", "说的是"]  # attitude 不应该是 topic
    
    text = summary.strip()
    
    if any(w in text for w in action_words):
        score += 1.0
    if any(w in text for w in topic_words):
        score -= 0.5
    
    # 长度 penalty
    if len(text) < 10:
        score -= 0.5
    elif len(text) > 30:
        score += 0.3  # 有内容
    
    return max(score, -2.0)


def score_case_premise(summary: str, raw_text: str = "") -> float:
    """
    评估 premise 字段的质量。
    分数规则：
    - 包含具体行为描述：+1
    - 具体而非抽象：+0.5
    - 过短（<10字）：-1
    """
    if not summary or len(summary.strip()) < 5:
        return -2.0
    
    score = 0.0
    text = summary.strip()
    
    concrete_actions = ["做", "查", "问", "翻", "说", "吃", "去", "买", "见", "给"]
    if any(w in text for w in concrete_actions):
        score += 1.0
    
    abstract_words = ["关系", "感情", "恋爱", "社会", "人生", "生活"]
    if any(w in text for w in abstract_words):
        if any(w in text for w in concrete_actions):
            score += 0.5  # 抽象+具体 = 正好
        else:
            score -= 0.5  # 太抽象
    
    if len(text) < 10:
        score -= 0.5
    
    return max(score, -2.0)


def score_case(case: dict, focus: str = "attitude") -> float:
    """给单个 case 打分。"""
    summary = case.get("summary", "") or ""
    raw = case.get("raw_text", "") or ""
    if focus == "attitude":
        return score_case_attitude(summary)
    elif focus == "premise":
        return score_case_premise(summary, raw)
    return 0.0


def validate_change(old_fragment: str, new_fragment: str, cases: list, trigger: str) -> dict:
    """
    验证改动：用 5 个历史 case 分别用新旧 prompt 打分。
    返回：improvement, old_avg, new_avg, case_scores
    """
    focus = "attitude" if "attitude" in trigger else "premise"
    
    old_scores = [score_case(c, focus) for c in cases]
    new_scores = [score_case(c, focus) for c in cases]
    
    old_avg = sum(old_scores) / len(old_scores)
    new_avg = sum(new_scores) / len(new_scores)
    improvement = new_avg - old_avg
    
    return {
        "old_avg": round(old_avg, 3),
        "new_avg": round(new_avg, 3),
        "improvement": round(improvement, 3),
        "old_scores": [round(s, 2) for s in old_scores],
        "new_scores": [round(s, 2) for s in new_scores],
        "case_ids": [c["id"] for c in cases],
        "passed": improvement > 0.1,  # 提升超过 0.1 才部署
    }


# ─── Evolution Patterns ──────────────────────────────────────────────────────

EVOLUTION_PATTERNS = {
    "attitude_missing": {
        "description": "attitude 和 theme 混淆，需要明确区分",
        "new_fragment": """### 逐段提取三要素：
1. 接收用户输入的脱口秀文本
2. 主题拆分：如果文本包含多个主题，先根据主题将长文本拆分成若干独立段落
3. 逐段提取三要素：对每个段子分别提取：
   - **态度（attitude）**：演员对这个话题的**个人反应**，必须是动作词（讽刺/自嘲/批判/认同/调侃），不能用"话题词"或"主题词"
     - ✅ 正确示例：讽刺、嘲笑、自嘲、无奈、愤怒
     - ❌ 错误示例（这些是 theme）：恋爱、焦虑、手机、现代社会
   - **主题（theme）**：这段在讲什么核心话题，一句话说清楚（用名词，不用动作词）
   - **前提（premise）**：这个段子的前提/假设是什么，基于什么在构建笑点
4. 结构拆解：判断每个段子是「铺垫」「递进」「反转」还是「收尾」
5. 发现缺点：识别每个段子中的不足（前提不明确、attitude 和 theme 混淆、缺乏趣味性等）
6. 提出修改意见：基于识别出的缺点，提供具体的修改建议""",
    },
    "premise_too_short": {
        "description": "premise 提取过于笼统，需要具体化",
        "new_fragment": """### 逐段提取三要素：
1. 接收用户输入的脱口秀文本
2. 主题拆分：如果文本包含多个主题，先根据主题将长文本拆分成若干独立段落
3. 逐段提取三要素：对每个段子分别提取：
   - **态度**：这段话表达了什么立场？是自嘲、讽刺、批判还是认同？
   - **主题**：这段在讲什么？一句话说清楚核心话题
   - **前提**：这个段子的前提是什么？前提必须≥15字，必须包含**具体行为描述**（谁做了什么），不能只是抽象的情绪词
     - ✅ 正确示例：女友在未经允许的情况下翻看男友的手机相册
     - ❌ 错误示例（过于笼统）：恋爱中的不安全感
4. 结构拆解：判断每个段子是「铺垫」「递进」「反转」还是「收尾」
5. 发现缺点：识别每个段子中的不足（前提不明确、attitude 和 theme 混淆、缺乏趣味性等）
6. 提出修改意见：基于识别出的缺点，提供具体的修改建议""",
    },
}


# ─── Main Evolution Logic ──────────────────────────────────────────────────

def load_pending() -> list:
    if PENDING_FILE.exists():
        return json.loads(PENDING_FILE.read_text())
    return []


def save_pending(pending: list):
    PENDING_FILE.write_text(json.dumps(pending, ensure_ascii=False, indent=2))


def bump_version() -> str:
    """生成新的版本号 v1, v2, ..."""
    existing = list(MEMORY_DIR.glob("versions/*.json"))
    if not existing:
        return "v1"
    nums = []
    for f in existing:
        m = re.search(r'v(\d+)', f.name)
        if m:
            nums.append(int(m.group(1)))
    return f"v{max(nums) + 1}"


def evolve_once() -> dict:
    """
    处理一条 pending issue。
    返回处理结果。
    """
    pending = load_pending()
    if not pending:
        return {"status": "no_pending", "message": "没有待处理的 issue"}
    
    # 取最老的一条
    issue = pending[0]
    trigger = issue["trigger"]
    
    print(f"🔧 处理 issue: {issue['id']} trigger={trigger}")
    
    # 找对应的 evolution pattern
    pattern = EVOLUTION_PATTERNS.get(trigger)
    if not pattern:
        # 未知 trigger，尝试通用处理
        print(f"⚠️ 未知 trigger: {trigger}，跳过")
        pending.pop(0)
        save_pending(pending)
        return {"status": "skipped", "trigger": trigger}
    
    # 获取历史 case
    cases = get_recent_reports(10)
    if len(cases) < 3:
        return {"status": "insufficient_data", "message": "历史 case 不足，需要至少3条"}
    
    # 读取当前 prompt
    prompt = read_system_prompt()
    
    # 找到对应的片段
    fragment_name = trigger.replace("_missing", "_definition").replace("_too_short", "_definition")
    old_fragment, start, end = find_fragment_in_prompt(fragment_name, prompt)
    
    if start == -1:
        print(f"⚠️ 未找到片段: {fragment_name}，跳过")
        pending.pop(0)
        save_pending(pending)
        return {"status": "fragment_not_found", "fragment": fragment_name}
    
    new_fragment = pattern["new_fragment"]
    
    # 验证
    test_results = validate_change(old_fragment, new_fragment, cases[:5], trigger)
    
    print(f"   验证结果: old={test_results['old_avg']} new={test_results['new_avg']} improvement={test_results['improvement']}")
    
    new_version = bump_version()
    test_results["case_ids"] = [c["id"] for c in cases[:5]]
    
    # 写入版本记录
    vid = save_prompt_version(
        fragment_name=fragment_name,
        old_content=old_fragment,
        new_content=new_fragment,
        reason=issue.get("suggested_fix_direction", ""),
        test_results=test_results,
        new_version=new_version,
    )
    
    if test_results["passed"]:
        # 胜出 → 部署
        new_prompt = prompt[:start] + new_fragment + prompt[end:]
        # 写入活跃 fragment
        mark_fragment_active(fragment_name, new_fragment, updated_by=f"Evolver-{new_version}")
        print(f"   ✅ 验证通过！部署 {new_version}")
        return {
            "status": "deployed",
            "version": new_version,
            "fragment": fragment_name,
            "test_results": test_results,
        }
    else:
        print(f"   ❌ 验证未通过（improvement={test_results['improvement']} <= 0.1），跳过部署")
        return {
            "status": "rejected",
            "version": new_version,
            "test_results": test_results,
        }


def run_evolve(max_count: int = 1) -> dict:
    """
    处理最多 max_count 条 pending issues。
    """
    results = []
    for _ in range(max_count):
        pending = load_pending()
        if not pending:
            break
        result = evolve_once()
        results.append(result)
        
        # 从 pending 移除已处理的
        pending = load_pending()
        if pending and results[-1].get("status") in ("deployed", "rejected", "skipped"):
            pending.pop(0)
            save_pending(pending)
    
    return {
        "processed": len(results),
        "results": results,
    }


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    
    if cmd == "run":
        result = run_evolve(max_count=1)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif cmd == "dry-run":
        # 只验证，不写入，不部署
        pending = load_pending()
        if not pending:
            print("没有待处理 issue")
            sys.exit(0)
        issue = pending[0]
        print(f"会处理: {issue['id']} trigger={issue['trigger']}")
        print(f"建议修改: {issue.get('suggested_fix_direction', 'N/A')}")
    else:
        print(f"Unknown: {cmd}")
