"""Heatmap Data — pre-computed visualization data."""
import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class HeatmapData(Base):
    __tablename__ = "heatmap_data"
    __table_args__ = (UniqueConstraint("user_id", "heatmap_type", name="uq_heatmap"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    heatmap_type: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
