from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import PatternImpact
from app.schemas.common import ORMModel


class PatternBase(BaseModel):
    tag: str = Field(max_length=50)
    title: str = Field(max_length=100)
    insight: str
    concept_cluster: list[str]
    occurrence_count: int = Field(default=1, ge=1)
    confidence: float = Field(ge=0, le=1)
    impact: PatternImpact
    suggested_revision_interval_days: int = Field(default=7, ge=1)


class PatternCreate(PatternBase):
    pass


class PatternUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=100)
    insight: str | None = None
    concept_cluster: list[str] | None = None
    occurrence_count: int | None = Field(default=None, ge=1)
    confidence: float | None = Field(default=None, ge=0, le=1)
    impact: PatternImpact | None = None
    suggested_revision_interval_days: int | None = Field(default=None, ge=1)


class PatternResponse(PatternBase, ORMModel):
    id: UUID
    user_id: UUID
    first_seen: datetime
    last_seen: datetime
