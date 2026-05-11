import uuid
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.revision_queue import RevisionQueueItem

class RevisionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_due_items(self, user_id: uuid.UUID):
        stmt = select(RevisionQueueItem).where(
            RevisionQueueItem.user_id == user_id,
            RevisionQueueItem.next_due <= date.today()
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    def update_sm2(self, item: RevisionQueueItem, quality: int) -> RevisionQueueItem:
        if quality < 0 or quality > 5:
            raise ValueError("quality must be between 0 and 5")

        if quality < 3:
            item.repetitions = 0
            item.interval_days = 1
        else:
            if item.repetitions == 0:
                item.interval_days = 1
            elif item.repetitions == 1:
                item.interval_days = 6
            else:
                item.interval_days = round(item.interval_days * item.ease_factor)
            item.repetitions += 1

        item.ease_factor = max(1.3, item.ease_factor + 0.1 - (5 - quality) * 0.08)
        item.next_due = date.today() + timedelta(days=item.interval_days)
        return item
