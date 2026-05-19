"""Static analysis metadata generated before LLM review."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ASTMetadata(Base):
    __tablename__ = "ast_metadata"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    ast_tree: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    function_count: Mapped[int | None] = mapped_column(Integer)
    class_count: Mapped[int | None] = mapped_column(Integer)
    loop_count: Mapped[int | None] = mapped_column(Integer)
    conditional_count: Mapped[int | None] = mapped_column(Integer)
    recursion_depth: Mapped[int | None] = mapped_column(Integer)
    linter_errors: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    linter_warnings: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    code_quality_score: Mapped[float | None] = mapped_column(Float)
    lines_of_code: Mapped[int | None] = mapped_column(Integer)
    cyclomatic_complexity: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
