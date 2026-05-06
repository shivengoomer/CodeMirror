from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


Verdict = Literal[
    "accepted",
    "wrong_answer",
    "tle",
    "mle",
    "runtime_error",
    "compile_error",
]


class OverlayCopy(BaseModel):
    headline: str
    body: str
    call_to_action: str
    badge_label: str


class SubmissionIn(BaseModel):
    platform: str
    problem_title: str
    problem_slug: str
    language: str
    verdict: Verdict
    error_message: str | None = None
    code: str | None = None
    failing_cases: list[dict[str, Any]] = Field(default_factory=list)
    error_types: list[str] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)
    description: str = ""
    failing_pattern: str = ""
    confidence: float | None = None
    severity: Literal["low", "medium", "high"] | None = None
    is_recurring: bool = False
    matched_pattern_ids: list[str] = Field(default_factory=list)
    overlay: OverlayCopy | dict[str, Any] = Field(default_factory=dict)
    submitted_at: datetime | None = None


class SubmissionOut(BaseModel):
    id: int
    platform: str
    problem_title: str
    problem_slug: str
    verdict: str
    error_types: list[str]
    concepts: list[str]
    submitted_at: datetime

    model_config = {"from_attributes": True}


class PatternOut(BaseModel):
    id: str
    tag: str
    concept_cluster: list[str]
    title: str
    insight: str
    evidence: list[str]
    occurrence_count: int
    confidence: float
    impact: str
    suggested_revision_interval_days: int
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class RevisionQueueIn(BaseModel):
    problem_slug: str
    platform: str
    linked_pattern_tag: str | None = None
    last_verdict: Verdict = "wrong_answer"
    next_due: date
    interval_days: int = 1
    ease_factor: float = 2.5
    repetitions: int = 0


class DailySessionOut(BaseModel):
    session_date: date
    todays_session: list[dict[str, Any]]
    skipped_count: int
    next_session_preview: list[str]
    session_theme: str

    model_config = {"from_attributes": True}


class WeeklyDigestOut(BaseModel):
    week_start: date
    week_end: date
    payload: dict[str, Any]
    pushed_to_extension: bool

    model_config = {"from_attributes": True}


class ReanalyseRequest(BaseModel):
    limit: int = Field(default=30, ge=5, le=200)


class RevisionSessionRequest(BaseModel):
    today_date: date | None = None
    available_minutes: int | None = Field(default=None, ge=10, le=240)


class WeeklyDigestRequest(BaseModel):
    week_start: date
    week_end: date
