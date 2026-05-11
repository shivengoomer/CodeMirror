import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.sync import LeetCodeSyncService

class OnboardingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.sync_service = LeetCodeSyncService(db)

    async def start_onboarding(self, user_id: uuid.UUID, leetcode_session: str, csrf_token: str):
        """
        Orchestrate the cold start sync.
        """
        client = LeetCodeClient(leetcode_session, csrf_token)
        await self.sync_service.cold_start_sync(user_id, client)
