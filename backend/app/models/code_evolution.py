"""Version history for repeated attempts on a problem."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CodeEvolution(Base):
    __tablename__ = "code_evolution"
    __table_args__ = (UniqueConstraint("user_id", "question_id", "version_number", name="uq_code_evolution_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(Integer, nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    submission_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("submissions.id"))
    stage: Mapped[str | None] = mapped_column(String(50))
    improvements_made: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
