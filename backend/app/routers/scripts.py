from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from ..database import get_db, Script, Segment, SegmentAnalysis, ScriptReport
from ..schemas import ScriptOut, ScriptDetailOut, SegmentOut, SegmentDetailOut, ScriptReportOut, ScriptTextUpload

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.get("", response_model=list[ScriptOut])
def list_scripts(
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Script)
    if project_id is not None:
        q = q.filter(Script.project_id == project_id)
    scripts = q.order_by(Script.updated_at.desc()).all()
    result = []
    for s in scripts:
        seg_count = db.query(Segment).filter(Segment.script_id == s.id).count()
        has_report = db.query(ScriptReport).filter(ScriptReport.script_id == s.id).first() is not None
        result.append(ScriptOut(
            id=s.id,
            project_id=s.project_id,
            filename=s.filename,
            actor_name=s.actor_name or "",
            show_name=s.show_name or "",
            title=s.title or "",
            segment_count=seg_count,
            has_report=has_report,
            created_at=s.created_at,
            updated_at=s.updated_at,
        ))
    return result


@router.post("/upload", response_model=ScriptOut, status_code=201)
async def upload_script(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="replace")

    script = Script(
        project_id=project_id,
        filename=file.filename,
        raw_text=text,
        cleaned_text="",
    )
    db.add(script)
    db.commit()
    db.refresh(script)

    seg_count = db.query(Segment).filter(Segment.script_id == script.id).count()
    return ScriptOut(
        id=script.id,
        project_id=script.project_id,
        filename=script.filename,
        actor_name=script.actor_name or "",
        show_name=script.show_name or "",
        title=script.title or "",
        segment_count=seg_count,
        has_report=False,
        created_at=script.created_at,
        updated_at=script.updated_at,
    )


@router.post("/text", response_model=ScriptOut, status_code=201)
async def upload_text(
    project_id: int = Query(..., description="项目ID"),
    body: ScriptTextUpload = ...,
    db: Session = Depends(get_db),
):
    """直接上传文本内容（粘贴文字）"""
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Text is empty")
    if len(text) > 500_000:
        raise HTTPException(400, "Text too long (max 500KB)")

    script = Script(
        project_id=project_id,
        filename=body.filename,
        raw_text=text,
        cleaned_text="",
    )
    db.add(script)
    db.commit()
    db.refresh(script)

    seg_count = db.query(Segment).filter(Segment.script_id == script.id).count()
    return ScriptOut(
        id=script.id,
        project_id=script.project_id,
        filename=script.filename,
        actor_name=script.actor_name or "",
        show_name=script.show_name or "",
        title=script.title or "",
        segment_count=seg_count,
        has_report=False,
        created_at=script.created_at,
        updated_at=script.updated_at,
    )


@router.get("/{script_id}", response_model=ScriptDetailOut)
def get_script(script_id: int, db: Session = Depends(get_db)):
    s = db.query(Script).filter(Script.id == script_id).first()
    if not s:
        raise HTTPException(404, "Script not found")

    segments = db.query(Segment).filter(Segment.script_id == script_id).order_by(Segment.index).all()
    seg_outs = []
    for seg in segments:
        analysis = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id == seg.id).first()
        starred = bool(analysis.starred) if analysis else False
        seg_outs.append(SegmentOut(
            id=seg.id,
            script_id=seg.script_id,
            index=seg.index,
            raw_text=seg.raw_text,
            start_char=seg.start_char,
            end_char=seg.end_char,
            starred=starred,
        ))

    report = db.query(ScriptReport).filter(ScriptReport.script_id == script_id).first()
    report_out = None
    if report:
        report_out = ScriptReportOut(
            id=report.id,
            script_id=report.script_id,
            summary=report.summary or "",
            strengths=report.strengths or "",
            weaknesses=report.weaknesses or "",
            methodology=report.methodology or "",
            key_insights=report.key_insights or "",
            overall_score=report.overall_score or 0.0,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    return ScriptDetailOut(
        id=s.id,
        project_id=s.project_id,
        filename=s.filename,
        actor_name=s.actor_name or "",
        show_name=s.show_name or "",
        title=s.title or "",
        raw_text=s.raw_text or "",
        cleaned_text=s.cleaned_text or "",
        segment_count=len(seg_outs),
        has_report=report is not None,
        created_at=s.created_at,
        updated_at=s.updated_at,
        segments=seg_outs,
        report=report_out,
    )


@router.delete("/{script_id}", status_code=204)
def delete_script(script_id: int, db: Session = Depends(get_db)):
    s = db.query(Script).filter(Script.id == script_id).first()
    if not s:
        raise HTTPException(404, "Script not found")
    db.delete(s)
    db.commit()
