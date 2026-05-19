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
from app.models.code_evolution import CodeEvolution
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
from app.services.groq.cache import GroqCacheService
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, PATTERN_INTELLIGENCE_PROMPT
from app.services.leetcode.cache import LeetCodeCacheService
from app.services.leetcode.client import LeetCodeClient

logger = logging.getLogger("codemirror-api")
router = APIRouter(tags=["submissions"])

LEETCODE_STATUS_TO_VERDICT: dict[str, str] = {
    "wrong answer": "wrong_answer",
    "time limit exceeded": "tle",
    "memory limit exceeded": "mle",
    "runtime error": "runtime_error",
    "compile error": "compile_error",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_overlay(ai_analysis: dict) -> OverlayData:
    return OverlayData(
        headline=ai_analysis.get("failure_category", "Pattern check").replace("_", " ").title(),
        body=ai_analysis.get("root_cause", "Submission stored."),
        call_to_action=ai_analysis.get("fix_direction", "What failed in your assumptions?"),
        badge_label=ai_analysis.get("severity", "Saved").title(),
        error_types=[ai_analysis["failure_category"]] if ai_analysis.get("failure_category") else [],
        concepts=[],
        is_recurring=ai_analysis.get("pattern_signal") is not None,
        ai_analysis=ai_analysis,
    )


async def _get_leetcode_session_or_400(db: AsyncSession, user_id: UUID) -> LeetCodeSession:
    result = await db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row or not row.leetcode_session or not row.leetcode_csrf:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "LeetCode session is missing. Re-sync from extension login.",
        )
    return row


# ── pattern aggregation ───────────────────────────────────────────────────────

async def run_pattern_aggregation(user_id: UUID, db: AsyncSession) -> None:
    try:
        subs_result = await db.execute(
            select(Submission)
            .where(Submission.user_id == user_id, Submission.analysed.is_(False))
            .options(selectinload(Submission.submission_tags))
            .order_by(Submission.submitted_at.desc())
            .limit(10)
        )
        submissions = list(subs_result.scalars().all())
        if not submissions:
            return

        existing_result = await db.execute(select(Pattern).where(Pattern.user_id == user_id))
        existing_patterns = [
            {"id": str(p.id), "tag": p.tag, "insight": p.insight}
            for p in existing_result.scalars().all()
        ]

        submissions_list = [
            {
                "submitted_at": sub.submitted_at.isoformat(),
                "problem_title": sub.problem_title,
                "difficulty": "Unknown",
                "status": sub.verdict.value if hasattr(sub.verdict, "value") else str(sub.verdict),
                "failure_category": sub.ai_analysis.get("failure_category") if sub.ai_analysis else "not analyzed",
                "root_cause": sub.ai_analysis.get("root_cause") if sub.ai_analysis else "not analyzed",
            }
            for sub in submissions
        ]

        response = await GroqClient().complete_json(
            system_prompt=MASTER_SYSTEM_PROMPT,
            user_prompt=PATTERN_INTELLIGENCE_PROMPT.format(
                recent_submissions_history=json.dumps(submissions_list),
                patterns_json=json.dumps(existing_patterns),
            ),
        )

        for pattern_data in response.get("data", {}).get("top_patterns", []):
            if not isinstance(pattern_data, dict):
                continue

            name = pattern_data.get("name", "Recurring pattern")
            existing = await db.scalar(
                select(Pattern).where(Pattern.title == name, Pattern.user_id == user_id)
            )

            if existing is None:
                db.add(Pattern(
                    user_id=user_id,
                    tag=name.lower().replace(" ", "_")[:50],
                    title=name[:100],
                    insight=pattern_data.get("description", "Review recurring mistakes."),
                    concept_cluster=[],
                    occurrence_count=pattern_data.get("frequency", 1),
                    confidence=0.9,
                    impact="high" if pattern_data.get("trend") == "rising" else "medium",
                    suggested_revision_interval_days=7,
                    last_seen=datetime.now(UTC),
                ))
                await db.flush()
            else:
                existing.occurrence_count = max(existing.occurrence_count, int(pattern_data.get("frequency", existing.occurrence_count)))
                existing.last_seen = datetime.now(UTC)
                existing.insight = pattern_data.get("description", existing.insight)
                existing.impact = "high" if pattern_data.get("trend") == "rising" else "medium"

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


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    body: UnifiedSubmissionIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    try:
        submission = Submission(
            user_id=current_user.id,
            platform=body.platform,
            problem_slug=body.problem_slug,
            problem_title=body.problem_title,
            language=body.language,
            code_snapshot=body.code[:50000],
            verdict=body.verdict,
            failing_test_cases=[c.model_dump() for c in body.failing_test_cases],
            error_message=body.error_message,
            runtime_ms=None,
            submitted_at=datetime.fromtimestamp(body.timestamp / 1000, tz=UTC),
            analysed=False,
        )
        db.add(submission)
        await db.flush()

        # Enrich with LeetCode metadata if available
        enriched_tags: list[dict] = []
        detail: dict = {}
        if body.platform == "leetcode" and body.leetcode_session and body.leetcode_csrf:
            lc_client = LeetCodeClient(body.leetcode_session, body.leetcode_csrf)
            try:
                if body.leetcode_submission_id is not None:
                    detail = await lc_client.get_submission_detail(str(body.leetcode_submission_id))
                metadata = await LeetCodeCacheService(db).get_problem_metadata(body.problem_slug, lc_client)
                enriched_tags = metadata.get("tags", [])
            except Exception:
                pass  # non-fatal; proceed without enrichment

        # AI analysis
        analysis_context = {
            "slug": body.problem_slug,
            "difficulty": (detail.get("question") or {}).get("difficulty", "Unknown"),
            "tags": [t.get("name") for t in enriched_tags if isinstance(t, dict)],
            "error_type": body.verdict.upper(),
            "wrong_code": body.code[:50000],
        }
        ai_analysis = await GroqCacheService(db).get_submission_analysis(submission.id, analysis_context, GroqClient())
        submission.ai_analysis = ai_analysis
        submission.analysed = True

        # Link to known patterns via pattern_signal
        if ai_analysis.get("pattern_signal"):
            known_result = await db.execute(select(Pattern).where(Pattern.user_id == current_user.id))
            signal = str(ai_analysis["pattern_signal"]).lower()
            for pattern in known_result.scalars().all():
                if pattern.title.lower() in signal:
                    try:
                        db.add(SubmissionTag(
                            submission_id=submission.id,
                            pattern_id=pattern.id,
                            role=SubmissionTagRole.PRIMARY,
                        ))
                    except Exception:
                        continue
        await db.flush()

        # Upsert revision queue
        existing_rq = await db.scalar(
            select(RevisionQueueItem).where(
                RevisionQueueItem.user_id == current_user.id,
                RevisionQueueItem.problem_slug == body.problem_slug,
                RevisionQueueItem.platform == body.platform,
            )
        )
        if existing_rq is None:
            db.add(RevisionQueueItem(
                user_id=current_user.id,
                problem_slug=body.problem_slug,
                platform=body.platform,
                problem_title=body.problem_title,
                next_due=date.today() + timedelta(days=1),
            ))

        # Trigger pattern aggregation every 5 submissions
        total = await db.scalar(select(func.count()).select_from(Submission).where(Submission.user_id == current_user.id)) or 0
        if total > 0 and total % 5 == 0:
            background_tasks.add_task(run_pattern_aggregation_task, current_user.id)

        await db.commit()
        return SubmissionResponse(submission_id=submission.id, overlay_data=_build_overlay(ai_analysis))

    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception("submission_ingestion_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")


@router.post("/submissions/leetcode/latest/analyze", response_model=LatestLeetCodeAnalyzeResponse)
async def analyze_latest_leetcode_submission(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LatestLeetCodeAnalyzeResponse:
    if not current_user.leetcode_username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "LeetCode username is required on user profile.")

    session_row = await _get_leetcode_session_or_400(db, current_user.id)
    lc_client = LeetCodeClient(session_row.leetcode_session, session_row.leetcode_csrf)

    recent = await lc_client.get_recent_submissions(current_user.leetcode_username, limit=20)
    if not recent:
        return LatestLeetCodeAnalyzeResponse(status="no_recent_submissions")

    latest_failed = next(
        (s for s in recent if str(s.get("statusDisplay", "")).strip().lower() != "accepted"),
        None,
    )
    if latest_failed is None:
        return LatestLeetCodeAnalyzeResponse(status="no_failed_submission_found")

    raw_status = str(latest_failed.get("statusDisplay", "")).strip().lower()
    verdict = LEETCODE_STATUS_TO_VERDICT.get(raw_status)
    if verdict is None:
        return LatestLeetCodeAnalyzeResponse(status="unsupported_verdict", verdict=raw_status)

    try:
        lc_submission_id = int(str(latest_failed.get("id")))
    except (TypeError, ValueError):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Invalid LeetCode submission id.")

    try:
        ts = int(str(latest_failed.get("timestamp", "0")).strip())
        timestamp_ms = ts * 1000 if ts < 10_000_000_000 else ts
    except ValueError:
        timestamp_ms = int(datetime.now(UTC).timestamp() * 1000)

    detail = await lc_client.get_submission_detail(str(lc_submission_id))
    question = detail.get("question") or {} if isinstance(detail, dict) else {}

    payload = UnifiedSubmissionIn(
        platform="leetcode",
        problem_slug=str(question.get("titleSlug") or latest_failed.get("titleSlug") or ""),
        problem_title=str(question.get("title") or latest_failed.get("title") or "Unknown Problem"),
        language=str(detail.get("lang") or latest_failed.get("lang") or "unknown"),
        code=str(detail.get("code") or ""),
        verdict=verdict,
        failing_test_cases=[],
        error_message=str(detail.get("statusDisplay") or latest_failed.get("statusDisplay") or "") or None,
        timestamp=timestamp_ms,
        leetcode_submission_id=lc_submission_id,
        leetcode_session=session_row.leetcode_session,
        leetcode_csrf=session_row.leetcode_csrf,
        leetcode_headers=session_row.leetcode_headers or None,
    )

    response = await create_submission(body=payload, background_tasks=BackgroundTasks(), current_user=current_user, db=db)
    return LatestLeetCodeAnalyzeResponse(
        status="processed",
        submission_id=response.submission_id,
        problem_slug=payload.problem_slug,
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
        stmt = select(Submission).where(Submission.user_id == current_user.id)
        if platform is not None:
            stmt = stmt.where(Submission.platform == platform)
        if verdict is not None:
            stmt = stmt.where(Submission.verdict == verdict)

        total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = list((await db.execute(stmt.order_by(Submission.submitted_at.desc()).limit(limit).offset(offset))).scalars())
        return SubmissionListResponse(items=items, total=total, limit=limit, offset=offset)
    except Exception:
        logger.exception("list_submissions_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")


@router.get("/stats", response_model=SubmissionStats)
async def get_submission_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionStats:
    try:
        week_ago = datetime.now(UTC) - timedelta(days=7)
        row = (await db.execute(
            select(
                func.count(Submission.id),
                func.count(Submission.id).filter(Submission.verdict != "accepted"),
                func.count(Submission.id).filter(Submission.verdict == "accepted"),
            ).where(Submission.user_id == current_user.id, Submission.submitted_at >= week_ago)
        )).one()
        total, failed, accepted = row[0] or 0, row[1] or 0, row[2] or 0
        return SubmissionStats(
            weekly_total=total,
            weekly_failed=failed,
            weekly_accepted=accepted,
            failure_rate=round(failed / total * 100, 1) if total else 0.0,
        )
    except Exception:
        logger.exception("get_stats_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
async def get_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionOut:
    try:
        submission = await db.scalar(
            select(Submission)
            .where(Submission.id == submission_id)
            .options(selectinload(Submission.submission_tags))
        )
        if submission is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
        if submission.user_id != current_user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        return submission
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_submission_failed", extra={"user_id": str(current_user.id), "submission_id": str(submission_id)})
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")


@router.get("/submissions/{submission_id}/versions")
async def get_submission_versions(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    submission = await db.scalar(select(Submission).where(Submission.id == submission_id))
    if submission is None or submission.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    result = await db.execute(
        select(CodeEvolution)
        .where(CodeEvolution.user_id == current_user.id, CodeEvolution.submission_id == submission_id)
        .order_by(CodeEvolution.version_number.asc())
    )
    return [
        {
            "id": str(version.id),
            "question_id": version.question_id,
            "version_number": version.version_number,
            "stage": version.stage,
            "improvements_made": version.improvements_made or [],
            "created_at": version.created_at.isoformat(),
        }
        for version in result.scalars().all()
    ]
