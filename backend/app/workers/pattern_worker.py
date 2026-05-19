"""Pattern worker — detect repeated mistake patterns."""
import asyncio
from app.workers import celery_app
from app.core.logging_config import get_logger

logger = get_logger("pattern_worker")


@celery_app.task(name="app.workers.pattern_worker.detect_patterns_task", priority=5)
def detect_patterns_task(user_id: str):
    """Detect repeated mistake patterns — medium priority."""
    logger.info("pattern_detection_started", user_id=user_id)
    asyncio.run(_detect_patterns(user_id))


async def _detect_patterns(user_id: str):
    from app.core.database import SessionLocal
    from app.services.analysis_service import AnalysisService
    async with SessionLocal() as db:
        service = AnalysisService(db)
        await service.detect_patterns(user_id)
        await db.commit()


@celery_app.task(name="app.workers.pattern_worker.update_topic_strength_task", priority=5)
def update_topic_strength_task(user_id: str, topic: str | None = None):
    """Recalculate topic strength scores — medium priority."""
    logger.info("topic_strength_update_started", user_id=user_id, topic=topic)
    asyncio.run(_update_topic_strength(user_id, topic))


async def _update_topic_strength(user_id: str, topic: str | None):
    from app.core.database import SessionLocal
    from app.services.analysis_service import AnalysisService
    async with SessionLocal() as db:
        service = AnalysisService(db)
        await service.update_topic_strengths(user_id)
        await db.commit()
