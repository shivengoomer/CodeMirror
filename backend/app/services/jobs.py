import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.user import User
from app.models.leetcode_session import LeetCodeSession
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.sync import LeetCodeSyncService
from app.services.leetcode.cache import LeetCodeCacheService

logger = logging.getLogger("codemirror-jobs")

async def sync_active_users():
    """
    Delta sync for users active in the last 24 hours.
    """
    logger.info("Starting sync_active_users job")
    async with SessionLocal() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        stmt = select(User).where(User.last_active >= cutoff)
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        sync_service = LeetCodeSyncService(db)
        
        for user in users:
            # Get LC session
            session_stmt = select(LeetCodeSession).where(LeetCodeSession.user_id == user.id)
            session_result = await db.execute(session_stmt)
            lc_session = session_result.scalar_one_or_none()
            
            if lc_session:
                client = LeetCodeClient(lc_session.leetcode_session, lc_session.leetcode_csrf)
                await sync_service.delta_sync(user.id, client)
    logger.info("Finished sync_active_users job")

async def prune_problem_cache():
    """
    Prune lc_problem_cache rows older than 30 days.
    """
    logger.info("Starting prune_problem_cache job")
    async with SessionLocal() as db:
        cache_service = LeetCodeCacheService(db)
        await cache_service.prune_stale_cache()
    logger.info("Finished prune_problem_cache job")

async def send_revision_reminders():
    """
    Process revision queue notifications.
    """
    logger.info("Starting send_revision_reminders job")
    # Logic to identify users with due items and send notifications
    logger.info("Finished send_revision_reminders job")
