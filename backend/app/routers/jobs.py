import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db, Script, AnalysisJob, SessionLocal
from ..schemas import JobOut
from ..config import settings

router = APIRouter(prefix="/api", tags=["jobs"])
logger = logging.getLogger(__name__)


def _run_analysis_sync(job_id: int, script_id: int):
    """Sync wrapper that runs analysis in a fresh event loop."""
    import asyncio
    from ..database import SessionLocal
    from ..services.analyzer import run_analysis_pipeline

    db = SessionLocal()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                run_analysis_pipeline(
                    script_id=script_id,
                    db=db,
                    minmax_api_key=settings.minimax_api_key,
                    minmax_base_url=settings.minimax_base_url,
                    job_id=job_id,
                )
            )
        finally:
            loop.close()
    except Exception as exc:
        logger.error(f"[Job {job_id}] analysis failed: {exc}")
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.message = f"分析失败: {exc}"
            db.commit()
    finally:
        db.close()


@router.post("/scripts/{script_id}/analyze", response_model=JobOut, status_code=201)
def create_analysis_job(script_id: int, db: Session = Depends(get_db), background_tasks: BackgroundTasks = None):
    script = db.query(Script).filter(Script.id == script_id).first()
    if not script:
        raise HTTPException(404, "Script not found")

    # Cancel any existing pending/running jobs for this script
    db.query(AnalysisJob).filter(
        AnalysisJob.script_id == script_id,
        AnalysisJob.status.in_(["pending", "running"]),
    ).update({"status": "failed", "error": "Superseded by new job"})

    job = AnalysisJob(
        script_id=script_id,
        status="pending",
        step=0,
        step_name="已创建",
        progress=0.0,
        message="等待分析...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Use BackgroundTasks (proper async-in-sync FastAPI pattern)
    if background_tasks:
        background_tasks.add_task(_run_analysis_sync, job.id, script_id)
    else:
        import threading
        t = threading.Thread(target=_run_analysis_sync, args=(job.id, script_id), daemon=True)
        t.start()

    return JobOut(
        id=job.id,
        script_id=job.script_id,
        status=job.status,
        step=job.step,
        step_name=job.step_name,
        progress=job.progress,
        message=job.message,
        error=job.error or "",
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
    )


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return JobOut(
        id=job.id,
        script_id=job.script_id,
        status=job.status,
        step=job.step,
        step_name=job.step_name,
        progress=job.progress,
        message=job.message,
        error=job.error or "",
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
    )


@router.get("/jobs/{job_id}/stream")
def stream_job(job_id: int, db: Session = Depends(get_db)):
    """SSE stream for job progress."""
    def event_stream():
        import time
        checked: set[str] = set()

        while True:
            db = SessionLocal()
            try:
                job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
                if not job:
                    yield f"event: error\ndata: Job not found\n\n"
                    break

                key = f"{job.status}:{job.progress}:{job.message}"
                if key not in checked or job.status in ("completed", "failed"):
                    payload = (
                        f"event: progress\n"
                        f"data: {job.status}|{job.step}|{job.step_name}|{job.progress:.3f}|{job.message}|{job.error or ''}\n\n"
                    )
                    yield payload
                    checked.add(key)

                if job.status in ("completed", "failed"):
                    break
            finally:
                db.close()

            time.sleep(1.0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
