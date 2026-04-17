from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from ..database import get_db, Script, Segment, SegmentAnalysis, ScriptReport, Project
from ..schemas import (
    AnalysisOut, SegmentDetailOut, SegmentAnalysisOut, ScriptReportOut,
    FilterRequest, FilterOut,
)

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/scripts/{script_id}/analysis", response_model=AnalysisOut)
def get_script_analysis(script_id: int, db: Session = Depends(get_db)):
    script = db.query(Script).filter(Script.id == script_id).first()
    if not script:
        raise HTTPException(404, "Script not found")

    segments = db.query(Segment).filter(Segment.script_id == script_id).order_by(Segment.index).all()

    # Batch load SegmentAnalysis (fixes N+1)
    seg_ids = [s.id for s in segments]
    analyses_map = {}
    if seg_ids:
        analyses = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id.in_(seg_ids)).all()
        for a in analyses:
            analyses_map[a.segment_id] = a

    starred_count = 0
    seg_outs = []
    for seg in segments:
        analysis = analyses_map.get(seg.id)
        starred = bool(analysis.starred) if analysis else False
        if starred:
            starred_count += 1

        seg_outs.append(SegmentDetailOut(
            id=seg.id,
            script_id=seg.script_id,
            index=seg.index,
            raw_text=seg.raw_text,
            start_char=seg.start_char,
            end_char=seg.end_char,
            starred=starred,
            analysis=SegmentAnalysisOut(
                id=analysis.id,
                segment_id=analysis.segment_id,
                structure=analysis.structure or "",
                structure_note=analysis.structure_note or "",
                attitude_object=analysis.attitude_object or "",
                attitude_type=analysis.attitude_type or "",
                attitude_insight=analysis.attitude_insight or "",
                techniques=analysis.techniques or "",
                technique_notes=analysis.technique_notes or "",
                problems=analysis.problems or "",
                problem_notes=analysis.problem_notes or "",
                notes=analysis.notes or "",
                notes_type=analysis.notes_type or "",
                inspiration=analysis.inspiration or "",
                analysis_text=analysis.analysis_text or "",
                starred=starred,
                created_at=analysis.created_at,
                updated_at=analysis.updated_at,
            ) if analysis else None,
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

    return AnalysisOut(
        script_id=script_id,
        actor_name=script.actor_name or "",
        show_name=script.show_name or "",
        title=script.title or "",
        report=report_out,
        segments=seg_outs,
        total_segments=len(seg_outs),
        starred_count=starred_count,
    )


@router.get("/segments/{segment_id}/analysis", response_model=SegmentDetailOut)
def get_segment_analysis(segment_id: int, db: Session = Depends(get_db)):
    seg = db.query(Segment).filter(Segment.id == segment_id).first()
    if not seg:
        raise HTTPException(404, "Segment not found")

    analysis = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id == seg.id).first()
    starred = bool(analysis.starred) if analysis else False

    return SegmentDetailOut(
        id=seg.id,
        script_id=seg.script_id,
        index=seg.index,
        raw_text=seg.raw_text,
        start_char=seg.start_char,
        end_char=seg.end_char,
        starred=starred,
        analysis=SegmentAnalysisOut(
            id=analysis.id,
            segment_id=analysis.segment_id,
            structure=analysis.structure or "",
            structure_note=analysis.structure_note or "",
            attitude_object=analysis.attitude_object or "",
            attitude_type=analysis.attitude_type or "",
            attitude_insight=analysis.attitude_insight or "",
            techniques=analysis.techniques or "",
            technique_notes=analysis.technique_notes or "",
            problems=analysis.problems or "",
            problem_notes=analysis.problem_notes or "",
            notes=analysis.notes or "",
            notes_type=analysis.notes_type or "",
            inspiration=analysis.inspiration or "",
            analysis_text=analysis.analysis_text or "",
            starred=starred,
            created_at=analysis.created_at,
            updated_at=analysis.updated_at,
        ) if analysis else None,
    )


@router.patch("/segments/{segment_id}/star", response_model=SegmentDetailOut)
def toggle_star(segment_id: int, starred: bool = True, db: Session = Depends(get_db)):
    seg = db.query(Segment).filter(Segment.id == segment_id).first()
    if not seg:
        raise HTTPException(404, "Segment not found")
    analysis = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id == seg.id).first()
    if analysis:
        analysis.starred = 1 if starred else 0
    else:
        analysis = SegmentAnalysis(segment_id=seg.id, starred=1 if starred else 0)
        db.add(analysis)
    db.commit()
    return get_segment_analysis(segment_id, db)


@router.post("/search/filter", response_model=FilterOut)
def filter_segments(data: FilterRequest, db: Session = Depends(get_db)):
    # Build base query
    q = db.query(Segment)

    if data.project_id is not None:
        q = q.join(Script).filter(Script.project_id == data.project_id)
    elif data.script_id is not None:
        q = q.filter(Segment.script_id == data.script_id)

    segments = q.all()

    # Batch load all SegmentAnalysis (fixes N+1)
    seg_ids = [s.id for s in segments]
    analyses_map = {}
    if seg_ids:
        analyses = db.query(SegmentAnalysis).filter(SegmentAnalysis.segment_id.in_(seg_ids)).all()
        for a in analyses:
            analyses_map[a.segment_id] = a

    results = []
    for seg in segments:
        analysis = analyses_map.get(seg.id)

        if data.starred_only:
            if not analysis or not analysis.starred:
                continue

        if data.structures:
            if not analysis or analysis.structure not in data.structures:
                continue

        if data.attitudes:
            if not analysis or analysis.attitude_type not in data.attitudes:
                continue

        if data.techniques:
            seg_techs = (analysis.techniques or "").split(",") if analysis else []
            if not any(t.strip() in data.techniques for t in seg_techs):
                continue

        if data.problems:
            seg_probs = (analysis.problems or "").split(",") if analysis else []
            if not any(p.strip() in data.problems for p in seg_probs):
                continue

        if data.keywords:
            text = (seg.raw_text or "") + (analysis.analysis_text or "") if analysis else seg.raw_text
            if not any(kw in text for kw in data.keywords):
                continue

        starred = bool(analysis.starred) if analysis else False
        results.append(SegmentDetailOut(
            id=seg.id,
            script_id=seg.script_id,
            index=seg.index,
            raw_text=seg.raw_text,
            start_char=seg.start_char,
            end_char=seg.end_char,
            starred=starred,
            analysis=SegmentAnalysisOut(
                id=analysis.id,
                segment_id=analysis.segment_id,
                structure=analysis.structure or "",
                structure_note=analysis.structure_note or "",
                attitude_object=analysis.attitude_object or "",
                attitude_type=analysis.attitude_type or "",
                attitude_insight=analysis.attitude_insight or "",
                techniques=analysis.techniques or "",
                technique_notes=analysis.technique_notes or "",
                problems=analysis.problems or "",
                problem_notes=analysis.problem_notes or "",
                notes=analysis.notes or "",
                notes_type=analysis.notes_type or "",
                inspiration=analysis.inspiration or "",
                analysis_text=analysis.analysis_text or "",
                starred=starred,
                created_at=analysis.created_at,
                updated_at=analysis.updated_at,
            ) if analysis else None,
        ))

    total = len(results)
    # Paginate
    start = (data.page - 1) * data.page_size
    end = start + data.page_size
    page_items = results[start:end]

    return FilterOut(segments=page_items, total=total)
