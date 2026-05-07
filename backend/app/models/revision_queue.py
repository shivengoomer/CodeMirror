import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import Platform, enum_values

if TYPE_CHECKING:
    from app.models.pattern import Pattern
    from app.models.user import User


class RevisionQueueItem(Base):
    __tablename__ = "revision_queue"
    __table_args__ = (
        UniqueConstraint("user_id", "problem_slug", "platform", name="uq_revision_queue_user_problem_platform"),
        Index("idx_revision_queue_due", "user_id", "next_due"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,

    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_slug: Mapped[str] = mapped_column(String(200), nullable=False)
    platform: Mapped[Platform] = mapped_column(
        Enum(Platform, name="platform_enum", values_callable=enum_values),
        nullable=False,
    )
    problem_title: Mapped[str] = mapped_column(String(300), nullable=False)
    linked_pattern_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patterns.id"))
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, server_default="2.5")
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    next_due: Mapped[date] = mapped_column(Date, nullable=False)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verdict: Mapped[str | None] = mapped_column(String(50))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="revision_queue_items")
    linked_pattern: Mapped["Pattern | None"] = relationship(back_populates="revision_queue_items")
