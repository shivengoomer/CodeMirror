from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import Platform
from app.schemas.common import ORMModel


class RevisionQueueItemBase(BaseModel):
    problem_slug: str = Field(max_length=200)
    platform: Platform
    problem_title: str = Field(max_length=300)
    linked_pattern_id: UUID | None = None
    interval_days: int = Field(default=1, ge=1)
    ease_factor: float = Field(default=2.5, ge=1.3)
    repetitions: int = Field(default=0, ge=0)
    next_due: date
    last_reviewed: datetime | None = None
    last_verdict: str | None = Field(default=None, max_length=50)


class RevisionQueueItemCreate(RevisionQueueItemBase):
    pass


class RevisionQueueItemUpdate(BaseModel):
    interval_days: int | None = Field(default=None, ge=1)
    ease_factor: float | None = Field(default=None, ge=1.3)
    repetitions: int | None = Field(default=None, ge=0)
    next_due: date | None = None
    last_reviewed: datetime | None = None
    last_verdict: str | None = Field(default=None, max_length=50)


class RevisionQueueItemResponse(RevisionQueueItemBase, ORMModel):
    id: UUID
    user_id: UUID
    added_at: datetime
