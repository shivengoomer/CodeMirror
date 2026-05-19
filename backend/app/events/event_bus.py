"""Event bus — emit and consume events via database + optional Redis."""
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.event import Event

logger = get_logger("event_bus")


class EventBus:
    """Simple database-backed event bus. Can be extended with Redis Streams."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def emit(
        self,
        event_type: str,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        payload: dict[str, Any] | None = None,
    ) -> Event:
        """Emit a new event to the event log."""
        event = Event(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            payload=payload or {},
            created_at=datetime.now(UTC),
        )
        self.db.add(event)
        await self.db.flush()
        logger.info("event_emitted", event_type=event_type, entity_type=entity_type, entity_id=str(entity_id))
        return event

    async def get_unprocessed(self, event_type: str | None = None, limit: int = 100) -> list[Event]:
        """Get unprocessed events, optionally filtered by type."""
        stmt = select(Event).where(Event.processed.is_(False))
        if event_type:
            stmt = stmt.where(Event.event_type == event_type)
        stmt = stmt.order_by(Event.created_at.asc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_processed(self, event_id: uuid.UUID) -> None:
        """Mark an event as processed."""
        result = await self.db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if event:
            event.processed = True
            event.processed_at = datetime.now(UTC)
