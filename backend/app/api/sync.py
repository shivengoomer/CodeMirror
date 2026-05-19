from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.leetcode_session import LeetCodeSession
from app.models.lc_submission_snapshot import LCSubmissionSnapshot
from app.models.sync_job import SyncJob
from app.models.sync_state import SyncState
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.sync import LeetCodeSyncService
from sqlalchemy import select

router = APIRouter(prefix="/sync", tags=["sync"])


async def _run_initial_sync_inline(user_id: str) -> None:
    """Best-effort local sync fallback when Celery workers are not running."""
    try:
        from app.core.database import SessionLocal
        from app.services.sync_service import SyncService

        async with SessionLocal() as session:
            await SyncService(session).initial_sync(user_id)
            await session.commit()
    except Exception:
        import logging

        logging.getLogger(__name__).exception("initial_sync_background_failed", extra={"user_id": user_id})


@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await db.scalar(select(SyncState).where(SyncState.user_id == current_user.id))
    session = await db.scalar(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id))
    snapshot = await db.scalar(
        select(LCSubmissionSnapshot).where(LCSubmissionSnapshot.user_id == current_user.id).limit(1)
    )
    has_leetcode_session = bool(session and session.leetcode_session)
    sync_status = state.sync_status if state else "pending"
    sync_decision_made = sync_status in {"completed", "skipped"} or snapshot is not None
    ready = bool(current_user.onboarding_complete and sync_decision_made)
    needs_initial_sync = bool(has_leetcode_session and not ready and sync_status != "in_progress")
    progress = 100 if ready else 35 if sync_status == "in_progress" else 0
    return {
        "ready": ready,
        "progress": progress,
        "has_leetcode_session": has_leetcode_session,
        "needs_initial_sync": needs_initial_sync,
        "sync_status": sync_status,
        "last_synced_at": state.last_synced_at.isoformat() if state and state.last_synced_at else None,
        "total_submissions": state.total_submissions if state else 0,
        "last_sync_error": state.last_sync_error if state else None,
    }

@router.post("/initial")
async def trigger_initial_sync(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await db.scalar(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)):
        return {"status": "error", "message": "LeetCode session not found"}

    state = await db.scalar(select(SyncState).where(SyncState.user_id == current_user.id))
    if state is None:
        state = SyncState(user_id=current_user.id, sync_status="pending")
        db.add(state)
        await db.flush()
    state.sync_status = "in_progress"
    state.last_sync_error = None
    await db.commit()

    background_tasks.add_task(_run_initial_sync_inline, str(current_user.id))
    return {"status": "sync_triggered", "sync_type": "initial"}


@router.post("/later")
async def skip_initial_sync_for_now(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await db.scalar(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)):
        return {"status": "error", "message": "LeetCode session not found"}
    state = await db.scalar(select(SyncState).where(SyncState.user_id == current_user.id))
    if state is None:
        state = SyncState(user_id=current_user.id, sync_status="skipped")
        db.add(state)
    else:
        state.sync_status = "skipped"
        state.last_sync_error = None
    current_user.onboarding_complete = True
    await db.commit()
    return {"status": "skipped", "ready": True}


@router.post("/incremental")
async def trigger_incremental_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trigger_delta_sync(current_user=current_user, db=db)


@router.post("/submissions")
async def trigger_delta_sync(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch LC session
    stmt = select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)
    result = await db.execute(stmt)
    lc_session = result.scalar_one_or_none()

    if lc_session:
        from app.workers.sync_worker import sync_submissions_task
        sync_submissions_task.delay(str(current_user.id), sync_type="incremental")
        return {"status": "sync_triggered"}
    
    return {"status": "error", "message": "LeetCode session not found"}


@router.get("/history")
async def get_sync_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SyncJob)
        .where(SyncJob.user_id == current_user.id)
        .order_by(SyncJob.created_at.desc())
        .limit(25)
    )
    return [
        {
            "id": str(job.id),
            "job_type": job.job_type,
            "status": job.status,
            "submissions_fetched": job.submissions_fetched,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
        }
        for job in result.scalars().all()
    ]

@router.get("/problems")
async def get_synced_problems(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.lc_submission_snapshot import LCSubmissionSnapshot
    stmt = select(LCSubmissionSnapshot).where(LCSubmissionSnapshot.user_id == current_user.id).order_by(LCSubmissionSnapshot.last_synced.desc())
    result = await db.execute(stmt)
    snapshot = result.scalar_one_or_none()
    
    if not snapshot or not snapshot.raw_payload:
        return {"problems": []}
        
    submissions = snapshot.raw_payload.get("submissions", [])
    if isinstance(submissions, dict) and "submissions" in submissions:
        submissions = submissions["submissions"]
    
    seen = set()
    problems = []
    for sub in submissions:
        slug = sub.get("titleSlug")
        if slug and slug not in seen:
            seen.add(slug)
            problems.append({
                "title": sub.get("title"),
                "titleSlug": slug,
                "timestamp": sub.get("timestamp"),
                "statusDisplay": sub.get("statusDisplay"),
                "lang": sub.get("lang")
            })
    return {"problems": problems}
