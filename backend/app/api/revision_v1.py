"""Prompt-compatible revision API paths."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.revision_queue import RevisionQueueItem
from app.models.user import User
from app.services.revision_service import RevisionServiceV2
from app.workers.revision_worker import generate_revision_queue_task

router = APIRouter(prefix="/revision", tags=["revision"])


@router.get("/queue")
async def get_revision_queue(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RevisionQueueItem)
        .where(RevisionQueueItem.user_id == current_user.id)
        .order_by(RevisionQueueItem.next_due.asc(), RevisionQueueItem.added_at.asc())
    )
    return [
        {
            "id": str(item.id),
            "question_id": None,
            "problem_slug": item.problem_slug,
            "problem_title": item.problem_title,
            "queue_type": "spaced_repetition",
            "priority_score": item.ease_factor,
            "status": "pending",
            "next_due": item.next_due.isoformat(),
        }
        for item in result.scalars().all()
    ]


@router.post("/queue/generate")
async def regenerate_revision_queue(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await RevisionServiceV2(db).generate_queue(str(current_user.id))
    generate_revision_queue_task.delay(str(current_user.id))
    return {"status": "queued", "preview": items}


@router.put("/queue/{item_id}/complete")
async def complete_revision_queue_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.scalar(
        select(RevisionQueueItem).where(RevisionQueueItem.id == item_id, RevisionQueueItem.user_id == current_user.id)
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Revision queue item not found")
    from datetime import UTC, datetime

    item.last_reviewed = datetime.now(UTC)
    item.last_verdict = "completed"
    await db.commit()
    return {"status": "completed", "id": str(item.id)}
