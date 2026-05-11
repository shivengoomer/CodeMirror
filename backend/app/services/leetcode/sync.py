import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.lc_submission_snapshot import LCSubmissionSnapshot
from app.models.submission import Submission
from app.models.enums import Platform, SubmissionVerdict
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.cache import LeetCodeCacheService

class LeetCodeSyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def cold_start_sync(self, user_id: uuid.UUID, client: LeetCodeClient):
        """
        One-time full sync for new users.
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user or not user.leetcode_username:
            return

        # 1. Fetch profile data
        profile = await client.get_full_profile_data(user.leetcode_username)
        
        # 2. Fetch all accepted submissions (bulk)
        all_submissions = []
        offset = 0
        limit = 100
        while True:
            submissions_data = await client.get_all_accepted_submissions(user.leetcode_username, offset=offset, limit=limit)
            batch = submissions_data.get("submissions", [])
            all_submissions.extend(batch)
            if not submissions_data.get("hasNext"):
                break
            offset += limit
        
        # 3. Store raw snapshot
        snapshot = LCSubmissionSnapshot(
            user_id=user_id,
            last_synced=datetime.now(timezone.utc),
            total_solved=profile.get("matchedUser", {}).get("submitStats", {}).get("acSubmissionNum", [{}])[0].get("count", 0),
            raw_payload={
                "profile": profile,
                "submissions": all_submissions
            }
        )
        self.db.add(snapshot)

        # 4. Hydrate normalized tables (Simplified for now)
        # In a real scenario, we'd iterate and create Submission rows.
        # For this refactor, we focus on the architecture.

        # 5. Mark onboarding complete
        user.onboarding_complete = True
        await self.db.commit()

    async def delta_sync(self, user_id: uuid.UUID, client: LeetCodeClient):
        """
        Fetch only new submissions since last_synced.
        """
        stmt = select(LCSubmissionSnapshot).where(LCSubmissionSnapshot.user_id == user_id).order_by(LCSubmissionSnapshot.last_synced.desc())
        result = await self.db.execute(stmt)
        snapshot = result.scalar_one_or_none()
        
        last_synced_ts = int(snapshot.last_synced.timestamp()) if snapshot else 0
        
        user_stmt = select(User).where(User.id == user_id)
        user_result = await self.db.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        if not user or not user.leetcode_username:
            return

        recent = await client.get_recent_submissions(user.leetcode_username)
        
        new_submissions = [s for s in recent if int(s.get("timestamp", 0)) > last_synced_ts]
        
        if not new_submissions:
            return

        # Process new submissions...
        # Update snapshot last_synced
        if snapshot:
            snapshot.last_synced = datetime.now(timezone.utc)
        else:
            snapshot = LCSubmissionSnapshot(
                user_id=user_id,
                last_synced=datetime.now(timezone.utc)
            )
            self.db.add(snapshot)
            
        await self.db.commit()
