import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.submission_analysis_cache import SubmissionAnalysisCache
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, SUBMISSION_ANALYSIS_PROMPT

class GroqCacheService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_submission_analysis(
        self, 
        submission_id: uuid.UUID, 
        context: dict[str, Any], 
        client: GroqClient
    ) -> dict[str, Any]:
        """
        Fetch submission analysis from cache, or call Groq and update cache.
        """
        stmt = select(SubmissionAnalysisCache).where(SubmissionAnalysisCache.submission_id == submission_id)
        result = await self.db.execute(stmt)
        cached = result.scalar_one_or_none()

        if cached:
            return cached.groq_response

        # Missing, call Groq
        user_prompt = SUBMISSION_ANALYSIS_PROMPT.format(**context)
        response = await client.complete_json(
            system_prompt=MASTER_SYSTEM_PROMPT,
            user_prompt=user_prompt
        )
        
        if not response.get("data"):
            return {}

        # Save to cache
        new_cache = SubmissionAnalysisCache(
            submission_id=submission_id,
            groq_response=response["data"],
            prompt_tokens=response["prompt_tokens"],
            completion_tokens=response["completion_tokens"],
            analyzed_at=datetime.now(timezone.utc)
        )
        self.db.add(new_cache)
        await self.db.commit()

        return response["data"]
