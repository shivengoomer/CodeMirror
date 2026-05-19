"""Per-topic analytics snapshots."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TopicAnalytics(Base):
    __tablename__ = "topic_analytics"
    __table_args__ = (
        UniqueConstraint("user_id", "topic", "analysis_date", name="uq_topic_analytics_user_topic_date"),
        Index("idx_topic_analytics_user", "user_id", "topic", "analysis_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    analysis_date: Mapped[date] = mapped_column(Date, nullable=False)
    problems_attempted: Mapped[int] = mapped_column(Integer, default=0)
    problems_solved: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_rate: Mapped[float | None] = mapped_column(Float)
    average_attempts: Mapped[float | None] = mapped_column(Float)
    total_time_spent_minutes: Mapped[int | None] = mapped_column(Integer)
    average_time_per_problem: Mapped[float | None] = mapped_column(Float)
    easy_accuracy: Mapped[float | None] = mapped_column(Float)
    medium_accuracy: Mapped[float | None] = mapped_column(Float)
    hard_accuracy: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
