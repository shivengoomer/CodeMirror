import json
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.user import User
from app.schemas.revision import RevisionCompleteRequest, RevisionSessionResponse
from app.schemas.revision_queue import RevisionQueueItemResponse
from app.services.revision import RevisionService
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT

router = APIRouter(prefix="/revision-queue", tags=["revision-queue"])


def _serialize_item(item: RevisionQueueItem) -> dict[str, object]:
    return {
        "id": str(item.id),
        "problem_slug": item.problem_slug,
        "platform": item.platform.value,
        "problem_title": item.problem_title,
        "linked_pattern_id": str(item.linked_pattern_id) if item.linked_pattern_id else None,
        "interval_days": item.interval_days,
        "ease_factor": item.ease_factor,
        "repetitions": item.repetitions,
        "next_due": item.next_due.isoformat(),
        "last_verdict": item.last_verdict,
    }


@router.get("", response_model=list[RevisionQueueItemResponse])
async def list_revision_queue(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RevisionQueueItem]:
    result = await db.execute(
        select(RevisionQueueItem)
        .where(RevisionQueueItem.user_id == current_user.id)
        .order_by(RevisionQueueItem.next_due.asc(), RevisionQueueItem.added_at.asc())
    )
    return list(result.scalars().all())


@router.get("/today", response_model=RevisionSessionResponse)
async def todays_revision_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionSessionResponse:
    today = datetime.now(UTC).date()

    # Fetch all analyzed problems for context
    analyzed_result = await db.execute(
        select(Submission)
        .where(Submission.user_id == current_user.id, Submission.analysed.is_(True))
        .order_by(Submission.submitted_at.desc())
        .limit(50)
    )
    analyzed_submissions = list(analyzed_result.scalars().all())

    analyzed_problems_data = []
    seen_slugs = set()
    for sub in analyzed_submissions:
        if sub.problem_slug not in seen_slugs:
            analyzed_problems_data.append({
                "problem_slug": sub.problem_slug,
                "title": sub.problem_title,
                "analysis": sub.ai_analysis
            })
            seen_slugs.add(sub.problem_slug)

    result = await db.execute(
        select(RevisionQueueItem)
        .where(RevisionQueueItem.user_id == current_user.id, RevisionQueueItem.next_due <= today)
        .order_by(RevisionQueueItem.next_due.asc(), RevisionQueueItem.added_at.asc())
    )
    items = list(result.scalars().all())
    
    # Simplified plan generation for now
    plan = {
        "due_today": [
            {
                "problem_title": item.problem_title,
                "reason": "Spaced repetition due",
                "focus_question": "Can you solve this optimally?",
                "last_mistake": "N/A",
                "expected_duration_mins": 30
            } for item in items[:5]
        ],
        "streak_status": "Active",
        "recommendation": "Focus on consistency."
    }
    
    return RevisionSessionResponse(
        items=[RevisionQueueItemResponse.model_validate(item) for item in items],
        plan=plan,
    )


@router.post("/{item_id}/complete", response_model=RevisionQueueItemResponse)
async def complete_revision_item(
    item_id: UUID,
    payload: RevisionCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RevisionQueueItem:
    result = await db.execute(select(RevisionQueueItem).where(RevisionQueueItem.id == item_id, RevisionQueueItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision queue item not found")

    rev_service = RevisionService(db)
    rev_service.update_sm2(item, payload.quality)
    item.last_reviewed = datetime.now(UTC)
    item.last_verdict = payload.last_verdict
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_revision_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(RevisionQueueItem).where(RevisionQueueItem.id == item_id, RevisionQueueItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision queue item not found")
    await db.delete(item)
    await db.commit()
