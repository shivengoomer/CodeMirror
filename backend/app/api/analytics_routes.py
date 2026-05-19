"""Analytics API — dashboard, heatmaps, trends, reports."""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.user_statistics import UserStatistics
from app.models.daily_report import DailyIntelligenceReport
from app.models.heatmap_data import HeatmapData
from app.models.interview_readiness import InterviewReadiness
from app.models.complexity_progression import ComplexityProgression
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_dashboard_summary(str(current_user.id))


@router.get("/heatmap/{heatmap_type}")
async def get_heatmap(
    heatmap_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HeatmapData).where(
            HeatmapData.user_id == current_user.id,
            HeatmapData.heatmap_type == heatmap_type,
        )
    )
    heatmap = result.scalar_one_or_none()
    if not heatmap:
        return {"data": {}, "status": "not_generated"}
    return {"data": heatmap.data, "generated_at": heatmap.generated_at.isoformat()}


@router.get("/trends")
async def get_trends(
    days: int = Query(30, ge=7, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    result = await db.execute(
        select(UserStatistics)
        .where(
            UserStatistics.user_id == current_user.id,
            UserStatistics.period_type == "daily",
            UserStatistics.period_date >= cutoff,
        )
        .order_by(UserStatistics.period_date.asc())
    )
    stats = result.scalars().all()
    return [
        {
            "date": s.period_date.isoformat(),
            "total": s.total_submissions,
            "accepted": s.accepted_submissions,
            "failed": s.failed_submissions,
            "acceptance_rate": s.acceptance_rate,
        }
        for s in stats
    ]


@router.get("/reports/daily")
async def get_daily_reports(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    result = await db.execute(
        select(DailyIntelligenceReport)
        .where(
            DailyIntelligenceReport.user_id == current_user.id,
            DailyIntelligenceReport.report_date >= cutoff,
        )
        .order_by(DailyIntelligenceReport.report_date.desc())
    )
    reports = result.scalars().all()
    return [
        {
            "date": r.report_date.isoformat(),
            "summary": r.summary,
            "problems_solved": r.problems_solved_today,
            "achievements": r.achievements,
            "areas_of_concern": r.areas_of_concern,
            "recommendations": r.recommendations,
        }
        for r in reports
    ]


@router.get("/reports/weekly")
async def get_weekly_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserStatistics)
        .where(UserStatistics.user_id == current_user.id, UserStatistics.period_type == "weekly")
        .order_by(UserStatistics.period_date.desc())
        .limit(12)
    )
    return [
        {
            "week": stat.period_date.isoformat(),
            "total_submissions": stat.total_submissions,
            "accepted_submissions": stat.accepted_submissions,
            "acceptance_rate": stat.acceptance_rate,
            "current_streak_days": stat.current_streak_days,
            "score_change": stat.score_change,
        }
        for stat in result.scalars().all()
    ]


@router.get("/complexity-progression")
async def get_complexity_progression(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ComplexityProgression)
        .where(ComplexityProgression.user_id == current_user.id)
        .order_by(ComplexityProgression.submitted_at.desc().nullslast(), ComplexityProgression.created_at.desc())
        .limit(100)
    )
    return [
        {
            "question_id": row.question_id,
            "attempt_number": row.attempt_number,
            "time_complexity": row.time_complexity,
            "space_complexity": row.space_complexity,
            "is_optimal": row.is_optimal,
            "code_quality_score": row.code_quality_score,
            "uses_best_approach": row.uses_best_approach,
            "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
        }
        for row in result.scalars().all()
    ]


@router.get("/interview-readiness")
async def get_interview_readiness(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewReadiness).where(InterviewReadiness.user_id == current_user.id)
    )
    readiness = result.scalar_one_or_none()
    if not readiness:
        return {"status": "not_assessed"}
    return {
        "overall_score": readiness.overall_score,
        "easy_score": readiness.easy_problems_score,
        "medium_score": readiness.medium_problems_score,
        "hard_score": readiness.hard_problems_score,
        "target_company": readiness.target_company,
        "topics_strong": readiness.topics_strong,
        "topics_weak": readiness.topics_weak,
        "estimated_days_to_ready": readiness.estimated_days_to_ready,
    }
