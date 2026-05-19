import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.leetcode_session import LeetCodeSession
    from app.models.pattern import Pattern
    from app.models.revision_queue import RevisionQueueItem
    from app.models.submission import Submission
    from app.models.weekly_digest import WeeklyDigest


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,

    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    leetcode_username: Mapped[str | None] = mapped_column(String(100))
    gfg_username: Mapped[str | None] = mapped_column(String(100))
    hackerrank_username: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, server_default="UTC")
    available_minutes_per_day: Mapped[int | None] = mapped_column(Integer)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False, deferred=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), deferred=True)

    submissions: Mapped[list["Submission"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    patterns: Mapped[list["Pattern"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    revision_queue_items: Mapped[list["RevisionQueueItem"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    weekly_digests: Mapped[list["WeeklyDigest"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    leetcode_session_data: Mapped["LeetCodeSession | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
