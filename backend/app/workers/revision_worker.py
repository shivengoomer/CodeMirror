"""Revision worker — generate revision queues."""
import asyncio
from app.workers import celery_app
from app.core.logging_config import get_logger

logger = get_logger("revision_worker")


@celery_app.task(name="app.workers.revision_worker.generate_revision_queue_task", priority=5)
def generate_revision_queue_task(user_id: str):
    """Generate personalized revision queue — medium priority."""
    logger.info("revision_queue_generation_started", user_id=user_id)
    asyncio.run(_generate_queue(user_id))


async def _generate_queue(user_id: str):
    from app.core.database import SessionLocal
    from app.services.revision_service import RevisionServiceV2
    async with SessionLocal() as db:
        service = RevisionServiceV2(db)
        await service.generate_queue(user_id)
        await db.commit()
