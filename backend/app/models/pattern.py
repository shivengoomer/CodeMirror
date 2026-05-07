import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PatternImpact, enum_values

if TYPE_CHECKING:
    from app.models.revision_queue import RevisionQueueItem
    from app.models.submission_tag import SubmissionTag
    from app.models.user import User


class Pattern(Base):
    __tablename__ = "patterns"
    __table_args__ = (Index("idx_patterns_user_impact", "user_id", "impact"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,

    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tag: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    insight: Mapped[str] = mapped_column(Text, nullable=False)
    concept_cluster: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    impact: Mapped[PatternImpact] = mapped_column(
        Enum(PatternImpact, name="pattern_impact_enum", values_callable=enum_values),
        nullable=False,
    )
    suggested_revision_interval_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="7")
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="patterns")
    submission_tags: Mapped[list["SubmissionTag"]] = relationship(back_populates="pattern", cascade="all, delete-orphan")
    revision_queue_items: Mapped[list["RevisionQueueItem"]] = relationship(back_populates="linked_pattern")
