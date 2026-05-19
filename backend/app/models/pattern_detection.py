"""Pattern Detection — tracks recurring mistakes across sessions."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PatternDetection(Base):
    __tablename__ = "pattern_detection"
    __table_args__ = (
        Index("idx_pattern_detection_user", "user_id"),
        Index("idx_pattern_detection_type", "pattern_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    pattern_type: Mapped[str] = mapped_column(String(100), nullable=False)
    pattern_category: Mapped[str | None] = mapped_column(String(50))
    occurrences: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    example_submission_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)))
    severity: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    suggestions: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
