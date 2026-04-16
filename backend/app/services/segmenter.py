"""
Text segmenter for standup comedy scripts.
Splits raw text into logical analysis units.
"""
import re
from dataclasses import dataclass
from typing import Iterator


@dataclass
class Segment:
    index: int
    raw_text: str
    start_char: int
    end_char: int


# Pattern: double newlines + optional pause indicators
SPLIT_PATTERNS = [
    re.compile(r'\n\n+'),           # double newline
    re.compile(r'\n(?=---|\n.{0,3}\n)'),  # short line then blank
    re.compile(r'(?<=[。！？!?])\s*(?=\n)'),  # sentence-ending punct + newline
    re.compile(r'\n(?=\S{2,40}[:：]\s)'),   # speaker label before line
]


def clean_text(raw: str) -> str:
    """Basic cleaning: normalize whitespace, remove noise."""
    text = raw.replace('\r\n', '\n').replace('\r', '\n')
    # Collapse more than 2 consecutive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove leading/trailing whitespace on each line
    lines = [ln.strip() for ln in text.splitlines()]
    return '\n'.join(lines)


def extract_metadata(text: str) -> dict:
    """
    Attempt to extract actor_name, show_name, title from text.
    Looks for common patterns at the top of the file.
    """
    result = {"actor_name": "", "show_name": "", "title": ""}
    lines = text.splitlines()[:20]  # only first 20 lines

    # Pattern: "演员：xxx" or "Actor: xxx"
    actor_re = re.compile(r'(?:演员|Actor| comedian)[:：]\s*(.+)', re.IGNORECASE)
    # Pattern: "节目：xxx" or "Show: xxx"
    show_re  = re.compile(r'(?:节目|Show|来自|venue)[:：]\s*(.+)', re.IGNORECASE)
    # Pattern: "标题：xxx" or "Title: xxx"
    title_re = re.compile(r'(?:标题|Title)[:：]\s*(.+)', re.IGNORECASE)

    for ln in lines:
        if not result["actor_name"]:
            m = actor_re.search(ln)
            if m:
                result["actor_name"] = m.group(1).strip()
        if not result["show_name"]:
            m = show_re.search(ln)
            if m:
                result["show_name"] = m.group(1).strip()
        if not result["title"]:
            m = title_re.search(ln)
            if m:
                result["title"] = m.group(1).strip()

    # If title still empty, try to use first non-empty non-actor line as title
    if not result["title"]:
        for ln in lines:
            ln_s = ln.strip()
            if ln_s and not actor_re.search(ln) and not show_re.search(ln) and len(ln_s) < 100:
                result["title"] = ln_s
                break

    return result


def split_segments(text: str, min_chars: int = 50) -> Iterator[Segment]:
    """
    Split text into segments based on double newlines, sentence endings,
    and speaker labels.
    
    Yields Segment dataclasses with character offsets.
    """
    cleaned = clean_text(text)
    
    # Try splitting by double newlines first
    blocks = re.split(r'\n\n+', cleaned)
    
    # If too few blocks, try harder split
    if len(blocks) < 3:
        # split by single newlines that look like line breaks within a thought
        blocks = re.split(r'(?<=[。！？!?\.,;])\n(?=[^\n])', cleaned)
    
    # If still too few, split by sentence endings
    if len(blocks) < 3:
        # split every ~300 chars on sentence boundaries
        chunks = []
        current = ""
        for line in cleaned.splitlines():
            if len(current) + len(line) > 300 and current:
                chunks.append(current)
                current = line
            else:
                current = (current + "\n" + line).strip()
        if current:
            chunks.append(current)
        blocks = chunks

    index = 0
    char_pos = 0
    for block in blocks:
        block = block.strip()
        if len(block) < min_chars:
            # merge with next block if too short
            continue
        
        start = text.find(block, char_pos)
        if start == -1:
            start = char_pos
        
        segment = Segment(
            index=index,
            raw_text=block,
            start_char=start,
            end_char=start + len(block),
        )
        yield segment
        index += 1
        char_pos = segment.end_char


def segment_text(text: str) -> list[Segment]:
    """Convenience wrapper: returns a list of Segments."""
    return list(split_segments(text))
