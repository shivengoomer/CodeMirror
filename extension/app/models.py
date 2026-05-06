from datetime import UTC, datetime, date
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Verdict(StrEnum):
    accepted = "accepted"
    wrong_answer = "wrong_answer"
    tle = "tle"
    mle = "mle"
    runtime_error = "runtime_error"
    compile_error = "compile_error"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    submissions: Mapped[list["Submission"]] = relationship(back_populates="user")
    patterns: Mapped[list["Pattern"]] = relationship(back_populates="user")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(64), index=True)
    problem_title: Mapped[str] = mapped_column(String(255))
    problem_slug: Mapped[str] = mapped_column(String(255), index=True)
    language: Mapped[str] = mapped_column(String(64))
    verdict: Mapped[Verdict] = mapped_column(String(32), index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    code: Mapped[str | None] = mapped_column(Text)
    failing_cases: Mapped[list[dict]] = mapped_column(JSON, default=list)
    error_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    concepts: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    failing_pattern: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float | None] = mapped_column(Float)
    severity: Mapped[str | None] = mapped_column(String(16))
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    matched_pattern_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    overlay: Mapped[dict] = mapped_column(JSON, default=dict)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )

    user: Mapped[User] = relationship(back_populates="submissions")


class Pattern(Base):
    __tablename__ = "patterns"
    __table_args__ = (UniqueConstraint("user_id", "title", "tag", name="uq_pattern_identity"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tag: Mapped[str] = mapped_column(String(64), index=True)
    concept_cluster: Mapped[list[str]] = mapped_column(JSON, default=list)
    title: Mapped[str] = mapped_column(String(255))
    insight: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[str]] = mapped_column(JSON, default=list)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0)
    impact: Mapped[str] = mapped_column(String(16), index=True)
    suggested_revision_interval_days: Mapped[int] = mapped_column(Integer, default=7)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="patterns")


class RevisionQueueItem(Base):
    __tablename__ = "revision_queue"
    __table_args__ = (
        UniqueConstraint("user_id", "problem_slug", "platform", name="uq_revision_problem"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    problem_slug: Mapped[str] = mapped_column(String(255), index=True)
    platform: Mapped[str] = mapped_column(String(64))
    linked_pattern_tag: Mapped[str | None] = mapped_column(String(64))
    last_verdict: Mapped[Verdict] = mapped_column(String(32))
    next_due: Mapped[date] = mapped_column(Date, index=True)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class DailySession(Base):
    __tablename__ = "daily_sessions"
    __table_args__ = (UniqueConstraint("user_id", "session_date", name="uq_daily_session"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    session_date: Mapped[date] = mapped_column(Date, index=True)
    todays_session: Mapped[list[dict]] = mapped_column(JSON, default=list)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    next_session_preview: Mapped[list[str]] = mapped_column(JSON, default=list)
    session_theme: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class WeeklyDigest(Base):
    __tablename__ = "weekly_digests"
    __table_args__ = (UniqueConstraint("user_id", "week_start", "week_end", name="uq_weekly_digest"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    week_end: Mapped[date] = mapped_column(Date, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    pushed_to_extension: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
