import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from app.core.config import get_settings

logger = logging.getLogger("codemirror-scheduler")
settings = get_settings()

# Use a synchronous URL for APScheduler's SQLAlchemyJobStore
sync_db_url = settings.database_url.replace("asyncpg", "psycopg2")
if "postgresql" in sync_db_url and "psycopg2" not in sync_db_url:
    sync_db_url = sync_db_url.replace("postgresql://", "postgresql+psycopg2://")

jobstores = {
    'default': SQLAlchemyJobStore(url=sync_db_url)
}

scheduler = AsyncIOScheduler(jobstores=jobstores)

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("APScheduler started with PostgreSQL job store.")

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shut down.")
