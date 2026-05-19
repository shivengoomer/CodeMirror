"""Roadmap Progress — weekly progress tracking."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RoadmapProgress(Base):
    __tablename__ = "roadmap_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    roadmap_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    week_number: Mapped[int | None] = mapped_column(Integer)
    planned_topics: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    completed_topics: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    planned_problems: Mapped[int | None] = mapped_column(Integer)
    completed_problems: Mapped[int | None] = mapped_column(Integer)

    week_start_date: Mapped[date | None] = mapped_column(Date)
    week_end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String(50))

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
