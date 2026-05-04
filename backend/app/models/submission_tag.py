import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import SubmissionTagRole, enum_values

if TYPE_CHECKING:
    from app.models.pattern import Pattern
    from app.models.submission import Submission


class SubmissionTag(Base):
    __tablename__ = "submission_tags"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    pattern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patterns.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[SubmissionTagRole] = mapped_column(
        Enum(SubmissionTagRole, name="submission_tag_role_enum", values_callable=enum_values),
        nullable=False,
    )

    submission: Mapped["Submission"] = relationship(back_populates="submission_tags")
    pattern: Mapped["Pattern"] = relationship(back_populates="submission_tags")
