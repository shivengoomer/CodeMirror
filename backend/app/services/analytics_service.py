"""Analytics Service — metrics computation, reports, heatmaps."""
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.submission import Submission
from app.models.user_statistics import UserStatistics
from app.models.daily_report import DailyIntelligenceReport
from app.models.heatmap_data import HeatmapData
from app.models.topic_strength import TopicStrength
from app.models.interview_readiness import InterviewReadiness
from app.models.enums import SubmissionVerdict
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT

logger = get_logger("analytics_service")


class AnalyticsService:
    """Computes metrics, generates reports, and updates analytics."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.groq = GroqClient()

    async def get_dashboard_summary(self, user_id: str) -> dict:
        """Get dashboard summary with key metrics."""
        uid = uuid.UUID(user_id)
        now = datetime.now(UTC)
        week_ago = now - timedelta(days=7)

        # Weekly stats
        row = (await self.db.execute(
            select(
                func.count(Submission.id),
                func.count(Submission.id).filter(Submission.verdict == SubmissionVerdict.ACCEPTED),
                func.count(Submission.id).filter(Submission.verdict != SubmissionVerdict.ACCEPTED),
            ).where(Submission.user_id == uid, Submission.submitted_at >= week_ago)
        )).one()
        total, accepted, failed = row[0] or 0, row[1] or 0, row[2] or 0

        # Topic strengths
        topics_result = await self.db.execute(
            select(TopicStrength).where(TopicStrength.user_id == uid).order_by(TopicStrength.strength_score.desc())
        )
        topics = [{"topic": t.topic, "score": t.strength_score} for t in topics_result.scalars().all()]

        return {
            "weekly_total": total,
            "weekly_accepted": accepted,
            "weekly_failed": failed,
            "acceptance_rate": round(accepted / total * 100, 1) if total else 0,
            "topic_strengths": topics[:10],
            "strongest_topics": [t for t in topics if (t["score"] or 0) >= 80][:3],
            "weakest_topics": [t for t in topics if (t["score"] or 0) < 50][:3],
        }

    async def update_statistics(self, user_id: str, period: str = "daily") -> None:
        """Update user statistics for a period."""
        uid = uuid.UUID(user_id)
        today = date.today()

        if period == "daily":
            start = datetime.combine(today, datetime.min.time()).replace(tzinfo=UTC)
            end = start + timedelta(days=1)
        elif period == "weekly":
            start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()).replace(tzinfo=UTC)
            end = start + timedelta(days=7)
        else:
            start = datetime.combine(today.replace(day=1), datetime.min.time()).replace(tzinfo=UTC)
            end = start + timedelta(days=31)

        row = (await self.db.execute(
            select(
                func.count(Submission.id),
                func.count(Submission.id).filter(Submission.verdict == SubmissionVerdict.ACCEPTED),
                func.count(Submission.id).filter(Submission.verdict != SubmissionVerdict.ACCEPTED),
            ).where(Submission.user_id == uid, Submission.submitted_at >= start, Submission.submitted_at < end)
        )).one()

        total, accepted, failed = row[0] or 0, row[1] or 0, row[2] or 0

        existing = await self.db.execute(
            select(UserStatistics).where(
                UserStatistics.user_id == uid,
                UserStatistics.period_type == period,
                UserStatistics.period_date == today,
            )
        )
        stats = existing.scalar_one_or_none()
        if stats:
            stats.total_submissions = total
            stats.accepted_submissions = accepted
            stats.failed_submissions = failed
            stats.acceptance_rate = round(accepted / total * 100, 1) if total else 0
            stats.updated_at = datetime.now(UTC)
        else:
            self.db.add(UserStatistics(
                user_id=uid, period_type=period, period_date=today,
                total_submissions=total, accepted_submissions=accepted,
                failed_submissions=failed,
                acceptance_rate=round(accepted / total * 100, 1) if total else 0,
            ))

    async def generate_daily_report(self, user_id: str, date_str: str) -> DailyIntelligenceReport | None:
        """Generate daily intelligence report."""
        uid = uuid.UUID(user_id)
        report_date = date.fromisoformat(date_str)

        # Check existing
        existing = await self.db.execute(
            select(DailyIntelligenceReport).where(
                DailyIntelligenceReport.user_id == uid,
                DailyIntelligenceReport.report_date == report_date,
            )
        )
        if existing.scalar_one_or_none():
            return None

        start = datetime.combine(report_date, datetime.min.time()).replace(tzinfo=UTC)
        end = start + timedelta(days=1)

        # Count today's submissions
        count_result = await self.db.execute(
            select(func.count(Submission.id)).where(
                Submission.user_id == uid,
                Submission.submitted_at >= start,
                Submission.submitted_at < end,
            )
        )
        problems_today = count_result.scalar() or 0

        report = DailyIntelligenceReport(
            user_id=uid,
            report_date=report_date,
            summary=f"You solved {problems_today} problems today.",
            problems_solved_today=problems_today,
            achievements=[],
            areas_of_concern=[],
            recommendations=[],
        )
        self.db.add(report)
        await self.db.flush()
        return report

    async def update_heatmap(self, user_id: str, heatmap_type: str) -> None:
        """Update heatmap data for visualization."""
        uid = uuid.UUID(user_id)

        if heatmap_type == "topic_accuracy":
            topics_result = await self.db.execute(
                select(TopicStrength).where(TopicStrength.user_id == uid)
            )
            data = {
                "topics": [
                    {"name": t.topic, "score": t.strength_score, "attempts": t.total_attempts}
                    for t in topics_result.scalars().all()
                ]
            }
        else:
            data = {}

        existing = await self.db.execute(
            select(HeatmapData).where(HeatmapData.user_id == uid, HeatmapData.heatmap_type == heatmap_type)
        )
        heatmap = existing.scalar_one_or_none()
        if heatmap:
            heatmap.data = data
            heatmap.generated_at = datetime.now(UTC)
        else:
            self.db.add(HeatmapData(user_id=uid, heatmap_type=heatmap_type, data=data))

    async def update_interview_readiness(self, user_id: str) -> None:
        """Recalculate interview readiness score."""
        uid = uuid.UUID(user_id)

        topics_result = await self.db.execute(select(TopicStrength).where(TopicStrength.user_id == uid))
        topics = list(topics_result.scalars().all())

        if not topics:
            return

        scores = [t.strength_score or 0 for t in topics]
        overall = sum(scores) / len(scores) if scores else 0

        strong = [t.topic for t in topics if (t.strength_score or 0) >= 80]
        weak = [t.topic for t in topics if (t.strength_score or 0) < 50]

        existing = await self.db.execute(select(InterviewReadiness).where(InterviewReadiness.user_id == uid))
        readiness = existing.scalar_one_or_none()

        if readiness:
            readiness.overall_score = overall
            readiness.topics_strong = strong
            readiness.topics_weak = weak
            readiness.topics_covered = [t.topic for t in topics]
            readiness.updated_at = datetime.now(UTC)
        else:
            self.db.add(InterviewReadiness(
                user_id=uid, overall_score=overall,
                topics_strong=strong, topics_weak=weak,
                topics_covered=[t.topic for t in topics],
            ))
