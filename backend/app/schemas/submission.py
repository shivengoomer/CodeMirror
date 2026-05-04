from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import Platform, SubmissionVerdict
from app.schemas.common import ORMModel


class FailingCase(BaseModel):
    input: Any
    expected: Any | None = None
    got: Any | None = None


class SubmissionBase(BaseModel):
    platform: Platform
    problem_slug: str = Field(max_length=200)
    problem_title: str = Field(max_length=300)
    language: str = Field(max_length=50)
    code_snapshot: str
    verdict: SubmissionVerdict
    failing_test_cases: list[FailingCase] = Field(default_factory=list)
    error_message: str | None = None
    runtime_ms: int | None = Field(default=None, ge=0)
    submitted_at: datetime


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    analysed: bool | None = None


class SubmissionResponse(SubmissionBase, ORMModel):
    id: UUID
    user_id: UUID
    analysed: bool


class UnifiedSubmissionIn(BaseModel):
    platform: Platform
    problem_slug: str = Field(max_length=200)
    problem_title: str = Field(max_length=300)
    language: str = Field(max_length=50)
    code: str
    verdict: SubmissionVerdict
    failing_test_cases: list[FailingCase] = Field(default_factory=list)
    error_message: str | None = None
    runtime_ms: int | None = Field(default=None, ge=0)
    timestamp: int


class SubmissionIngestResponse(BaseModel):
    submission_id: UUID
    overlay_data: dict[str, Any]


class SubmissionListResponse(BaseModel):
    items: list[SubmissionResponse]
    total: int
    limit: int
    offset: int
