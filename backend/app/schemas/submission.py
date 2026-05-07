from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FailingCase(BaseModel):
    input: str
    expected: str
    got: str


class UnifiedSubmissionIn(BaseModel):
    platform: Literal["leetcode", "gfg", "hackerrank"]
    problem_slug: str
    problem_title: str
    language: str
    code: str
    verdict: Literal["wrong_answer", "tle", "mle", "runtime_error", "compile_error"]
    failing_test_cases: list[FailingCase] = Field(default_factory=list)
    error_message: str | None = None
    timestamp: int
    leetcode_submission_id: int | None = None
    leetcode_session: str | None = None
    leetcode_csrf: str | None = None
    leetcode_headers: dict[str, str] | None = None


class SubmissionOut(BaseModel):
    id: UUID
    platform: str
    problem_slug: str
    problem_title: str
    language: str
    verdict: str
    submitted_at: datetime
    analysed: bool

    model_config = ConfigDict(from_attributes=True)


class OverlayData(BaseModel):
    headline: str
    body: str
    call_to_action: str
    badge_label: str
    error_types: list[str]
    concepts: list[str]
    is_recurring: bool


class SubmissionResponse(BaseModel):
    submission_id: UUID
    overlay_data: OverlayData
