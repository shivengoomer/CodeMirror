"""Optimization progression across attempts for the same problem."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ComplexityProgression(Base):
    __tablename__ = "complexity_progression"
    __table_args__ = (Index("idx_complexity_user_question", "user_id", "question_id", "attempt_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int | None] = mapped_column(Integer)
    attempt_number: Mapped[int | None] = mapped_column(Integer)
    time_complexity: Mapped[str | None] = mapped_column(String(50))
    space_complexity: Mapped[str | None] = mapped_column(String(50))
    is_optimal: Mapped[bool | None] = mapped_column(Boolean)
    code_quality_score: Mapped[float | None] = mapped_column(Float)
    uses_best_approach: Mapped[bool | None] = mapped_column(Boolean)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
