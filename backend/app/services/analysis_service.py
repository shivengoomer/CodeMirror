"""Analysis Service — orchestrates AI analysis pipeline."""
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.events import ANALYSIS_COMPLETED, PATTERN_DETECTED
from app.events.event_bus import EventBus
from app.models.ai_analysis import AIAnalysis
from app.models.pattern_detection import PatternDetection
from app.models.submission import Submission
from app.models.topic_strength import TopicStrength
from app.models.learning_style import LearningStyle
from app.models.enums import SubmissionVerdict
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, SUBMISSION_ANALYSIS_PROMPT

logger = get_logger("analysis_service")


class AnalysisService:
    """Orchestrates the full AI analysis pipeline for submissions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.event_bus = EventBus(db)
        self.groq = GroqClient()

    async def analyze_submission(self, submission_id: str) -> AIAnalysis | None:
        """Run full AI analysis on a single submission."""
        sid = uuid.UUID(submission_id)

        # Check if already analyzed
        existing = await self.db.execute(select(AIAnalysis).where(AIAnalysis.submission_id == sid))
        if existing.scalar_one_or_none():
            return None

        sub = await self.db.execute(select(Submission).where(Submission.id == sid))
        submission = sub.scalar_one_or_none()
        if not submission:
            return None

        start = datetime.now(UTC)

        # Build context and call Groq
        context = {
            "slug": submission.problem_slug,
            "difficulty": "Unknown",
            "tags": [],
            "error_type": submission.verdict.upper() if hasattr(submission.verdict, "upper") else str(submission.verdict),
            "wrong_code": (submission.code_snapshot or "")[:8000],
        }

        response = await self.groq.complete_json(
            system_prompt=MASTER_SYSTEM_PROMPT,
            user_prompt=SUBMISSION_ANALYSIS_PROMPT.format(**context),
        )

        data = response.get("data", {})
        elapsed = int((datetime.now(UTC) - start).total_seconds() * 1000)

        analysis = AIAnalysis(
            submission_id=sid,
            user_id=submission.user_id,
            logical_mistakes=[{"description": data.get("root_cause", ""), "severity": data.get("severity", "slip")}] if data.get("root_cause") else None,
            pattern_mistakes=[{"type": data.get("failure_category", "")}] if data.get("failure_category") else None,
            edge_cases_missed=[{"description": data.get("what_is_actually_true", "")}] if data.get("what_is_actually_true") else None,
            time_complexity=None,
            space_complexity=None,
            complexity_explanation=None,
            better_approach=data.get("fix_direction"),
            refactored_code=None,
            optimization_suggestions={"repair_exercise": data.get("repair_exercise")} if data.get("repair_exercise") else None,
            confidence_score=0.85,
            analysis_version="v2.0",
            processing_time_ms=elapsed,
        )
        self.db.add(analysis)

        # Update submission
        submission.ai_analysis = data
        submission.analysed = True
        await self.db.flush()

        await self.event_bus.emit(ANALYSIS_COMPLETED, "analysis", analysis.id, submission.user_id)
        logger.info("submission_analyzed", submission_id=submission_id, elapsed_ms=elapsed)
        return analysis

    async def detect_patterns(self, user_id: str) -> list[PatternDetection]:
        """Detect recurring mistake patterns from recent submissions."""
        uid = uuid.UUID(user_id)

        # Get recent analyzed submissions
        result = await self.db.execute(
            select(Submission)
            .where(Submission.user_id == uid, Submission.analysed.is_(True))
            .order_by(Submission.submitted_at.desc())
            .limit(50)
        )
        submissions = list(result.scalars().all())
        if not submissions:
            return []

        # Count failure categories
        category_counts: dict[str, list[uuid.UUID]] = {}
        for sub in submissions:
            if sub.ai_analysis and sub.ai_analysis.get("failure_category"):
                cat = sub.ai_analysis["failure_category"]
                category_counts.setdefault(cat, []).append(sub.id)

        new_patterns = []
        for cat, sub_ids in category_counts.items():
            if len(sub_ids) < 2:
                continue

            existing = await self.db.execute(
                select(PatternDetection).where(
                    PatternDetection.user_id == uid,
                    PatternDetection.pattern_type == cat,
                )
            )
            pattern = existing.scalar_one_or_none()

            if pattern:
                pattern.occurrences = len(sub_ids)
                pattern.last_detected_at = datetime.now(UTC)
                pattern.example_submission_ids = sub_ids[:5]
            else:
                pattern = PatternDetection(
                    user_id=uid,
                    pattern_type=cat,
                    pattern_category="algorithmic",
                    occurrences=len(sub_ids),
                    example_submission_ids=sub_ids[:5],
                    severity="high" if len(sub_ids) >= 5 else "medium",
                    description=f"Recurring {cat.replace('_', ' ')} pattern detected in {len(sub_ids)} submissions",
                )
                self.db.add(pattern)
                new_patterns.append(pattern)

                await self.event_bus.emit(PATTERN_DETECTED, "pattern", pattern.id, uid, {"type": cat, "count": len(sub_ids)})

        await self.db.flush()
        logger.info("patterns_detected", user_id=user_id, new_patterns=len(new_patterns))
        return new_patterns

    async def update_topic_strengths(self, user_id: str) -> None:
        """Recalculate topic strength scores for all topics."""
        uid = uuid.UUID(user_id)

        # Get all submissions grouped by topic (from problem tags)
        result = await self.db.execute(
            select(Submission)
            .where(Submission.user_id == uid)
            .order_by(Submission.submitted_at.desc())
        )
        submissions = list(result.scalars().all())

        topic_data: dict[str, dict] = {}
        for sub in submissions:
            # Extract topics from AI analysis or problem metadata
            topics = []
            if sub.ai_analysis and isinstance(sub.ai_analysis, dict):
                topics = sub.ai_analysis.get("topics", [])
            if not topics:
                topics = [sub.problem_slug.split("-")[0]]  # Fallback to first word

            for topic in topics:
                if topic not in topic_data:
                    topic_data[topic] = {"total": 0, "accepted": 0, "failed": 0, "last_at": None}
                topic_data[topic]["total"] += 1
                if sub.verdict == SubmissionVerdict.ACCEPTED:
                    topic_data[topic]["accepted"] += 1
                else:
                    topic_data[topic]["failed"] += 1
                if not topic_data[topic]["last_at"]:
                    topic_data[topic]["last_at"] = sub.submitted_at

        for topic, stats in topic_data.items():
            rate = (stats["accepted"] / stats["total"] * 100) if stats["total"] > 0 else 0

            existing = await self.db.execute(
                select(TopicStrength).where(TopicStrength.user_id == uid, TopicStrength.topic == topic)
            )
            ts = existing.scalar_one_or_none()

            if ts:
                ts.strength_score = rate
                ts.total_attempts = stats["total"]
                ts.successful_attempts = stats["accepted"]
                ts.failed_attempts = stats["failed"]
                ts.last_practiced_at = stats["last_at"]
                ts.updated_at = datetime.now(UTC)
            else:
                self.db.add(TopicStrength(
                    user_id=uid, topic=topic, strength_score=rate,
                    total_attempts=stats["total"], successful_attempts=stats["accepted"],
                    failed_attempts=stats["failed"], last_practiced_at=stats["last_at"],
                ))

        await self.db.flush()
