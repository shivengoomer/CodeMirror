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
from app.models.pattern import Pattern
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.submission_tag import SubmissionTag
from app.models.user import User
from app.schemas.submission import (
    OverlayData,
    SubmissionOut,
    SubmissionResponse,
    UnifiedSubmissionIn,
)
from app.services.groq_service import groq_service
from app.services.leetcode_service import get_problem_metadata, get_submission_detail

logger = logging.getLogger("codemirror-api")
router = APIRouter(tags=["submissions"])


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
                    "id": str(sub.id),
                    "problem_slug": sub.problem_slug,
                    "verdict": sub.verdict.value if hasattr(sub.verdict, "value") else str(sub.verdict),
                    "error_message": sub.error_message,
                    "tags": [str(tag.pattern_id) for tag in sub.submission_tags],
                }
            )
            slug_to_submission_ids.setdefault(sub.problem_slug, []).append(sub.id)

        be1_result = await groq_service.run_be1(submissions_list, existing_patterns)
        pattern_rows = be1_result.get("patterns", [])
        if not isinstance(pattern_rows, list):
            pattern_rows = []

        for pattern_data in pattern_rows:
            if not isinstance(pattern_data, dict):
                continue

            pattern_id_value = pattern_data.get("id")
            target_pattern: Pattern | None = None

            if pattern_id_value:
                try:
                    existing_pattern_result = await db.execute(
                        select(Pattern).where(Pattern.id == UUID(str(pattern_id_value)), Pattern.user_id == user_id)
                    )
                    target_pattern = existing_pattern_result.scalar_one_or_none()
                except Exception:
                    target_pattern = None

            if target_pattern is None:
                target_pattern = Pattern(
                    user_id=user_id,
                    tag=str(pattern_data.get("tag", "logic_error")),
                    title=str(pattern_data.get("title", "Recurring pattern")),
                    insight=str(pattern_data.get("insight", "Review recurring mistakes in this concept cluster.")),
                    concept_cluster=[str(item) for item in pattern_data.get("concept_cluster", []) if isinstance(item, str)],
                    occurrence_count=max(1, int(pattern_data.get("occurrence_count", 1))),
                    confidence=float(pattern_data.get("confidence", 0.0)),
                    impact=str(pattern_data.get("impact", "low")),
                    suggested_revision_interval_days=int(pattern_data.get("suggested_revision_interval_days", 7)),
                    last_seen=datetime.now(UTC),
                )
                db.add(target_pattern)
                await db.flush()
            else:
                target_pattern.occurrence_count = max(
                    target_pattern.occurrence_count,
                    int(pattern_data.get("occurrence_count", target_pattern.occurrence_count)),
                )
                target_pattern.last_seen = datetime.now(UTC)
                target_pattern.insight = str(pattern_data.get("insight", target_pattern.insight))

            evidence = pattern_data.get("evidence", [])
            if not isinstance(evidence, list):
                evidence = []
            linked_submission_ids: set[UUID] = set()
            for slug in evidence:
                if isinstance(slug, str):
                    linked_submission_ids.update(slug_to_submission_ids.get(slug, []))

            for submission_id in linked_submission_ids:
                tag_exists_result = await db.execute(
                    select(SubmissionTag).where(
                        SubmissionTag.submission_id == submission_id,
                        SubmissionTag.pattern_id == target_pattern.id,
                    )
                )
                if tag_exists_result.scalar_one_or_none() is None:
                    db.add(
                        SubmissionTag(
                            submission_id=submission_id,
                            pattern_id=target_pattern.id,
                            role=SubmissionTagRole.CONTRIBUTING,
                        )
                    )

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


@router.post("/submissions", response_model=SubmissionResponse)
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
            try:
                if body.leetcode_submission_id is not None:
                    detail = await get_submission_detail(body.leetcode_submission_id, body.leetcode_session, body.leetcode_csrf)
                metadata = await get_problem_metadata(body.problem_slug, body.leetcode_session, body.leetcode_csrf)
                metadata_tags = metadata.get("topicTags", []) if isinstance(metadata, dict) else []
                if isinstance(metadata_tags, list):
                    enriched_tags = [tag for tag in metadata_tags if isinstance(tag, dict)]
            except Exception:
                enriched_tags = []
                detail = {}

        patterns_result = await db.execute(
            select(Pattern)
            .where(Pattern.user_id == current_user.id)
            .order_by(Pattern.occurrence_count.desc())
            .limit(10)
        )
        known_patterns = [
            {
                "id": str(pattern.id),
                "tag": pattern.tag,
                "title": pattern.title,
                "insight": pattern.insight,
            }
            for pattern in patterns_result.scalars().all()
        ]

        submission_dict = {
            "slug": body.problem_slug,
            "title": body.problem_title,
            "language": body.language,
            "verdict": body.verdict,
            "code": code_snapshot,
            "error_message": body.error_message,
            "failing_test_cases": [case.model_dump() for case in body.failing_test_cases],
            "enriched_tags": enriched_tags,
            "runtime_percentile": detail.get("runtimePercentile"),
            "memory_percentile": detail.get("memoryPercentile"),
            "runtime": detail.get("runtime"),
            "memory": detail.get("memory"),
            "difficulty": (detail.get("question") or {}).get("difficulty") if isinstance(detail.get("question"), dict) else None,
            "topic_tags": enriched_tags,
        }
        ext1_result = await groq_service.run_ext1(submission_dict, known_patterns)

        matched_pattern_ids = ext1_result.get("matched_pattern_ids", [])
        if isinstance(matched_pattern_ids, list):
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

        overlay = ext1_result.get("overlay", {}) if isinstance(ext1_result, dict) else {}
        return SubmissionResponse(
            submission_id=submission.id,
            overlay_data=OverlayData(
                headline=str(overlay.get("headline", "Pattern check")),
                body=str(overlay.get("body", "Submission stored.")),
                call_to_action=str(overlay.get("call_to_action", "What failed in your assumptions?")),
                badge_label=str(overlay.get("badge_label", "Saved")),
                error_types=[str(item) for item in ext1_result.get("error_types", [])] if isinstance(ext1_result, dict) else [],
                concepts=[str(item) for item in ext1_result.get("concepts", [])] if isinstance(ext1_result, dict) else [],
                is_recurring=bool(ext1_result.get("is_recurring", False)) if isinstance(ext1_result, dict) else False,
            ),
        )
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception("submission_ingestion_failed", extra={"user_id": str(current_user.id)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.get("/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    platform: Platform | None = Query(None),
    verdict: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SubmissionOut]:
    try:
        stmt = select(Submission).where(Submission.user_id == current_user.id)
        if platform is not None:
            stmt = stmt.where(Submission.platform == platform)
        if verdict is not None:
            stmt = stmt.where(Submission.verdict == verdict)
        stmt = stmt.order_by(Submission.submitted_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())
    except Exception:
        logger.exception("list_submissions_failed", extra={"user_id": str(current_user.id)})
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
