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
    code: str | None = None
    verdict: Literal["accepted", "wrong_answer", "tle", "mle", "runtime_error", "compile_error"]
    failing_test_cases: list[FailingCase] = Field(default_factory=list)
    error_message: str | None = None
    timestamp: int
    leetcode_submission_id: int | None = None
    leetcode_session: str | None = None
    leetcode_csrf: str | None = None
    leetcode_headers: dict[str, str] | None = None


class AIAnalysis(BaseModel):
    root_cause: str
    failure_category: str
    what_they_thought: str
    what_is_actually_true: str
    code_evidence: str
    fix_direction: str
    pattern_signal: str | None = None
    severity: Literal["habit", "gap", "slip"]
    repair_exercise: str
    refactored_code: str | None = None


class SubmissionOut(BaseModel):
    id: UUID
    platform: str
    problem_slug: str
    problem_title: str
    language: str
    verdict: str
    submitted_at: datetime
    analysed: bool
    code_snapshot: str
    error_message: str | None = None
    failing_test_cases: list[FailingCase] = Field(default_factory=list)
    ai_analysis: dict | None = None  # May contain full AIAnalysis or temporary backfill metadata

    model_config = ConfigDict(from_attributes=True)


class OverlayData(BaseModel):
    headline: str
    body: str
    call_to_action: str
    badge_label: str
    error_types: list[str]
    concepts: list[str]
    is_recurring: bool
    ai_analysis: dict | None = None


class SubmissionResponse(BaseModel):
    submission_id: UUID
    overlay_data: OverlayData


class SubmissionListResponse(BaseModel):
    items: list[SubmissionOut]
    total: int
    limit: int
    offset: int


class LatestLeetCodeAnalyzeResponse(BaseModel):
    status: str
    submission_id: UUID | None = None
    problem_slug: str | None = None
    verdict: str | None = None
    overlay_data: OverlayData | None = None

class SubmissionStats(BaseModel):
    weekly_total: int
    weekly_failed: int
    weekly_accepted: int
    failure_rate: float
