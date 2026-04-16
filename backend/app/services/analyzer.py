"""
7-step analysis pipeline for standup comedy scripts.
Coordinates segmenter + mmx_client to produce full analysis results.
"""
import asyncio
import logging
from typing import Callable, Optional

from sqlalchemy.orm import Session

from ..database import (
    Script, Segment, SegmentAnalysis, ScriptReport, AnalysisJob,
)
from .mmx_client import MmXClient
from .segmenter import clean_text, extract_metadata, segment_text


logger = logging.getLogger(__name__)


def _publish(job: AnalysisJob, message: str, step: int, step_name: str, progress: float, db: Session):
    """Update job progress in DB."""
    job.message = message
    job.step = step
    job.step_name = step_name
    job.progress = progress
    job.status = "running"
    db.commit()


async def run_analysis_pipeline(
    script_id: int,
    db: Session,
    minmax_api_key: str,
    minmax_base_url: str,
    job_id: int,
    progress_callback: Optional[Callable] = None,
):
    """
    Full 7-step analysis pipeline. Can be run synchronously or via background task.
    
    Steps:
      1. Preprocess — clean text, extract metadata
      2. Segment — split into analysis units
      3. Structure — identify structural role of each segment
      4. Label — attitude, technique, problem labels per segment
      5. Problems — identify issues
      6. Notes — generate notes per segment
      7. Aggregate — produce script report
    """
    mmx = MmXClient(api_key=minmax_api_key, base_url=minmax_base_url)

    job: AnalysisJob = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise ValueError(f"Job {job_id} not found")

    script: Script = db.query(Script).filter(Script.id == script_id).first()
    if not script:
        raise ValueError(f"Script {script_id} not found")

    # ── Step 1: Preprocess ────────────────────────────────────────────────
    _publish(job, "正在预处理文本...", 1, "预处理", 0.05, db)
    if progress_callback:
        await progress_callback(job)

    cleaned = clean_text(script.raw_text)
    script.cleaned_text = cleaned
    metadata = extract_metadata(script.raw_text)
    script.actor_name = metadata.get("actor_name", script.actor_name)
    script.show_name = metadata.get("show_name", script.show_name)
    if metadata.get("title"):
        script.title = metadata.get("title", script.title)
    db.commit()

    # ── Step 2: Segment ───────────────────────────────────────────────────
    _publish(job, "正在切分段落...", 2, "切段", 0.10, db)
    if progress_callback:
        await progress_callback(job)

    # Delete old segments
    db.query(Segment).filter(Segment.script_id == script_id).delete()
    db.commit()

    segments = segment_text(cleaned)
    for seg_data in segments:
        seg = Segment(
            script_id=script_id,
            index=seg_data.index,
            raw_text=seg_data.raw_text,
            start_char=seg_data.start_char,
            end_char=seg_data.end_char,
        )
        db.add(seg)
    db.commit()

    # Reload to get IDs
    segs = db.query(Segment).filter(Segment.script_id == script_id).order_by(Segment.index).all()
    total = len(segs)
    logger.info(f"[Step 2] Split into {total} segments")

    # ── Steps 3-6: Per-segment analysis ───────────────────────────────────
    failed_count = 0

    for i, seg in enumerate(segs):
        pct_base = 0.15 + 0.60 * (i / max(total - 1, 1))
        fail_hint = f"（{failed_count}段失败）" if failed_count else ""

        # Structure identification (step 3)
        _publish(job, f"[{i+1}/{total}] 分析中{fail_hint}", 3, "结构识别", pct_base * 0.6, db)
        if progress_callback:
            await progress_callback(job)

        # Full analysis via mmx (steps 3-6 in one call)
        try:
            analysis_data = mmx.analyze_segment(
                seg.raw_text,
                context={"segment_index": i, "total_segments": total}
            )
        except Exception as exc:
            logger.warning(f"[Segment {i}] mmx error: {exc}")
            failed_count += 1
            # Short error message (no stack trace in analysis_text)
            err_msg = str(exc)[:80]
            analysis_data = {
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
                "analysis_text": f"[Analysis error: {err_msg}]",
            }

        # Save/update segment analysis
        existing = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id == seg.id).first()
        if existing:
            for k, v in analysis_data.items():
                setattr(existing, k, v)
        else:
            sa = SegmentAnalysis(segment_id=seg.id, **analysis_data)
            db.add(sa)

        db.commit()

        _publish(
            job,
            f"[{i+1}/{total}] 完成{fail_hint}",
            6,
            "段落分析",
            pct_base,
            db,
        )
        if progress_callback:
            await progress_callback(job)

    # ── Step 7: Aggregate ────────────────────────────────────────────────
    _publish(job, "正在生成整篇报告...", 7, "聚合输出", 0.90, db)
    if progress_callback:
        await progress_callback(job)

    all_segs = db.query(Segment).filter(Segment.script_id == script_id).order_by(Segment.index).all()
    all_analyses = []
    for s in all_segs:
        a = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id == s.id).first()
        if a:
            all_analyses.append({c.name: getattr(a, c.name) for c in a.__table__.columns})

    try:
        report_data = mmx.generate_report(
            all_analyses,
            actor_name=script.actor_name,
            title=script.title,
        )
    except Exception as exc:
        logger.warning(f"[Report] mmx error: {exc}")
        report_data = {
            "summary": f"[Report generation error: {exc}]",
            "strengths": "",
            "weaknesses": "",
            "methodology": "",
            "key_insights": "",
            "overall_score": 0.5,
        }

    existing_report = db.query(ScriptReport).filter(ScriptReport.script_id == script_id).first()
    if existing_report:
        for k, v in report_data.items():
            setattr(existing_report, k, v)
    else:
        sr = ScriptReport(script_id=script_id, **report_data)
        db.add(sr)
    db.commit()

    # ── Done ───────────────────────────────────────────────────────────────
    job.status = "completed"
    job.progress = 1.0
    job.message = (
        f"分析完成（{failed_count}段失败）" if failed_count
        else "分析完成"
    )
    job.completed_at = __import__("datetime").datetime.utcnow()
    db.commit()
    if progress_callback:
        await progress_callback(job)

    logger.info(f"[Analysis] script_id={script_id} completed, failed_segments={failed_count}")
