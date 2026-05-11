import json
import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import SessionLocal, get_db
from app.models.enums import Platform, SubmissionTagRole
from app.models.leetcode_session import LeetCodeSession
from app.models.pattern import Pattern
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.submission_tag import SubmissionTag
from app.models.user import User
from app.schemas.submission import (
    LatestLeetCodeAnalyzeResponse,
    OverlayData,
    SubmissionListResponse,
    SubmissionOut,
    SubmissionResponse,
    SubmissionStats,
    UnifiedSubmissionIn,
)
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.cache import LeetCodeCacheService
from app.services.groq.client import GroqClient
from app.services.groq.cache import GroqCacheService

logger = logging.getLogger("codemirror-api")
router = APIRouter(tags=["submissions"])

LEETCODE_STATUS_TO_VERDICT: dict[str, str] = {
    "wrong answer": "wrong_answer",
    "time limit exceeded": "tle",
    "memory limit exceeded": "mle",
    "runtime error": "runtime_error",
    "compile error": "compile_error",
}


async def run_pattern_aggregation(user_id: UUID, db: AsyncSession) -> None:
    try:
        submissions_result = await db.execute(
            select(Submission)
            .where(Submission.user_id == user_id, Submission.analysed.is_(False))
            .options(selectinload(Submission.submission_tags))
            .order_by(Submission.submitted_at.desc())
            .limit(10)
        )
        submissions = list(submissions_result.scalars().all())
        if not submissions:
            return

        existing_result = await db.execute(select(Pattern).where(Pattern.user_id == user_id))
        existing_patterns_rows = list(existing_result.scalars().all())
        existing_patterns = [{"id": str(p.id), "tag": p.tag, "insight": p.insight} for p in existing_patterns_rows]

        submissions_list = []
        slug_to_submission_ids: dict[str, list[UUID]] = {}
        for sub in submissions:
            submissions_list.append(
                {
                    "submitted_at": sub.submitted_at.isoformat(),
                    "problem_title": sub.problem_title,
                    "difficulty": "Unknown", # Could fetch more info
                    "status": sub.verdict.value if hasattr(sub.verdict, "value") else str(sub.verdict),
                    "failure_category": sub.ai_analysis.get("failure_category") if sub.ai_analysis else "not analyzed",
                    "root_cause": sub.ai_analysis.get("root_cause") if sub.ai_analysis else "not analyzed",
                }
            )
            slug_to_submission_ids.setdefault(sub.problem_slug, []).append(sub.id)

        from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, PATTERN_INTELLIGENCE_PROMPT
        user_prompt = PATTERN_INTELLIGENCE_PROMPT.format(
            recent_submissions_history=json.dumps(submissions_list),
            patterns_json=json.dumps(existing_patterns)
        )
        groq_client = GroqClient()
        response = await groq_client.complete_json(
            system_prompt=MASTER_SYSTEM_PROMPT,
            user_prompt=user_prompt
        )
        report = response.get("data", {})
        
        pattern_rows = report.get("top_patterns", [])
        if not isinstance(pattern_rows, list):
            pattern_rows = []

        for pattern_data in pattern_rows:
            if not isinstance(pattern_data, dict):
                continue

            # Try to find existing pattern by name
            pattern_name = pattern_data.get("name", "Recurring pattern")
            existing_pattern_result = await db.execute(
                select(Pattern).where(Pattern.title == pattern_name, Pattern.user_id == user_id)
            )
            target_pattern = existing_pattern_result.scalar_one_or_none()

            if target_pattern is None:
                target_pattern = Pattern(
                    user_id=user_id,
                    tag=pattern_name.lower().replace(" ", "_")[:50],
                    title=pattern_name[:100],
                    insight=pattern_data.get("description", "Review recurring mistakes."),
                    concept_cluster=[],
                    occurrence_count=pattern_data.get("frequency", 1),
                    confidence=0.9,
                    impact="high" if pattern_data.get("trend") == "rising" else "medium",
                    suggested_revision_interval_days=7,
                    last_seen=datetime.now(UTC),
                )
                db.add(target_pattern)
                await db.flush()
            else:
                target_pattern.occurrence_count = max(
                    target_pattern.occurrence_count,
                    int(pattern_data.get("frequency", target_pattern.occurrence_count)),
                )
                target_pattern.last_seen = datetime.now(UTC)
                target_pattern.insight = pattern_data.get("description", target_pattern.insight)
                target_pattern.impact = "high" if pattern_data.get("trend") == "rising" else "medium"

            # For evidence, the new schema doesn't directly provide slugs, but we can try to link based on category
            # For now, we'll rely on the existing links or wait for next analyze call to link them.

        for sub in submissions:
            sub.analysed = True

        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("pattern_aggregation_failed", extra={"user_id": str(user_id)})


async def run_pattern_aggregation_task(user_id: UUID) -> None:
    try:
        async with SessionLocal() as db:
            await run_pattern_aggregation(user_id, db)
    except Exception:
        logger.exception("pattern_aggregation_task_failed", extra={"user_id": str(user_id)})


@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    body: UnifiedSubmissionIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    try:
        submitted_at = datetime.fromtimestamp(body.timestamp / 1000, tz=UTC)
        code_snapshot = body.code[:50000]

        submission = Submission(
            user_id=current_user.id,
            platform=body.platform,
            problem_slug=body.problem_slug,
            problem_title=body.problem_title,
            language=body.language,
            code_snapshot=code_snapshot,
            verdict=body.verdict,
            failing_test_cases=[case.model_dump() for case in body.failing_test_cases],
            error_message=body.error_message,
            runtime_ms=None,
            submitted_at=submitted_at,
            analysed=False,
        )
        db.add(submission)
        await db.flush()

        enriched_tags: list[dict[str, str]] = []
        detail: dict[str, object] = {}
        if body.platform == "leetcode" and body.leetcode_session and body.leetcode_csrf:
            lc_client = LeetCodeClient(body.leetcode_session, body.leetcode_csrf)
            lc_cache = LeetCodeCacheService(db)
            try:
                if body.leetcode_submission_id is not None:
                    detail = await lc_client.get_submission_detail(str(body.leetcode_submission_id))
                
                metadata = await lc_cache.get_problem_metadata(body.problem_slug, lc_client)
                enriched_tags = metadata.get("tags", [])
                submission_dict = {
                    "slug": body.problem_slug,
                    "title": body.problem_title,
                    "difficulty": metadata.get("difficulty"),
                    "tags": enriched_tags,
                }
            except Exception:
                enriched_tags = []
                detail = {}

        # ... (rest of the stats logic remains similar but uses new cache)
        
        # New Intelligence Analysis with Cache
        groq_client = GroqClient()
        groq_cache = GroqCacheService(db)
        
        analysis_context = {
            "slug": body.problem_slug,
            "difficulty": (detail.get("question") or {}).get("difficulty") if isinstance(detail, dict) and detail.get("question") else "Unknown",
            "tags": [t.get("name") for t in enriched_tags if isinstance(t, dict)],
            "error_type": body.verdict.upper(),
            "wrong_code": code_snapshot,
        }

        ai_analysis = await groq_cache.get_submission_analysis(submission.id, analysis_context, groq_client)
        submission.ai_analysis = ai_analysis
        submission.analysed = True

        matched_pattern_ids = []
        if ai_analysis.get("pattern_signal"):
            # Try to match pattern_signal to an existing pattern title
            existing_patterns_result = await db.execute(select(Pattern).where(Pattern.user_id == current_user.id))
            known_patterns = [{"id": str(p.id), "title": p.title} for p in existing_patterns_result.scalars().all()]
            
            for kp in known_patterns:
                if kp["title"].lower() in str(ai_analysis["pattern_signal"]).lower():
                    matched_pattern_ids.append(kp["id"])

        if matched_pattern_ids:
            for pattern_id in matched_pattern_ids:
                try:
                    db.add(
                        SubmissionTag(
                            submission_id=submission.id,
                            pattern_id=UUID(str(pattern_id)),
                            role=SubmissionTagRole.PRIMARY,
                        )
                    )
                except Exception:
                    continue
        await db.flush()

        existing_queue_result = await db.execute(
            select(RevisionQueueItem).where(
                RevisionQueueItem.user_id == current_user.id,
                RevisionQueueItem.problem_slug == body.problem_slug,
                RevisionQueueItem.platform == body.platform,
            )
        )
        existing_queue_item = existing_queue_result.scalar_one_or_none()
        if existing_queue_item is None:
            db.add(
                RevisionQueueItem(
                    user_id=current_user.id,
                    problem_slug=body.problem_slug,
                    platform=body.platform,
                    problem_title=body.problem_title,
                    next_due=date.today() + timedelta(days=1),
                )
            )

        count_result = await db.execute(select(func.count()).select_from(Submission).where(Submission.user_id == current_user.id))
        total_submissions = int(count_result.scalar() or 0)
        if total_submissions > 0 and total_submissions % 5 == 0:
            background_tasks.add_task(run_pattern_aggregation_task, current_user.id)

        await db.commit()

        return SubmissionResponse(
            submission_id=submission.id,
            overlay_data=OverlayData(
                headline=ai_analysis.get("failure_category", "Pattern check").replace("_", " ").title(),
                body=ai_analysis.get("root_cause", "Submission stored."),
                call_to_action=ai_analysis.get("fix_direction", "What failed in your assumptions?"),
                badge_label=ai_analysis.get("severity", "Saved").title(),
                error_types=[ai_analysis.get("failure_category")] if ai_analysis.get("failure_category") else [],
                concepts=[],
                is_recurring=ai_analysis.get("pattern_signal") is not None,
                ai_analysis=ai_analysis
            ),
        )
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception("submission_ingestion_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/submissions/leetcode/latest/analyze", response_model=LatestLeetCodeAnalyzeResponse)
async def analyze_latest_leetcode_submission(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LatestLeetCodeAnalyzeResponse:
    if not current_user.leetcode_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LeetCode username is required on user profile.",
        )

    session_result = await db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id))
    session_row = session_result.scalar_one_or_none()
    if session_row is None or not session_row.leetcode_session or not session_row.leetcode_csrf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LeetCode session is missing. Re-sync from extension login.",
        )

    lc_client = LeetCodeClient(session_row.leetcode_session, session_row.leetcode_csrf)
    recent = await lc_client.get_recent_submissions(current_user.leetcode_username, limit=20)
    if not recent:
        return LatestLeetCodeAnalyzeResponse(status="no_recent_submissions")

    latest_failed = next(
        (
            item
            for item in recent
            if str(item.get("statusDisplay", "")).strip().lower() not in {"accepted"}
        ),
        None,
    )
    if latest_failed is None:
        return LatestLeetCodeAnalyzeResponse(status="no_failed_submission_found")

    raw_status = str(latest_failed.get("statusDisplay", "")).strip().lower()
    verdict = LEETCODE_STATUS_TO_VERDICT.get(raw_status)
    if verdict is None:
        return LatestLeetCodeAnalyzeResponse(status="unsupported_verdict", verdict=raw_status)

    raw_submission_id = latest_failed.get("id")
    try:
        lc_submission_id = int(str(raw_submission_id))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid LeetCode submission id.")

    submitted_ts_raw = str(latest_failed.get("timestamp", "0")).strip()
    try:
        ts_num = int(submitted_ts_raw)
        timestamp_ms = ts_num * 1000 if ts_num < 10_000_000_000 else ts_num
    except ValueError:
        timestamp_ms = int(datetime.now(UTC).timestamp() * 1000)

    detail = await lc_client.get_submission_detail(str(lc_submission_id))
    question = detail.get("question", {}) if isinstance(detail, dict) and detail.get("question") else {}
    question_title = str(question.get("title") or latest_failed.get("title") or "Unknown Problem")
    question_slug = str(question.get("titleSlug") or latest_failed.get("titleSlug") or "")
    lang = str(detail.get("lang") or latest_failed.get("lang") or "unknown")
    code = str(detail.get("code") or "")
    error_message = str(detail.get("statusDisplay") or latest_failed.get("statusDisplay") or "")

    payload = UnifiedSubmissionIn(
        platform="leetcode",
        problem_slug=question_slug,
        problem_title=question_title,
        language=lang,
        code=code,
        verdict=verdict,
        failing_test_cases=[],
        error_message=error_message or None,
        timestamp=timestamp_ms,
        leetcode_submission_id=lc_submission_id,
        leetcode_session=session_row.leetcode_session,
        leetcode_csrf=session_row.leetcode_csrf,
        leetcode_headers=session_row.leetcode_headers or None,
    )
    response = await create_submission(
        body=payload,
        background_tasks=BackgroundTasks(),
        current_user=current_user,
        db=db,
    )
    return LatestLeetCodeAnalyzeResponse(
        status="processed",
        submission_id=response.submission_id,
        problem_slug=question_slug,
        verdict=verdict,
        overlay_data=response.overlay_data,
    )


@router.get("/submissions", response_model=SubmissionListResponse)
async def list_submissions(
    platform: Platform | None = Query(None),
    verdict: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionListResponse:
    try:
        base_stmt = select(Submission).where(Submission.user_id == current_user.id)
        if platform is not None:
            base_stmt = base_stmt.where(Submission.platform == platform)
        if verdict is not None:
            base_stmt = base_stmt.where(Submission.verdict == verdict)

        total_stmt = select(func.count()).select_from(base_stmt.subquery())
        total_result = await db.execute(total_stmt)
        total = int(total_result.scalar() or 0)

        stmt = base_stmt.order_by(Submission.submitted_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        items = list(result.scalars().all())
        return SubmissionListResponse(items=items, total=total, limit=limit, offset=offset)
    except Exception:
        logger.exception("list_submissions_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/stats", response_model=SubmissionStats)
async def get_submission_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionStats:
    try:
        week_ago = datetime.now(UTC) - timedelta(days=7)
        result = await db.execute(
            select(
                func.count(Submission.id),
                func.count(Submission.id).filter(Submission.verdict != "accepted"),
                func.count(Submission.id).filter(Submission.verdict == "accepted")
            ).where(Submission.user_id == current_user.id, Submission.submitted_at >= week_ago)
        )
        stats = result.one()
        total = stats[0] or 0
        failed = stats[1] or 0
        accepted = stats[2] or 0
        rate = (failed / total * 100) if total > 0 else 0
        
        return SubmissionStats(
            weekly_total=total,
            weekly_failed=failed,
            weekly_accepted=accepted,
            failure_rate=round(rate, 1)
        )
    except Exception:
        logger.exception("get_stats_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
async def get_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionOut:
    try:
        result = await db.execute(
            select(Submission)
            .where(Submission.id == submission_id)
            .options(selectinload(Submission.submission_tags))
        )
        submission = result.scalar_one_or_none()
        if submission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
        if submission.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return submission
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_submission_failed", extra={"user_id": str(current_user.id), "submission_id": str(submission_id)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")
