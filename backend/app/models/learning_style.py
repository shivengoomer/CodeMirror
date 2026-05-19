"""Learning Style — behavioral analysis per user."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LearningStyle(Base):
    __tablename__ = "learning_style"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    # Behavioral traits (scores 0-100)
    rushing_score: Mapped[float | None] = mapped_column(Float)
    pattern_copying_score: Mapped[float | None] = mapped_column(Float)
    debugging_strength: Mapped[float | None] = mapped_column(Float)
    optimization_thinking: Mapped[float | None] = mapped_column(Float)
    consistency_score: Mapped[float | None] = mapped_column(Float)

    # Session patterns
    average_session_length_min: Mapped[int | None] = mapped_column(Integer)
    average_problems_per_session: Mapped[float | None] = mapped_column(Float)
    preferred_difficulty: Mapped[str | None] = mapped_column(String(20))
    preferred_topics: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Learning preferences
    learns_from_mistakes: Mapped[bool | None] = mapped_column(Boolean)
    revisits_problems: Mapped[bool | None] = mapped_column(Boolean)
    uses_hints: Mapped[bool | None] = mapped_column(Boolean)

    analysis_summary: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
