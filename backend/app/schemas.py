from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ─── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    script_count: int = 0

    class Config:
        from_attributes = True


# ─── Script ────────────────────────────────────────────────────────────────────

class ScriptOut(BaseModel):
    id: int
    project_id: int
    filename: str
    actor_name: str
    show_name: str
    title: str
    segment_count: int = 0
    has_report: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScriptDetailOut(ScriptOut):
    raw_text: str = ""
    cleaned_text: str = ""


class ScriptTextUpload(BaseModel):
    """文本粘贴上传请求体"""
    text: str
    filename: str = "粘贴文本.txt"


# ─── Segment ───────────────────────────────────────────────────────────────────

class SegmentOut(BaseModel):
    id: int
    script_id: int
    index: int
    raw_text: str
    start_char: int
    end_char: int
    starred: bool = False

    class Config:
        from_attributes = True


class SegmentAnalysisOut(BaseModel):
    id: int
    segment_id: int
    structure: str
    structure_note: str
    attitude_object: str
    attitude_type: str
    attitude_insight: str
    techniques: str
    technique_notes: str
    problems: str
    problem_notes: str
    notes: str
    notes_type: str
    inspiration: str
    analysis_text: str
    starred: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SegmentDetailOut(SegmentOut):
    analysis: Optional[SegmentAnalysisOut] = None

    class Config:
        from_attributes = True


# ─── Report ───────────────────────────────────────────────────────────────────

class ScriptReportOut(BaseModel):
    id: int
    script_id: int
    summary: str
    strengths: str
    weaknesses: str
    methodology: str
    key_insights: str
    overall_score: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Job ──────────────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: int
    script_id: int
    status: str
    step: int
    step_name: str
    progress: float
    message: str
    error: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobProgressSSE(BaseModel):
    event: str = "progress"
    job_id: int
    status: str
    step: int
    step_name: str
    progress: float
    message: str


# ─── Analysis ─────────────────────────────────────────────────────────────────

class AnalysisOut(BaseModel):
    script_id: int
    actor_name: str
    show_name: str
    title: str
    report: Optional[ScriptReportOut] = None
    segments: list[SegmentDetailOut] = []
    total_segments: int = 0
    starred_count: int = 0


class FilterRequest(BaseModel):
    script_id: Optional[int] = None
    project_id: Optional[int] = None
    keywords: list[str] = []
    structures: list[str] = []
    attitudes: list[str] = []
    techniques: list[str] = []
    problems: list[str] = []
    starred_only: bool = False
    page: int = 1
    page_size: int = 20


class FilterOut(BaseModel):
    segments: list[SegmentDetailOut] = []
    total: int


# ─── Export ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    format: str = Field(default="json", pattern="^(docx|md|json)$")
    script_id: int
    include_raw: bool = True
    include_analysis: bool = True


# Update forward refs
ScriptDetailOut.model_rebuild()


# ─── Write / Comedy Tools ─────────────────────────────────────────────────────

class PremiseCandidate(BaseModel):
    text: str
    type: str = ""
    description: str = ""


class PremiseRecommendation(BaseModel):
    text: str
    reason: str = ""
    best_type: str = ""


class ExtractPremiseResult(BaseModel):
    theme: str = ""
    attitude: str = ""
    conflict: str = ""
    premise_candidates: list[PremiseCandidate] = []
    recommendation: PremiseRecommendation | None = None
    scene_suggestions: list[str] = []
    expansion_directions: list[str] = []
    ending_direction: str = ""


class JTPAnalysis(BaseModel):
    input_type: str = ""
    joke_type: str = ""
    core_topic: str = ""
    core_conflict: str = ""
    emotion: list[str] = []
    humor_mechanism: str = ""


class JTPPremise(BaseModel):
    id: str = "p1"
    title: str = ""
    why_it_works: str = ""
    setup_direction: str = ""
    persona: str = ""
    emotion: str = ""
    opening_line: str = ""


class JokeToPremiseResult(BaseModel):
    premises: list[JTPPremise] = []


class AngleItem(BaseModel):
    name: str = ""
    premise: str = ""
    expansion_idea: str = ""
    scene_direction: str = ""
    ending_direction: str = ""


class FindAnglesResult(BaseModel):
    current_problem: dict = Field(default_factory=dict)
    angles: list[AngleItem] = []
    recommendation: dict = Field(default_factory=dict)


class ScriptChange(BaseModel):
    location: str = ""
    original: str = ""
    improved: str = ""
    reason: str = ""
    technique_added: str = ""


class AnalyzeResult(BaseModel):
    evaluation: dict = Field(default_factory=dict)
    performer_tags: list[str] = []
    premise: str = ""
    theme_refined: str = ""
    comedy_type: str = ""
    structures: str = ""
    techniques: list[str] = []
    segments: list[dict] = []
    improved_script: str = ""
    script_changes: list[ScriptChange] = []
    style_hints: list[str] = []
    next_suggestion: str = ""
