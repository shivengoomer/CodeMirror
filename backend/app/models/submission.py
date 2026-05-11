import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import Platform, SubmissionVerdict, enum_values

if TYPE_CHECKING:
    from app.models.submission_tag import SubmissionTag
    from app.models.user import User


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index("idx_submissions_user_platform", "user_id", "platform"),
        Index("idx_submissions_user_analysed", "user_id", "analysed", postgresql_where=text("analysed = false")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,

    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform: Mapped[Platform] = mapped_column(
        Enum(Platform, name="platform_enum", values_callable=enum_values),
        nullable=False,
    )
    problem_slug: Mapped[str] = mapped_column(String(200), nullable=False)
    problem_title: Mapped[str] = mapped_column(String(300), nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    code_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[SubmissionVerdict] = mapped_column(
        Enum(SubmissionVerdict, name="submission_verdict_enum", values_callable=enum_values),
        nullable=False,
    )
    failing_test_cases: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'"))
    error_message: Mapped[str | None] = mapped_column(Text)
    runtime_ms: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    analysed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    ai_analysis: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship(back_populates="submissions")
    submission_tags: Mapped[list["SubmissionTag"]] = relationship(back_populates="submission", cascade="all, delete-orphan")
