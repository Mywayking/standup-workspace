"""
Monitor Agent — 检查触发条件，写入 pending.json

用法：
  python monitor.py check --session-id abc123  (分析完成后调用)
  python monitor.py report                    (生成每小时趋势报告)
"""

import json
import os
import sys
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# ─── Paths ───────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parents[1]  # agents/monitor.py → standup-workspace/
AGENT_DIR = BASE_DIR / "agents" / "prompt-optimizer"
MEMORY_DIR = AGENT_DIR / "memory"
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = BASE_DIR / "backend" / "data" / "standup.db"

PENDING_FILE = MEMORY_DIR / "pending.json"
METRICS_FILE = MEMORY_DIR / "metrics.json"

# ─── Thresholds ──────────────────────────────────────────────────────────────

TRIGGERS = {
    "attitude_missing": {
        "threshold": 0.35,
        "lookback": 50,
        "description": "attitude 字段空缺率",
    },
    "premise_too_short": {
        "threshold": 0.40,
        "lookback": 50,
        "description": "premise 少于10字的占比",
    },
    "thumbs_down_rate": {
        "threshold": 0.30,
        "lookback": 30,
        "description": "👎 占比",
    },
    "consecutive_bad": {
        "count": 3,
        "description": "连续👎数量",
    },
    "parse_fail_rate": {
        "threshold": 0.10,
        "lookback": 20,
        "description": "JSON解析失败率",
    },
}

# ─── Database ────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def get_recent_reports(n: int = 50) -> list:
    """获取最近 n 条分析结果。"""
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


def get_feedback_stats(n: int = 30) -> dict:
    """获取最近 n 条反馈的统计。"""
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT rating, COUNT(*) as cnt
        FROM analysis_feedback
        GROUP BY rating
    """)
    rows = cur.fetchall()
    total = sum(dict(r)["cnt"] for r in rows)
    thumbs_down = next((dict(r)["cnt"] for r in rows if dict(r)["rating"] == 0), 0)
    conn.close()
    return {"total": total, "thumbs_down": thumbs_down, "down_rate": thumbs_down / max(total, 1)}


def get_consecutive_bad() -> int:
    """获取最近的连续👎数量。"""
    conn = get_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT rating FROM analysis_feedback
        ORDER BY created_at DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    conn.close()
    
    consecutive = 0
    for r in rows:
        if dict(r)["rating"] == 0:
            consecutive += 1
        else:
            break
    return consecutive


def analyze_attitude_field(reports: list) -> dict:
    """分析 attitude 字段的填充质量。"""
    # 这里用 summary 长度作为 attitude 填充情况的代理指标
    # 实际应用中应该有更精确的 attitude 字段
    short_count = 0  # 假定 summary 很短说明 attitude 提取不足
    total = len(reports)
    
    for r in reports:
        summary = r.get("summary", "") or ""
        if len(summary.strip()) < 15:
            short_count += 1
    
    return {
        "short_count": short_count,
        "total": total,
        "rate": short_count / max(total, 1),
    }


def analyze_premise_quality(reports: list) -> dict:
    """分析 premise 质量（通过 summary 推断）。"""
    # 实际应用中 premise 应该在 script_reports 或单独字段中
    short_premise = 0
    for r in reports:
        summary = r.get("summary", "") or ""
        # 假定过短的 summary 意味着 premise 提取不够具体
        if len(summary.strip()) < 20:
            short_premise += 1
    
    return {
        "short_count": short_premise,
        "total": len(reports),
        "rate": short_premise / max(len(reports), 1),
    }


def load_pending() -> list:
    if PENDING_FILE.exists():
        return json.loads(PENDING_FILE.read_text())
    return []


def save_pending(pending: list):
    PENDING_FILE.write_text(json.dumps(pending, ensure_ascii=False, indent=2))


def load_metrics() -> dict:
    if METRICS_FILE.exists():
        return json.loads(METRICS_FILE.read_text())
    return {}


def save_metrics(metrics: dict):
    METRICS_FILE.write_text(json.dumps(metrics, ensure_ascii=False, indent=2))


# ─── Trigger Check ───────────────────────────────────────────────────────────

def check_triggers() -> list:
    """检查所有触发条件，返回触发的列表。"""
    triggered = []
    reports = get_recent_reports(50)
    feedback = get_feedback_stats(30)
    consecutive_bad = get_consecutive_bad()
    
    now = datetime.now().isoformat()
    
    # 1. attitude_missing
    att = analyze_attitude_field(reports[: TRIGGERS["attitude_missing"]["lookback"]])
    if att["total"] >= 10 and att["rate"] > TRIGGERS["attitude_missing"]["threshold"]:
        triggered.append({
            "id": f"mon-{datetime.now().strftime('%Y%m%d%H%M%S')}-001",
            "trigger": "attitude_missing",
            "severity": "high" if att["rate"] > 0.5 else "medium",
            "details": {
                "current_rate": round(att["rate"], 3),
                "threshold": TRIGGERS["attitude_missing"]["threshold"],
                "window": f"last {att['total']} analyses",
            },
            "recent_cases": [
                {"id": r["id"], "summary_preview": (r.get("summary","") or "")[:50]}
                for r in reports[:5]
            ],
            "suggested_fix_direction": "attitude 和 theme 在 prompt 中定义重叠，导致 LLM 混淆。建议：在 prompt 中明确 attitude=动作词(讽刺/自嘲/批判)，theme=话题名词",
            "created_at": now,
        })
    
    # 2. premise_too_short
    pre = analyze_premise_quality(reports[: TRIGGERS["premise_too_short"]["lookback"]])
    if pre["total"] >= 10 and pre["rate"] > TRIGGERS["premise_too_short"]["threshold"]:
        triggered.append({
            "id": f"mon-{datetime.now().strftime('%Y%m%d%H%M%S')}-002",
            "trigger": "premise_too_short",
            "severity": "medium",
            "details": {
                "current_rate": round(pre["rate"], 3),
                "threshold": TRIGGERS["premise_too_short"]["threshold"],
                "window": f"last {pre['total']} analyses",
            },
            "recent_cases": [
                {"id": r["id"], "summary_preview": (r.get("summary","") or "")[:50]}
                for r in reports[:5]
            ],
            "suggested_fix_direction": "premise 提取过于笼统，建议 prompt 要求 premise 必须包含具体行为描述，字数≥15字",
            "created_at": now,
        })
    
    # 3. thumbs_down_rate
    if feedback["total"] >= 10 and feedback["down_rate"] > TRIGGERS["thumbs_down_rate"]["threshold"]:
        triggered.append({
            "id": f"mon-{datetime.now().strftime('%Y%m%d%H%M%S')}-003",
            "trigger": "thumbs_down_rate",
            "severity": "high",
            "details": {
                "current_rate": round(feedback["down_rate"], 3),
                "threshold": TRIGGERS["thumbs_down_rate"]["threshold"],
                "thumbs_down_count": feedback["thumbs_down"],
                "total_feedbacks": feedback["total"],
            },
            "suggested_fix_direction": "用户负反馈率偏高，需要结合具体 case 判断是哪个维度出了问题（attitude/premise/结构/技巧？）",
            "created_at": now,
        })
    
    # 4. consecutive_bad
    if consecutive_bad >= TRIGGERS["consecutive_bad"]["count"]:
        triggered.append({
            "id": f"mon-{datetime.now().strftime('%Y%m%d%H%M%S')}-004",
            "trigger": "consecutive_bad",
            "severity": "critical",
            "details": {
                "consecutive_count": consecutive_bad,
                "threshold": TRIGGERS["consecutive_bad"]["count"],
            },
            "suggested_fix_direction": "连续👎说明近期改动引入了回归，或特定类型的段子分析失败，需要立即处理",
            "created_at": now,
        })
    
    return triggered


def run_check(session_id: Optional[str] = None) -> dict:
    """每次分析完成后调用。"""
    pending = load_pending()
    
    triggered = check_triggers()
    
    if triggered:
        for item in triggered:
            # 避免重复添加
            existing_ids = [p.get("id", "")[:20] for p in pending]
            if not any(item["id"][:20] in eid for eid in existing_ids):
                pending.append(item)
                print(f"🚨 触发: {item['trigger']} (severity: {item['severity']})")
    
    save_pending(pending)
    
    return {
        "triggered": triggered,
        "pending_count": len(pending),
    }


def run_report() -> dict:
    """每小时趋势报告。"""
    reports = get_recent_reports(100)
    feedback = get_feedback_stats(50)
    att = analyze_attitude_field(reports[:50])
    pre = analyze_premise_quality(reports[:50])
    
    now = datetime.now().isoformat()
    
    # 读取昨天的数据做对比
    metrics = load_metrics()
    yesterday_att = metrics.get("last_attitude_rate", att["rate"])
    yesterday_pre = metrics.get("last_premise_rate", pre["rate"])
    yesterday_down = metrics.get("last_thumbs_down_rate", feedback["down_rate"])
    
    report = {
        "timestamp": now,
        "lookback": "last 50 analyses",
        "metrics": {
            "attitude_missing_rate": round(att["rate"], 3),
            "attitude_missing_rate_delta": round(att["rate"] - yesterday_att, 3),
            "premise_short_rate": round(pre["rate"], 3),
            "premise_short_rate_delta": round(pre["rate"] - yesterday_pre, 3),
            "thumbs_down_rate": round(feedback["down_rate"], 3),
            "thumbs_down_rate_delta": round(feedback["down_rate"] - yesterday_down, 3),
            "total_feedbacks": feedback["total"],
            "total_analyses": len(reports),
        },
        "triggers": [],
        "recommendations": [],
    }
    
    # 判断趋势
    if att["rate"] > 0.35:
        report["triggers"].append(f"⚠️ attitude空缺率 {att['rate']:.1%} 超标")
    if pre["rate"] > 0.40:
        report["triggers"].append(f"⚠️ premise过短率 {pre['rate']:.1%} 超标")
    if feedback["down_rate"] > 0.30:
        report["triggers"].append(f"⚠️ 👎率 {feedback['down_rate']:.1%} 超标")
    
    if att["rate"] > yesterday_att + 0.05:
        report["recommendations"].append(f"📈 attitude空缺率上升 {(att['rate']-yesterday_att):.1%}，需关注")
    if pre["rate"] > yesterday_pre + 0.05:
        report["recommendations"].append(f"📈 premise过短率上升 {(pre['rate']-yesterday_pre):.1%}，需关注")
    
    # 保存今天的指标供明天对比
    metrics["last_attitude_rate"] = att["rate"]
    metrics["last_premise_rate"] = pre["rate"]
    metrics["last_thumbs_down_rate"] = feedback["down_rate"]
    metrics["last_updated"] = now
    save_metrics(metrics)
    
    # 写入报告历史
    reports_dir = AGENT_DIR / "reports"
    reports_dir.mkdir(exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    report_file = reports_dir / f"{today}.json"
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    
    return report


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor.py check [--session-id XXX] | report")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "check":
        session_id = None
        if len(sys.argv) >= 3 and sys.argv[2] == "--session-id":
            session_id = sys.argv[3] if len(sys.argv) >= 4 else None
        result = run_check(session_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif cmd == "report":
        result = run_report()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
