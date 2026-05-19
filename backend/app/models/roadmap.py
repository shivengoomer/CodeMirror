"""Roadmap — AI-generated learning paths."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    goal: Mapped[str | None] = mapped_column(String(255))
    timeline_weeks: Mapped[int | None] = mapped_column(Integer)
    target_company: Mapped[str | None] = mapped_column(String(100))
    target_role: Mapped[str | None] = mapped_column(String(100))

    # Generated plan
    weekly_plan: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    milestones: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # Tracking
    current_week: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    completion_percentage: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="'active'")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
