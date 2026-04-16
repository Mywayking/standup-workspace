"""
Knowledge Base search — reads from local comedy-kb JSONL files.
Cached in memory for fast repeated searches.
"""
import json
import os
import re
import logging
from collections import defaultdict
from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kb", tags=["knowledge_base"])

KB_DIR = "/var/www/alwayshaha/comedy-kb/data"
SEGMENTS_FILE = os.path.join(KB_DIR, "segments.jsonl")
MANIFEST_FILE = os.path.join(KB_DIR, "manifest.json")


# ─── Types ────────────────────────────────────────────────────────────────────

class KbSegment(BaseModel):
    segment_id: str
    doc_id: str
    performer_name: str
    show: str
    round_code: str
    sequence: int
    text: str
    analysis: str
    full_segment: str
    emotion_tags: list[str]
    technique_tags: list[str]
    theme_tags: list[str]
    summary: str
    retrieval_text: str


class KbSearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    segments: list[KbSegment]


class KbStatsResponse(BaseModel):
    total_segments: int
    total_docs: int
    top_themes: list[list]
    top_techniques: list[list]
    top_emotions: list[list]
    top_performers: list[list]
    shows: dict[str, int]


# ─── Cache ────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    with open(MANIFEST_FILE, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_all_segments() -> list[dict]:
    """Load all KB segments into memory (~26MB)."""
    segments = []
    with open(SEGMENTS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                segments.append(json.loads(line))
    logger.info(f"[KB] Loaded {len(segments)} segments")
    return segments


def _normalize_text(text: str) -> str:
    """Lightweight text normalization for search."""
    return re.sub(r"\s+", " ", text).lower()


def _segment_score(seg: dict, q: str, themes: list[str], techniques: list[str], performers: list[str]) -> float:
    """Rank segments by relevance."""
    score = 0.0
    q_norm = _normalize_text(q)
    text_norm = _normalize_text(seg.get("text", ""))
    analysis_norm = _normalize_text(seg.get("analysis", ""))

    if q_norm:
        # Title-case and substring matches
        if q_norm in text_norm:
            score += 10.0
        if q_norm in analysis_norm:
            score += 5.0
        # Word overlap
        q_words = set(q_norm.split())
        text_words = set(text_norm.split())
        overlap = q_words & text_words
        score += len(overlap) * 1.0

    # Theme filter
    if themes:
        seg_themes = [t.lower() for t in seg.get("theme_tags", [])]
        score += len(set(themes) & set(seg_themes)) * 3.0

    # Technique filter
    if techniques:
        seg_techs = [t.lower() for t in seg.get("technique_tags", [])]
        score += len(set(techniques) & set(seg_techs)) * 3.0

    # Performer filter
    if performers:
        seg_perf = seg.get("performer_name", "").lower()
        for p in performers:
            if p.lower() in seg_perf:
                score += 2.0
                break

    return score


@router.get("/stats", response_model=KbStatsResponse)
def get_stats():
    """Return KB statistics."""
    manifest = _load_manifest()
    return KbStatsResponse(
        total_segments=manifest.get("segments_count", 0),
        total_docs=manifest.get("docs_count", 0),
        top_themes=manifest.get("top_themes", []),
        top_techniques=manifest.get("top_techniques", []),
        top_emotions=manifest.get("top_emotions", []),
        top_performers=manifest.get("top_performers", []),
        shows=manifest.get("shows", {}),
    )


@router.get("/search", response_model=KbSearchResponse)
def search_segments(
    q: str = Query("", description="Search query (text in segment or analysis)"),
    theme: str = Query("", description="Comma-separated theme filters"),
    technique: str = Query("", description="Comma-separated technique filters"),
    emotion: str = Query("", description="Comma-separated emotion filters"),
    performer: str = Query("", description="Performer name (partial match)"),
    show: str = Query("", description="Show name filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Search the knowledge base with optional filters.
    Returns paginated results ranked by relevance.
    """
    all_segs = _load_all_segments()

    themes = [t.strip() for t in theme.split(",") if t.strip()]
    techniques = [t.strip() for t in technique.split(",") if t.strip()]
    emotions = [e.strip() for e in emotion.split(",") if e.strip()]
    performers = [p.strip() for p in performer.split(",") if p.strip()]

    # Score and filter
    scored = []
    for seg in all_segs:
        score = _segment_score(seg, q, themes, techniques, performers)
        if score <= 0:
            # No query = show all (for initial load)
            if q or themes or techniques or performers:
                continue

        # Additional show filter
        if show:
            if show.lower() not in seg.get("show", "").lower():
                continue

        # Emotion filter
        if emotions:
            seg_emotions = [e.lower() for e in seg.get("emotion_tags", [])]
            if not set(emotions) & set(seg_emotions):
                continue

        scored.append((score, seg))

    # Sort by score descending, then by segment_id for stability
    scored.sort(key=lambda x: (-x[0], x[1].get("segment_id", "")))

    total = len(scored)
    start = (page - 1) * page_size
    end = start + page_size
    page_segs = scored[start:end]

    segments = [
        KbSegment(
            segment_id=s.get("segment_id", ""),
            doc_id=s.get("doc_id", ""),
            performer_name=s.get("performer_name", ""),
            show=s.get("show", ""),
            round_code=s.get("round_code", ""),
            sequence=s.get("sequence", 0),
            text=s.get("text", ""),
            analysis=s.get("analysis", ""),
            full_segment=s.get("full_segment", ""),
            emotion_tags=s.get("emotion_tags", []),
            technique_tags=s.get("technique_tags", []),
            theme_tags=s.get("theme_tags", []),
            summary=s.get("summary", ""),
            retrieval_text=s.get("retrieval_text", ""),
        )
        for _, s in page_segs
    ]

    return KbSearchResponse(
        total=total,
        page=page,
        page_size=page_size,
        segments=segments,
    )
