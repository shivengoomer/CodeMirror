"""Interview Readiness — assessment per user."""
import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func, JSON
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class InterviewReadiness(Base):
    __tablename__ = "interview_readiness"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    overall_score: Mapped[float | None] = mapped_column(Float)
    easy_problems_score: Mapped[float | None] = mapped_column(Float)
    medium_problems_score: Mapped[float | None] = mapped_column(Float)
    hard_problems_score: Mapped[float | None] = mapped_column(Float)
    target_company: Mapped[str | None] = mapped_column(String(100))
    company_readiness_score: Mapped[float | None] = mapped_column(Float)
    topics_covered: Mapped[list[str] | None] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"))
    topics_weak: Mapped[list[str] | None] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"))
    topics_strong: Mapped[list[str] | None] = mapped_column(ARRAY(String).with_variant(JSON(), "sqlite"))
    recommended_focus: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    estimated_days_to_ready: Mapped[int | None] = mapped_column(Integer)
    last_assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
