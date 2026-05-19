"""Root-level insight endpoints required by the v1 contract."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.learning_style import LearningStyle
from app.models.pattern_detection import PatternDetection
from app.models.topic_strength import TopicStrength
from app.models.interview_readiness import InterviewReadiness
from app.models.user import User

router = APIRouter(tags=["insights"])


@router.get("/patterns")
async def detected_patterns(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PatternDetection)
        .where(PatternDetection.user_id == current_user.id)
        .order_by(PatternDetection.occurrences.desc())
    )
    return [
        {
            "id": str(pattern.id),
            "pattern_type": pattern.pattern_type,
            "pattern_category": pattern.pattern_category,
            "occurrences": pattern.occurrences,
            "severity": pattern.severity,
            "description": pattern.description,
            "suggestions": pattern.suggestions,
            "is_resolved": pattern.is_resolved,
        }
        for pattern in result.scalars().all()
    ]


@router.get("/topics/strength")
async def topic_strengths(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TopicStrength)
        .where(TopicStrength.user_id == current_user.id)
        .order_by(TopicStrength.strength_score.desc())
    )
    return [
        {
            "topic": topic.topic,
            "strength_score": topic.strength_score,
            "total_attempts": topic.total_attempts,
            "successful_attempts": topic.successful_attempts,
            "failed_attempts": topic.failed_attempts,
            "avoidance_score": topic.avoidance_score,
            "confidence_score": topic.confidence_score,
        }
        for topic in result.scalars().all()
    ]


@router.get("/learning-style")
async def learning_style(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    style = await db.scalar(select(LearningStyle).where(LearningStyle.user_id == current_user.id))
    if style is None:
        return {"status": "not_enough_data"}
    return {
        "rushing_score": style.rushing_score,
        "pattern_copying_score": style.pattern_copying_score,
        "debugging_strength": style.debugging_strength,
        "optimization_thinking": style.optimization_thinking,
        "consistency_score": style.consistency_score,
        "preferred_difficulty": style.preferred_difficulty,
        "analysis_summary": style.analysis_summary,
        "recommendations": style.recommendations,
    }


@router.get("/interview-readiness")
async def interview_readiness(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    readiness = await db.scalar(select(InterviewReadiness).where(InterviewReadiness.user_id == current_user.id))
    if readiness is None:
        return {"status": "not_assessed"}
    return {
        "overall_score": readiness.overall_score,
        "target_company": readiness.target_company,
        "company_readiness_score": readiness.company_readiness_score,
        "topics_covered": readiness.topics_covered,
        "topics_weak": readiness.topics_weak,
        "topics_strong": readiness.topics_strong,
        "recommended_focus": readiness.recommended_focus,
        "estimated_days_to_ready": readiness.estimated_days_to_ready,
    }
