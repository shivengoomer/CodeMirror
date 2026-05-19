"""Daily Intelligence Reports — AI-generated daily insights."""
import uuid
from datetime import date, datetime
from typing import Any
from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class DailyIntelligenceReport(Base):
    __tablename__ = "daily_intelligence_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "report_date", name="uq_daily_report"),
        Index("idx_reports_user_date", "user_id", "report_date"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    achievements: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    areas_of_concern: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    recommendations: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    problems_solved_today: Mapped[int | None] = mapped_column(Integer)
    accuracy_today: Mapped[float | None] = mapped_column(Float)
    overall_progress_score: Mapped[float | None] = mapped_column(Float)
    topic_improvements: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    topic_declines: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
