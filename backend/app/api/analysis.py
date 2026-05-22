"""Analysis API — AI insights, patterns, topic strength, learning style."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.ai_analysis import AIAnalysis
from app.models.pattern_detection import PatternDetection
from app.models.topic_strength import TopicStrength
from app.models.learning_style import LearningStyle
from app.models.submission import Submission
from app.services.analysis_service import AnalysisService
from app.workers.analysis_worker import analyze_submission_task
from app.workers.pattern_worker import detect_patterns_task, update_topic_strength_task

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/{submission_id}")
async def get_analysis(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.submission_id == submission_id, AIAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        # Check if the submission exists
        sub_result = await db.execute(
            select(Submission).where(Submission.id == submission_id, Submission.user_id == current_user.id)
        )
        submission = sub_result.scalar_one_or_none()
        if not submission:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
        
        # Trigger analysis synchronously
        service = AnalysisService(db)
        try:
            analysis = await service.analyze_submission(str(submission_id))
        except Exception as e:
            import traceback
            print("=== SYNC ANALYSIS EXCEPTION ===")
            traceback.print_exc()
            raise e
        if not analysis:
            # Recheck in case of concurrent writes
            result = await db.execute(
                select(AIAnalysis).where(AIAnalysis.submission_id == submission_id, AIAnalysis.user_id == current_user.id)
            )
            analysis = result.scalar_one_or_none()
            if not analysis:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found and failed to analyze")
        else:
            await db.commit()

    return {
        "id": str(analysis.id),
        "submission_id": str(analysis.submission_id),
        "logical_mistakes": analysis.logical_mistakes,
        "pattern_mistakes": analysis.pattern_mistakes,
        "edge_cases_missed": analysis.edge_cases_missed,
        "time_complexity": analysis.time_complexity,
        "space_complexity": analysis.space_complexity,
        "better_approach": analysis.better_approach,
        "refactored_code": analysis.refactored_code,
        "optimization_suggestions": analysis.optimization_suggestions,
        "confidence_score": analysis.confidence_score,
        "processing_time_ms": analysis.processing_time_ms,
    }


@router.post("/{submission_id}/reanalyze")
async def reanalyze_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
):
    analyze_submission_task.delay(str(submission_id))
    return {"status": "reanalysis_queued", "submission_id": str(submission_id)}


@router.get("/patterns", name="list_detected_patterns")
async def get_patterns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PatternDetection)
        .where(PatternDetection.user_id == current_user.id)
        .order_by(PatternDetection.occurrences.desc())
    )
    patterns = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "pattern_type": p.pattern_type,
            "pattern_category": p.pattern_category,
            "occurrences": p.occurrences,
            "severity": p.severity,
            "description": p.description,
            "is_resolved": p.is_resolved,
            "first_detected_at": p.first_detected_at.isoformat() if p.first_detected_at else None,
            "last_detected_at": p.last_detected_at.isoformat() if p.last_detected_at else None,
        }
        for p in patterns
    ]


@router.get("/topics/strength", name="get_topic_strengths")
async def get_topic_strengths(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TopicStrength)
        .where(TopicStrength.user_id == current_user.id)
        .order_by(TopicStrength.strength_score.desc())
    )
    topics = result.scalars().all()
    return [
        {
            "topic": t.topic,
            "strength_score": t.strength_score,
            "total_attempts": t.total_attempts,
            "successful_attempts": t.successful_attempts,
            "failed_attempts": t.failed_attempts,
            "avoidance_score": t.avoidance_score,
            "last_practiced_at": t.last_practiced_at.isoformat() if t.last_practiced_at else None,
        }
        for t in topics
    ]


@router.get("/learning-style", name="get_learning_style")
async def get_learning_style(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LearningStyle).where(LearningStyle.user_id == current_user.id))
    style = result.scalar_one_or_none()
    if not style:
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
