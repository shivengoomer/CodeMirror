from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lc_problem_cache import LCProblemCache
from app.services.leetcode.client import LeetCodeClient

class LeetCodeCacheService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_problem_metadata(self, slug: str, client: LeetCodeClient) -> dict[str, Any]:
        """
        Fetch problem metadata from cache, or fallback to LC API and update cache.
        """
        stmt = select(LCProblemCache).where(LCProblemCache.slug == slug)
        result = await self.db.execute(stmt)
        cached = result.scalar_one_or_none()

        fetched_at = cached.fetched_at if cached else None
        if fetched_at and fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)

        if cached and fetched_at > datetime.now(timezone.utc) - timedelta(days=30):
            return {
                "title": cached.title,
                "difficulty": cached.difficulty,
                "tags": cached.tags,
                "description": cached.description,
            }

        # Stale or missing, fetch from LC
        metadata = await client.get_problem_metadata(slug)
        if not metadata:
            return {}

        # Upsert into cache
        if cached:
            cached.title = metadata.get("title", "")
            cached.difficulty = metadata.get("difficulty", "")
            cached.tags = metadata.get("topicTags", [])
            cached.description = metadata.get("content", "")
            cached.fetched_at = datetime.now(timezone.utc)
        else:
            new_cache = LCProblemCache(
                slug=slug,
                title=metadata.get("title", ""),
                difficulty=metadata.get("difficulty", ""),
                tags=metadata.get("topicTags", []),
                description=metadata.get("content", ""),
                fetched_at=datetime.now(timezone.utc),
            )
            self.db.add(new_cache)
        
        await self.db.commit()
        
        return {
            "title": metadata.get("title", ""),
            "difficulty": metadata.get("difficulty", ""),
            "tags": metadata.get("topicTags", []),
            "description": metadata.get("content", ""),
        }

    async def prune_stale_cache(self):
        """
        Delete cache entries older than 30 days.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        stmt = delete(LCProblemCache).where(LCProblemCache.fetched_at < cutoff)
        await self.db.execute(stmt)
        await self.db.commit()
