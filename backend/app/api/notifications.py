from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import PatternImpact, SubmissionVerdict
from app.models.pattern import Pattern
from app.models.revision_queue import RevisionQueueItem
from app.models.submission import Submission
from app.models.user import User
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, NOTIFICATION_TRIGGER_PROMPT

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/unread")
async def unread_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    # 1. Fetch context for notification generation
    today = datetime.now(UTC).date()
    
    # Overdue count
    overdue_result = await db.execute(
        select(func.count(RevisionQueueItem.id))
        .where(RevisionQueueItem.user_id == current_user.id, RevisionQueueItem.next_due <= today)
    )
    overdue_count = overdue_result.scalar() or 0
    
    # Next due problem
    next_due_result = await db.execute(
        select(RevisionQueueItem)
        .where(RevisionQueueItem.user_id == current_user.id, RevisionQueueItem.next_due > today)
        .order_by(RevisionQueueItem.next_due.asc())
        .limit(1)
    )
    next_due_item = next_due_result.scalar_one_or_none()
    
    # Last failure
    last_failure_result = await db.execute(
        select(Submission)
        .where(Submission.user_id == current_user.id, Submission.verdict != SubmissionVerdict.ACCEPTED)
        .order_by(Submission.submitted_at.desc())
        .limit(1)
    )
    last_failure = last_failure_result.scalar_one_or_none()
    
    # Top pattern
    top_pattern_result = await db.execute(
        select(Pattern)
        .where(Pattern.user_id == current_user.id)
        .order_by(Pattern.occurrence_count.desc())
        .limit(1)
    )
    top_pattern = top_pattern_result.scalar_one_or_none()
    
    # Streak and Inactivity
    # (Simplified for now, could be more robust)
    days_inactive = (datetime.now(UTC).replace(tzinfo=None) - current_user.last_active.replace(tzinfo=None)).days
    
    context = {
        "days_inactive": days_inactive,
        "streak_days": 0, # Should be calculated
        "overdue_count": overdue_count,
        "next_due_problem": next_due_item.problem_title if next_due_item else "None",
        "hours_until_due": 24, # Simplified
        "top_pattern_name": top_pattern.title if top_pattern else "None",
        "last_failure_title": last_failure.problem_title if last_failure else "None",
        "last_failure_category": last_failure.ai_analysis.get("failure_category") if last_failure and last_failure.ai_analysis else "Unknown"
    }
    
    user_prompt = NOTIFICATION_TRIGGER_PROMPT.format(**context)
    groq_client = GroqClient()
    response = await groq_client.complete_json(
        system_prompt=MASTER_SYSTEM_PROMPT,
        user_prompt=user_prompt
    )
    
    return [response.get("data", {})]
