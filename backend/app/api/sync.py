from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.leetcode_session import LeetCodeSession
from app.services.leetcode.client import LeetCodeClient
from app.services.leetcode.sync import LeetCodeSyncService
from sqlalchemy import select

router = APIRouter(prefix="/sync", tags=["sync"])

@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user)
):
    return {
        "ready": current_user.onboarding_complete,
        "progress": 100 if current_user.onboarding_complete else 0
    }

@router.post("/submissions")
async def trigger_delta_sync(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch LC session
    stmt = select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)
    result = await db.execute(stmt)
    lc_session = result.scalar_one_or_none()

    if lc_session:
        sync_service = LeetCodeSyncService(db)
        client = LeetCodeClient(lc_session.leetcode_session, lc_session.leetcode_csrf)
        background_tasks.add_task(sync_service.delta_sync, current_user.id, client)
        return {"status": "sync_triggered"}
    
    return {"status": "error", "message": "LeetCode session not found"}

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
