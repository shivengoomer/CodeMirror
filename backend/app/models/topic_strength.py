"""Topic Strength — per-user per-topic performance scores."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TopicStrength(Base):
    __tablename__ = "topic_strength"
    __table_args__ = (
        UniqueConstraint("user_id", "topic", name="uq_topic_strength_user_topic"),
        Index("idx_topic_strength_user", "user_id"),
        Index("idx_topic_strength_score", "strength_score"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic: Mapped[str] = mapped_column(String(100), nullable=False)

    # Metrics
    strength_score: Mapped[float | None] = mapped_column(Float)
    total_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    successful_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    average_retries: Mapped[float | None] = mapped_column(Float)
    average_time_seconds: Mapped[float | None] = mapped_column(Float)

    # Tracking
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    days_since_practice: Mapped[int | None] = mapped_column(Integer)
    avoidance_score: Mapped[float | None] = mapped_column(Float)
    confidence_score: Mapped[float | None] = mapped_column(Float)

    # Trends
    score_trend: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
