"""User Statistics — daily/weekly/monthly aggregates."""
import uuid
from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class UserStatistics(Base):
    __tablename__ = "user_statistics"
    __table_args__ = (
        UniqueConstraint("user_id", "period_type", "period_date", name="uq_user_stats"),
        Index("idx_stats_user_period", "user_id", "period_type", "period_date"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    period_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_submissions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    accepted_submissions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failed_submissions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    acceptance_rate: Mapped[float | None] = mapped_column(Float)
    easy_solved: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    medium_solved: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    hard_solved: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    current_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    longest_streak_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    total_coding_time_minutes: Mapped[int | None] = mapped_column(Integer)
    average_problem_time_minutes: Mapped[float | None] = mapped_column(Float)
    score_change: Mapped[float | None] = mapped_column(Float)
    rank_change: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
