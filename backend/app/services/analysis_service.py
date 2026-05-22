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

    async def analyze_submission(self, submission_id: str, leetcode_submission_id: str | None = None) -> AIAnalysis | None:
        """Run full AI analysis on a single submission."""
        sid = uuid.UUID(submission_id)

        # Check if already analyzed
        existing = await self.db.execute(select(AIAnalysis).where(AIAnalysis.submission_id == sid))
        cached_analysis = existing.scalar_one_or_none()
        if cached_analysis:
            return cached_analysis

        sub = await self.db.execute(select(Submission).where(Submission.id == sid))
        submission = sub.scalar_one_or_none()
        print("DEBUG: submission found in service:", submission)
        if not submission:
            print("DEBUG: returning None because submission not found in service")
            return None

        # Find the leetcode session (needed for self-healing and metadata enrichment)
        from app.models.leetcode_session import LeetCodeSession
        from app.services.leetcode.client import LeetCodeClient
        from app.services.leetcode.cache import LeetCodeCacheService

        sess_res = await self.db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == submission.user_id))
        sess = sess_res.scalar_one_or_none()
        client = None
        if sess and sess.leetcode_session:
            client = LeetCodeClient(sess.leetcode_session, sess.leetcode_csrf, sess.leetcode_headers or None)

        # Self-healing: if code_snapshot is empty, try to retrieve the leetcode submission ID and fetch detail.
        if not submission.code_snapshot or submission.code_snapshot.strip() == "":
            logger.info("Self-healing: submission code snapshot is empty. Attempting to fetch code from LeetCode. Submission ID: %s", str(submission.id))
            from app.models.lc_submission_snapshot import LCSubmissionSnapshot
            from app.models.user import User

            if client:
                lc_id = leetcode_submission_id
                
                # Match by timestamp/recent snaps if submission ID is not passed
                if not lc_id:
                    # Try to find submission ID from snapshot
                    snap_res = await self.db.execute(
                        select(LCSubmissionSnapshot)
                        .where(LCSubmissionSnapshot.user_id == submission.user_id)
                        .order_by(LCSubmissionSnapshot.last_synced.desc())
                    )
                    snaps = snap_res.scalars().all()
                    
                    # Match by problem slug and submitted_at (timestamp)
                    target_ts = int(submission.submitted_at.timestamp())
                    for snap in snaps:
                        if snap.raw_payload and "submissions" in snap.raw_payload:
                            raw_submissions = snap.raw_payload["submissions"]
                            if isinstance(raw_submissions, dict) and "submissions" in raw_submissions:
                                raw_submissions = raw_submissions["submissions"]
                            for raw in raw_submissions:
                                slug = raw.get("titleSlug") or raw.get("title_slug")
                                ts = raw.get("timestamp") or raw.get("created_at")
                                if slug == submission.problem_slug and ts:
                                    if abs(int(ts) - target_ts) <= 5:
                                        lc_id = raw.get("id")
                                        break
                            if lc_id:
                                break
                                
                    # Fallback: search in user's recent submissions dynamically
                    if not lc_id:
                        try:
                            user_res = await self.db.execute(select(User).where(User.id == submission.user_id))
                            user = user_res.scalar_one_or_none()
                            if user and user.leetcode_username:
                                recent = await client.get_recent_submissions(user.leetcode_username, limit=40)
                                for raw in recent:
                                    slug = raw.get("titleSlug") or raw.get("title_slug")
                                    ts = raw.get("timestamp") or raw.get("created_at")
                                    if slug == submission.problem_slug and ts:
                                        if abs(int(ts) - target_ts) <= 10:
                                            lc_id = raw.get("id")
                                            break
                        except Exception as ree:
                            logger.warning("Failed to fetch recent submissions for self-healing: %s", ree)
                
                # If we found a submission ID, fetch details
                if lc_id:
                    try:
                        detail = await client.get_submission_detail(str(lc_id))
                        code = detail.get("code")
                        if code:
                            submission.code_snapshot = code
                            
                            # Also update error metadata if missing
                            if not submission.error_message:
                                if detail.get("compileError"):
                                    submission.error_message = detail["compileError"]
                                elif detail.get("runtimeError"):
                                    submission.error_message = detail["runtimeError"]
                                    
                            if not submission.failing_test_cases and (detail.get("lastTestcase") or detail.get("expectedOutput") or detail.get("codeOutput")):
                                submission.failing_test_cases = [{
                                    "input": detail.get("lastTestcase") or "",
                                    "expected": detail.get("expectedOutput") or "",
                                    "got": detail.get("codeOutput") or "",
                                }]
                            
                            # Update language from detail if body.language is default/unknown
                            if detail.get("lang") and isinstance(detail["lang"], dict) and detail["lang"].get("name"):
                                submission.language = detail["lang"]["name"]
                            
                            await self.db.flush()
                            logger.info("Self-healing success: fetched and saved code snapshot for submission %s (id: %s)", str(submission.id), lc_id)
                    except Exception as fe:
                        logger.warning("Failed to fetch submission detail for self-healing (id %s): %s", lc_id, fe)

        # Enrich metadata (difficulty and tags)
        difficulty = "Unknown"
        tags = []
        if submission.platform == "leetcode" or (hasattr(submission.platform, "value") and submission.platform.value == "leetcode"):
            # Construct anonymous client if no user session is present
            meta_client = client or LeetCodeClient(session_cookie="")
            try:
                cache_service = LeetCodeCacheService(self.db)
                metadata = await cache_service.get_problem_metadata(submission.problem_slug, meta_client)
                if metadata:
                    difficulty = metadata.get("difficulty", "Unknown")
                    tags = [t.get("name") for t in metadata.get("tags", []) if isinstance(t, dict)]
            except Exception as me:
                logger.warning("Failed to fetch problem metadata for analysis: %s", me)

        start = datetime.now(UTC)
        elapsed = 0

        # Check if submission already has an ingestion-time analysis
        print("DEBUG: submission.ai_analysis:", submission.ai_analysis)
        if submission.ai_analysis and isinstance(submission.ai_analysis, dict) and submission.ai_analysis.get("failure_category"):
            data = submission.ai_analysis
        else:
            # Build context and call Groq via Cache Service
            from app.services.groq.cache import GroqCacheService
            context = {
                "slug": submission.problem_slug,
                "difficulty": difficulty,
                "tags": tags,
                "error_type": submission.verdict.upper() if hasattr(submission.verdict, "upper") else str(submission.verdict),
                "wrong_code": (submission.code_snapshot or "")[:8000],
            }
            data = await GroqCacheService(self.db).get_submission_analysis(sid, context, self.groq)
            elapsed = int((datetime.now(UTC) - start).total_seconds() * 1000)

        print("DEBUG: data retrieved:", data)
        if not data:
            print("DEBUG: returning None because data is empty/None")
            return None

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
            refactored_code=data.get("refactored_code"),
            optimization_suggestions={"repair_exercise": data.get("repair_exercise")} if data.get("repair_exercise") else None,
            confidence_score=0.85,
            analysis_version="v2.0",
            processing_time_ms=elapsed,
        )
        self.db.add(analysis)

        # Update submission
        submission.ai_analysis = data
        submission.analysed = True
        
        from sqlalchemy.exc import IntegrityError
        try:
            await self.db.flush()
        except IntegrityError as ie:
            logger.info("Concurrency conflict detected when saving AIAnalysis for submission %s: %s", str(sid), ie)
            await self.db.rollback()
            # Fetch existing analysis that was inserted by the concurrent transaction
            existing_res = await self.db.execute(select(AIAnalysis).where(AIAnalysis.submission_id == sid))
            existing_analysis = existing_res.scalar_one_or_none()
            if existing_analysis:
                return existing_analysis
            else:
                raise ie

        # Link to known patterns via pattern_signal on completion of analysis
        if data.get("pattern_signal"):
            from app.models.pattern import Pattern
            from app.models.submission_tag import SubmissionTag
            from app.models.enums import SubmissionTagRole
            known_result = await self.db.execute(select(Pattern).where(Pattern.user_id == submission.user_id))
            signal = str(data["pattern_signal"]).lower()
            for pattern in known_result.scalars().all():
                if pattern.title.lower() in signal:
                    try:
                        existing_tag = await self.db.scalar(
                            select(SubmissionTag).where(
                                SubmissionTag.submission_id == submission.id,
                                SubmissionTag.pattern_id == pattern.id
                            )
                        )
                        if not existing_tag:
                            self.db.add(SubmissionTag(
                                submission_id=submission.id,
                                pattern_id=pattern.id,
                                role=SubmissionTagRole.PRIMARY,
                            ))
                    except Exception as te:
                        logger.warning("Failed to link submission to pattern: %s", te)
            await self.db.flush()

        # Recompute all user metrics immediately on completion of analysis
        user_id_str = str(submission.user_id)
        try:
            # 1. Update topic strengths
            await self.update_topic_strengths(user_id_str)
            # 2. Detect recurring mistake patterns
            await self.detect_patterns(user_id_str)
            
            # Inline import of AnalyticsService to avoid circular dependency
            from app.services.analytics_service import AnalyticsService
            analytics_service = AnalyticsService(self.db)
            
            # 3. Update statistics for daily, weekly, and monthly periods
            await analytics_service.update_statistics(user_id_str, period="daily")
            await analytics_service.update_statistics(user_id_str, period="weekly")
            await analytics_service.update_statistics(user_id_str, period="monthly")
            
            # 4. Recalculate interview readiness
            await analytics_service.update_interview_readiness(user_id_str)
            
            # 5. Update topic accuracy heatmap data
            await analytics_service.update_heatmap(user_id_str, "topic_accuracy")
            
            await self.db.flush()
        except Exception as e:
            logger.exception("failed_to_recompute_user_metrics", user_id=user_id_str, error=str(e))

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
