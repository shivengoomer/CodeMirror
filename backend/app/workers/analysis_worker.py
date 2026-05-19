"""Analysis worker — Celery tasks for AI analysis pipeline."""
import asyncio
from app.workers import celery_app
from app.core.logging_config import get_logger

logger = get_logger("analysis_worker")


@celery_app.task(name="app.workers.analysis_worker.analyze_submission_task", bind=True, priority=8, max_retries=3)
def analyze_submission_task(self, submission_id: str):
    """Run full AI analysis on a submission — high priority."""
    logger.info("analysis_task_started", submission_id=submission_id)
    try:
        asyncio.run(_analyze_submission(submission_id))
    except Exception as exc:
        logger.warning("analysis_task_retry", submission_id=submission_id, retry=self.request.retries)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


async def _analyze_submission(submission_id: str):
    from app.core.database import SessionLocal
    from app.services.analysis_service import AnalysisService
    async with SessionLocal() as db:
        service = AnalysisService(db)
        await service.analyze_submission(submission_id)
        await db.commit()
