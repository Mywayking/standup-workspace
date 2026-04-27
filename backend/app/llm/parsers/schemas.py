from pydantic import BaseModel, Field
from typing import List, Optional

class PremiseItem(BaseModel):
    premise: str
    reason: Optional[str] = None
    score: Optional[float] = None

class PremiseResult(BaseModel):
    recommended: PremiseItem
    alternatives: List[PremiseItem] = Field(default_factory=list)

class JokeToPremiseItem(BaseModel):
    premise: str
    logic: Optional[str] = None
    hidden_assumption: Optional[str] = None

class JokeToPremiseResult(BaseModel):
    candidates: List[JokeToPremiseItem]

class AngleItem(BaseModel):
    angle: str
    technique: Optional[str] = None
    example: Optional[str] = None

class AnglesResult(BaseModel):
    angles: List[AngleItem]

class RewriteResult(BaseModel):
    polished_script: str
    highlights: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
