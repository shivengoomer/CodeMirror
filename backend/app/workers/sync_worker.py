"""Sync worker — Celery tasks for LeetCode submission syncing."""
import asyncio
from app.workers import celery_app
from app.core.logging_config import get_logger

logger = get_logger("sync_worker")


@celery_app.task(name="app.workers.sync_worker.sync_submissions_task", bind=True, priority=9, max_retries=6)
def sync_submissions_task(self, user_id: str, sync_type: str = "incremental"):
    """Fetch submissions from LeetCode — high priority."""
    logger.info("sync_task_started", user_id=user_id, sync_type=sync_type)
    try:
        asyncio.run(_sync_submissions(user_id, sync_type))
    except Exception as exc:
        backoff = 2 ** self.request.retries
        logger.warning("sync_task_retry", user_id=user_id, retry=self.request.retries, backoff=backoff)
        raise self.retry(exc=exc, countdown=backoff)


async def _sync_submissions(user_id: str, sync_type: str):
    from app.core.database import SessionLocal
    from app.services.sync_service import SyncService
    async with SessionLocal() as db:
        service = SyncService(db)
        if sync_type == "initial":
            await service.initial_sync(user_id)
        else:
            await service.incremental_sync(user_id)
        await db.commit()


@celery_app.task(name="app.workers.sync_worker.periodic_incremental_sync")
def periodic_incremental_sync():
    """Sync new submissions for all active users — periodic."""
    logger.info("periodic_sync_started")
    asyncio.run(_periodic_sync())


async def _periodic_sync():
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from app.core.database import SessionLocal
    from app.models.user import User
    async with SessionLocal() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        result = await db.execute(select(User.id).where(User.last_active >= cutoff))
        for (uid,) in result.all():
            sync_submissions_task.delay(str(uid), "incremental")
