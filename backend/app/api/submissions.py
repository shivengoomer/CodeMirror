from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import SessionLocal, get_db
from app.models.enums import Platform, SubmissionTagRole, SubmissionVerdict
from app.models.pattern import Pattern
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.submission_tag import SubmissionTag
from app.models.user import User
from app.schemas.submission import SubmissionIngestResponse, SubmissionListResponse, SubmissionResponse, UnifiedSubmissionIn
from app.services.groq_service import groq_service

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _submission_payload(submission: Submission) -> dict[str, object]:
    return {
        "id": str(submission.id),
        "platform": submission.platform.value,
        "problem_slug": submission.problem_slug,
        "problem_title": submission.problem_title,
        "language": submission.language,
        "verdict": submission.verdict.value,
        "failing_test_cases": submission.failing_test_cases,
        "error_message": submission.error_message,
        "runtime_ms": submission.runtime_ms,
        "submitted_at": submission.submitted_at.isoformat(),
    }


async def run_pattern_aggregation(user_id: UUID) -> None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Submission)
            .where(Submission.user_id == user_id)
            .order_by(Submission.submitted_at.desc())
            .limit(10)
        )
        recent_submissions = [_submission_payload(submission) for submission in result.scalars().all()]
        await groq_service.run_pattern_aggregation({"user_id": str(user_id), "recent_submissions": recent_submissions})


@router.post("", response_model=SubmissionIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_submission(
    payload: UnifiedSubmissionIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionIngestResponse:
    submitted_at = datetime.fromtimestamp(payload.timestamp / 1000, tz=UTC)
    submission = Submission(
        user_id=current_user.id,
        platform=payload.platform,
        problem_slug=payload.problem_slug,
        problem_title=payload.problem_title,
        language=payload.language,
        code_snapshot=payload.code,
        verdict=payload.verdict,
        failing_test_cases=[case.model_dump() for case in payload.failing_test_cases],
        error_message=payload.error_message,
        runtime_ms=payload.runtime_ms,
        submitted_at=submitted_at,
    )
    db.add(submission)
    await db.flush()

    pattern_result = await db.execute(
        select(Pattern)
        .where(Pattern.user_id == current_user.id)
        .order_by(Pattern.occurrence_count.desc(), Pattern.confidence.desc())
        .limit(10)
    )
    known_patterns = [
        {
            "id": str(pattern.id),
            "tag": pattern.tag,
            "title": pattern.title,
            "insight": pattern.insight,
            "concept_cluster": pattern.concept_cluster,
            "confidence": pattern.confidence,
            "impact": pattern.impact.value,
        }
        for pattern in pattern_result.scalars().all()
    ]
    recurrence = await groq_service.detect_recurrence(_submission_payload(submission), known_patterns)

    role_by_pattern_id = recurrence.get("role_by_pattern_id", {})
    known_pattern_ids = {pattern["id"] for pattern in known_patterns}
    for pattern_id in recurrence.get("matched_pattern_ids", []):
        if pattern_id not in known_pattern_ids:
            continue
        role = role_by_pattern_id.get(pattern_id, "contributing")
        db.add(
            SubmissionTag(
                submission_id=submission.id,
                pattern_id=UUID(pattern_id),
                role=SubmissionTagRole.PRIMARY if role == "primary" else SubmissionTagRole.CONTRIBUTING,
            )
        )

    overlay_data = recurrence
    if recurrence.get("is_recurring"):
        overlay_data = await groq_service.build_overlay_copy(recurrence, _submission_payload(submission))

    queue_result = await db.execute(
        select(RevisionQueueItem).where(
            RevisionQueueItem.user_id == current_user.id,
            RevisionQueueItem.problem_slug == payload.problem_slug,
            RevisionQueueItem.platform == payload.platform,
        )
    )
    if queue_result.scalar_one_or_none() is None:
        db.add(
            RevisionQueueItem(
                user_id=current_user.id,
                problem_slug=payload.problem_slug,
                platform=payload.platform,
                problem_title=payload.problem_title,
                next_due=datetime.now(UTC).date() + timedelta(days=1),
            )
        )

    failure_count = await db.scalar(select(func.count()).select_from(Submission).where(Submission.user_id == current_user.id))
    current_user.last_active = datetime.now(UTC)
    await db.commit()

    if failure_count is not None and failure_count % 5 == 0:
        background_tasks.add_task(run_pattern_aggregation, current_user.id)

    return SubmissionIngestResponse(submission_id=submission.id, overlay_data=overlay_data)


@router.get("", response_model=SubmissionListResponse)
async def list_submissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    platform: Platform | None = None,
    verdict: SubmissionVerdict | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SubmissionListResponse:
    conditions = [Submission.user_id == current_user.id]
    if platform is not None:
        conditions.append(Submission.platform == platform)
    if verdict is not None:
        conditions.append(Submission.verdict == verdict)
    if date_from is not None:
        conditions.append(Submission.submitted_at >= date_from)
    if date_to is not None:
        conditions.append(Submission.submitted_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(Submission).where(*conditions))
    result = await db.execute(
        select(Submission)
        .where(*conditions)
        .order_by(Submission.submitted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return SubmissionListResponse(
        items=[SubmissionResponse.model_validate(item) for item in result.scalars().all()],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Submission:
    result = await db.execute(select(Submission).where(Submission.id == submission_id, Submission.user_id == current_user.id))
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission
