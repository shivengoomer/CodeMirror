import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.submission_analysis_cache import SubmissionAnalysisCache

router = APIRouter(prefix="/cache", tags=["cache"])

@router.get("/stats")
async def get_cache_stats(
    db: AsyncSession = Depends(get_db)
):
    # Total tokens spent
    stmt = select(
        func.sum(SubmissionAnalysisCache.prompt_tokens).label("total_prompt"),
        func.sum(SubmissionAnalysisCache.completion_tokens).label("total_completion"),
        func.count(SubmissionAnalysisCache.submission_id).label("total_analyses")
    )
    result = await db.execute(stmt)
    stats = result.one()

    return {
        "total_prompt_tokens": stats.total_prompt or 0,
        "total_completion_tokens": stats.total_completion or 0,
        "total_analyses_cached": stats.total_analyses or 0
    }

@router.delete("/analysis/{submission_id}")
async def delete_analysis_cache(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(SubmissionAnalysisCache).where(SubmissionAnalysisCache.submission_id == submission_id)
    await db.execute(stmt)
    await db.commit()
    return {"status": "deleted"}
