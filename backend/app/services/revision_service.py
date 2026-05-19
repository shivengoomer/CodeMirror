"""Revision Service v2 — priority queue generation with weighted scoring."""
import uuid
from datetime import UTC, date, datetime, timedelta
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.pattern_detection import PatternDetection
from app.models.topic_strength import TopicStrength
from app.models.enums import Platform, SubmissionVerdict

logger = get_logger("revision_service_v2")


class RevisionServiceV2:
    """Generates prioritized revision queues based on weakness, avoidance, and patterns."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_queue(self, user_id: str) -> list[dict]:
        """Generate a full prioritized revision queue."""
        uid = uuid.UUID(user_id)
        items = []

        # 1. Weak topic problems
        items.extend(await self._weak_topic_queue(uid))
        # 2. Forgotten problems (30+ days)
        items.extend(await self._forgotten_queue(uid))
        # 3. Pattern-based problems
        items.extend(await self._pattern_queue(uid))

        # Sort by priority
        items.sort(key=lambda x: x["priority"], reverse=True)
        logger.info("revision_queue_generated", user_id=user_id, total_items=len(items))
        return items[:20]  # Cap at 20

    async def _weak_topic_queue(self, user_id: uuid.UUID) -> list[dict]:
        """Problems from weakest topics."""
        result = await self.db.execute(
            select(TopicStrength)
            .where(TopicStrength.user_id == user_id, TopicStrength.strength_score < 60)
            .order_by(TopicStrength.strength_score.asc())
            .limit(5)
        )
        weak_topics = list(result.scalars().all())
        items = []
        for topic in weak_topics:
            sub_result = await self.db.execute(
                select(Submission)
                .where(Submission.user_id == user_id, Submission.verdict != SubmissionVerdict.ACCEPTED)
                .order_by(Submission.submitted_at.desc())
                .limit(3)
            )
            for sub in sub_result.scalars().all():
                priority = self._calculate_priority(
                    weakness=100 - (topic.strength_score or 0),
                    avoidance=topic.avoidance_score or 0,
                    days_since=topic.days_since_practice or 0,
                    failures=topic.failed_attempts or 0,
                )
                items.append({
                    "problem_slug": sub.problem_slug,
                    "problem_title": sub.problem_title,
                    "queue_type": "weak_topic",
                    "priority": priority,
                    "reason": f"Weak in {topic.topic} (score: {topic.strength_score:.0f}%)",
                    "topic": topic.topic,
                })
        return items

    async def _forgotten_queue(self, user_id: uuid.UUID) -> list[dict]:
        """Problems not touched in 30+ days."""
        cutoff = datetime.now(UTC) - timedelta(days=30)
        result = await self.db.execute(
            select(Submission)
            .where(Submission.user_id == user_id, Submission.submitted_at < cutoff)
            .order_by(Submission.submitted_at.asc())
            .limit(5)
        )
        items = []
        for sub in result.scalars().all():
            days = (datetime.now(UTC) - sub.submitted_at.replace(tzinfo=UTC if sub.submitted_at.tzinfo is None else sub.submitted_at.tzinfo)).days
            priority = self._calculate_priority(days_since=days, failures=1 if sub.verdict != SubmissionVerdict.ACCEPTED else 0)
            items.append({
                "problem_slug": sub.problem_slug,
                "problem_title": sub.problem_title,
                "queue_type": "forgotten",
                "priority": priority,
                "reason": f"Not practiced in {days} days",
            })
        return items

    async def _pattern_queue(self, user_id: uuid.UUID) -> list[dict]:
        """Problems targeting detected patterns."""
        result = await self.db.execute(
            select(PatternDetection)
            .where(PatternDetection.user_id == user_id, PatternDetection.is_resolved.is_(False))
            .order_by(PatternDetection.occurrences.desc())
            .limit(5)
        )
        items = []
        for pattern in result.scalars().all():
            if pattern.example_submission_ids:
                sub_result = await self.db.execute(
                    select(Submission).where(Submission.id == pattern.example_submission_ids[0])
                )
                sub = sub_result.scalar_one_or_none()
                if sub:
                    priority = self._calculate_priority(failures=pattern.occurrences, weakness=80)
                    items.append({
                        "problem_slug": sub.problem_slug,
                        "problem_title": sub.problem_title,
                        "queue_type": "mistake_pattern",
                        "priority": priority,
                        "reason": f"Pattern: {pattern.pattern_type} ({pattern.occurrences} occurrences)",
                        "pattern_id": str(pattern.id),
                    })
        return items

    @staticmethod
    def _calculate_priority(
        weakness: float = 0, avoidance: float = 0,
        days_since: int = 0, failures: int = 0, confidence_gap: float = 0,
    ) -> float:
        """Weighted priority formula."""
        return (
            weakness * 0.30 +
            avoidance * 0.25 +
            min(days_since, 90) * 0.20 +
            min(failures, 10) * 1.5 +
            confidence_gap * 0.10
        )
