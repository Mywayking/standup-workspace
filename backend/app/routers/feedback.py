"""
POST /api/feedback
Body: { "session_id": "xxx", "rating": 1 }
"""

import sys
from pathlib import Path
BASE_DIR = Path("/root/standup-workspace")
sys.path.insert(0, str(BASE_DIR / "backend"))

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from ..database import get_db, AnalysisFeedback
from agents.monitor import run_check

router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackRequest(BaseModel):
    session_id: str
    rating: int  # 1=👍 0=👎
    feedback_text: str = ""


@router.post("/feedback")
def submit_feedback(req: FeedbackRequest, db=Depends(get_db)):
    fb = AnalysisFeedback(
        session_id=req.session_id,
        rating=req.rating,
        feedback_text=req.feedback_text,
    )
    db.add(fb)
    db.commit()

    # 触发 Monitor Agent 检查（异步，非阻塞）
    try:
        result = run_check(session_id=req.session_id)
        # 只在触发问题时返回
        if result.get("triggered"):
            return {
                "status": "ok",
                "monitor_triggered": len(result["triggered"]),
            }
    except Exception:
        pass  # Monitor 失败不影响反馈提交

    return {"status": "ok"}


@router.get("/feedback/stats")
def feedback_stats(db=Depends(get_db)):
    """获取当前反馈统计。"""
    rows = db.execute(
        text("SELECT rating, COUNT(*) as cnt FROM analysis_feedback GROUP BY rating")
    ).fetchall()
    total = sum(r[1] for r in rows)
    down = next((r[1] for r in rows if r[0] == 0), 0)
    return {
        "total": total,
        "thumbs_down": down,
        "down_rate": down / max(total, 1),
    }
