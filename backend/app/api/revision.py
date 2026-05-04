from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.revision_queue import RevisionQueueItem
from app.models.user import User
from app.schemas.revision import RevisionCompleteRequest, RevisionSessionResponse
from app.schemas.revision_queue import RevisionQueueItemResponse
from app.services.groq_service import groq_service
from app.services.sm2_service import update_sm2

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
    result = await db.execute(
        select(RevisionQueueItem)
        .where(RevisionQueueItem.user_id == current_user.id, RevisionQueueItem.next_due <= today)
        .order_by(RevisionQueueItem.next_due.asc(), RevisionQueueItem.added_at.asc())
    )
    items = list(result.scalars().all())
    plan = await groq_service.plan_revision_session(
        {
            "user_id": str(current_user.id),
            "due_items": [_serialize_item(item) for item in items],
            "available_minutes_per_day": current_user.available_minutes_per_day,
        }
    )
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

    update_sm2(item, payload.quality)
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
