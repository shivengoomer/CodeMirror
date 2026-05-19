"""AI Analysis — detailed AI output per submission."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"
    __table_args__ = (
        Index("idx_ai_analysis_submission", "submission_id"),
        Index("idx_ai_analysis_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Code Review
    logical_mistakes: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    pattern_mistakes: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    syntax_issues: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    edge_cases_missed: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # Complexity
    time_complexity: Mapped[str | None] = mapped_column(String(50))
    space_complexity: Mapped[str | None] = mapped_column(String(50))
    complexity_explanation: Mapped[str | None] = mapped_column(Text)

    # Improvements
    better_approach: Mapped[str | None] = mapped_column(Text)
    refactored_code: Mapped[str | None] = mapped_column(Text)
    optimization_suggestions: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # Metadata
    confidence_score: Mapped[float | None] = mapped_column(Float)
    analysis_version: Mapped[str | None] = mapped_column(String(20))
    processing_time_ms: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
