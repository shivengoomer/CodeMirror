"""Analytics worker — daily reports, heatmaps, statistics."""
import asyncio
from app.workers import celery_app
from app.core.logging_config import get_logger

logger = get_logger("analytics_worker")


@celery_app.task(name="app.workers.analytics_worker.generate_daily_report_task", priority=3)
def generate_daily_report_task(user_id: str, date_str: str):
    """Generate daily intelligence report — low priority."""
    logger.info("daily_report_started", user_id=user_id, date=date_str)
    asyncio.run(_generate_daily_report(user_id, date_str))


async def _generate_daily_report(user_id: str, date_str: str):
    from app.core.database import SessionLocal
    from app.services.analytics_service import AnalyticsService
    async with SessionLocal() as db:
        service = AnalyticsService(db)
        await service.generate_daily_report(user_id, date_str)
        await db.commit()


@celery_app.task(name="app.workers.analytics_worker.update_heatmap_task", priority=3)
def update_heatmap_task(user_id: str, heatmap_type: str):
    """Update heatmap data — low priority."""
    logger.info("heatmap_update_started", user_id=user_id, type=heatmap_type)
    asyncio.run(_update_heatmap(user_id, heatmap_type))


async def _update_heatmap(user_id: str, heatmap_type: str):
    from app.core.database import SessionLocal
    from app.services.analytics_service import AnalyticsService
    async with SessionLocal() as db:
        service = AnalyticsService(db)
        await service.update_heatmap(user_id, heatmap_type)
        await db.commit()


@celery_app.task(name="app.workers.analytics_worker.update_statistics_task", priority=2)
def update_statistics_task(user_id: str, period: str = "daily"):
    """Update user statistics — low priority."""
    logger.info("statistics_update_started", user_id=user_id, period=period)
    asyncio.run(_update_statistics(user_id, period))


async def _update_statistics(user_id: str, period: str):
    from app.core.database import SessionLocal
    from app.services.analytics_service import AnalyticsService
    async with SessionLocal() as db:
        service = AnalyticsService(db)
        await service.update_statistics(user_id, period)
        await db.commit()


@celery_app.task(name="app.workers.analytics_worker.generate_all_daily_reports")
def generate_all_daily_reports():
    """Generate daily reports for all active users — periodic."""
    from datetime import date
    logger.info("all_daily_reports_started")
    asyncio.run(_generate_all_reports(date.today().isoformat()))


async def _generate_all_reports(date_str: str):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from app.core.database import SessionLocal
    from app.models.user import User
    async with SessionLocal() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        result = await db.execute(select(User.id).where(User.last_active >= cutoff))
        for (uid,) in result.all():
            generate_daily_report_task.delay(str(uid), date_str)


@celery_app.task(name="app.workers.analytics_worker.update_all_interview_readiness")
def update_all_interview_readiness():
    """Recalculate interview readiness for all users — periodic weekly."""
    logger.info("interview_readiness_update_started")
    asyncio.run(_update_all_readiness())


async def _update_all_readiness():
    from sqlalchemy import select
    from app.core.database import SessionLocal
    from app.models.user import User
    async with SessionLocal() as db:
        result = await db.execute(select(User.id))
        for (uid,) in result.all():
            # Import inline to avoid circular
            from app.services.analytics_service import AnalyticsService
            service = AnalyticsService(db)
            await service.update_interview_readiness(str(uid))
        await db.commit()
