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


async def _run_incremental_sync_inline(user_id: str) -> None:
    """Best-effort local sync fallback when Celery workers are not running."""
    try:
        from app.core.database import SessionLocal
        from app.services.sync_service import SyncService

        async with SessionLocal() as session:
            await SyncService(session).incremental_sync(user_id)
            await session.commit()
    except Exception:
        import logging

        logging.getLogger(__name__).exception("incremental_sync_background_failed", extra={"user_id": user_id})


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
    progress = 50 if (ready and sync_status == "in_progress") else 35 if sync_status == "in_progress" else 100 if ready else 0
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await trigger_delta_sync(background_tasks=background_tasks, current_user=current_user, db=db)


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

    if not lc_session:
        return {"status": "error", "message": "LeetCode session not found"}

    # Check if Celery is active
    celery_active = False
    try:
        from app.workers import celery_app
        insp = celery_app.control.inspect(timeout=1.0)
        pings = insp.ping() if insp else None
        if pings:
            celery_active = True
    except Exception:
        celery_active = False

    if celery_active:
        try:
            from app.workers.sync_worker import sync_submissions_task
            sync_submissions_task.delay(str(current_user.id), sync_type="incremental")
            return {"status": "sync_triggered", "backend": "celery"}
        except Exception:
            pass

    # Fallback to local BackgroundTasks if Celery is not active/fails
    background_tasks.add_task(_run_incremental_sync_inline, str(current_user.id))
    return {"status": "sync_triggered", "backend": "local_background"}


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


@router.post("/backfill-code")
async def backfill_missing_code(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-fetch code for all submissions that were synced without code (empty code_snapshot).
    
    This happens when the LeetCode session was expired or rate-limited during the initial sync.
    Call this endpoint after re-connecting your LeetCode session to fix missing code in the dashboard.
    """
    from app.models.submission import Submission

    # Count how many submissions need backfilling
    stmt = select(Submission).where(
        Submission.user_id == current_user.id,
        Submission.code_snapshot == "",
    )
    result = await db.execute(stmt)
    empty_subs = result.scalars().all()
    pending_count = len(empty_subs)

    if pending_count == 0:
        return {"status": "nothing_to_backfill", "pending_count": 0}

    # Run backfill in background
    background_tasks.add_task(_run_backfill_code, str(current_user.id))
    return {"status": "backfill_triggered", "pending_count": pending_count}


async def _run_backfill_code(user_id: str) -> None:
    """Background task: fetch code for all submissions with empty code_snapshot."""
    import asyncio
    import logging

    log = logging.getLogger("codemirror-api")

    try:
        from app.core.database import SessionLocal
        from app.models.submission import Submission
        from app.models.leetcode_session import LeetCodeSession
        from app.services.leetcode.client import LeetCodeClient
        import uuid

        async with SessionLocal() as db:
            uid = uuid.UUID(user_id)

            # Get LeetCode session
            sess = (await db.execute(
                select(LeetCodeSession).where(LeetCodeSession.user_id == uid)
            )).scalar_one_or_none()

            if not sess or not sess.leetcode_session or len(sess.leetcode_session) <= 20:
                log.warning(
                    "backfill_code: missing or invalid LeetCode session for user %s — "
                    "go to Settings and paste your real LEETCODE_SESSION cookie", user_id
                )
                return

            # Get username
            user = (await db.execute(
                select(User).where(User.id == uid)
            )).scalar_one_or_none()
            if not user or not user.leetcode_username:
                log.warning("backfill_code: no leetcode_username for user %s", user_id)
                return

            client = LeetCodeClient(sess.leetcode_session, sess.leetcode_csrf, sess.leetcode_headers or None)

            # ── Step 1: Build slug → [ids] map from LeetCode live API ──
            slug_to_ids: dict[str, list[str]] = {}
            try:
                recent = await client.get_recent_submissions(user.leetcode_username, limit=50)
                accepted_data = await client.get_all_accepted_submissions(user.leetcode_username, limit=50)
                all_raw = recent + (accepted_data.get("submissions", []) if isinstance(accepted_data, dict) else [])

                for s in all_raw:
                    slug = s.get("titleSlug") or s.get("title_slug") or ""
                    sid = str(s.get("id") or "").strip()
                    if slug and sid and sid not in ("None", ""):
                        slug_to_ids.setdefault(slug, [])
                        if sid not in slug_to_ids[slug]:
                            slug_to_ids[slug].append(sid)

                log.info(
                    "backfill_code: slug map built — %d slugs from %d API entries",
                    len(slug_to_ids), len(all_raw)
                )
            except Exception as e:
                log.warning("backfill_code: failed to build slug map: %s", e)

            # ── Step 2: Find DB submissions with empty code ──
            subs = (await db.execute(
                select(Submission).where(
                    Submission.user_id == uid,
                    Submission.code_snapshot == "",
                ).order_by(Submission.submitted_at.desc())
            )).scalars().all()

            log.info("backfill_code: found %d submissions with empty code for user %s", len(subs), user_id)

            fetched = 0
            failed = 0

            for sub in subs:
                # Build candidate ID list
                candidate_ids: list[str] = []

                # Priority 1: stored lc_submission_id (newer synced submissions have this)
                if isinstance(sub.ai_analysis, dict):
                    stored_id = sub.ai_analysis.get("lc_submission_id")
                    if stored_id:
                        candidate_ids.append(str(stored_id))

                # Priority 2: live IDs from LeetCode API matched by slug
                for sid in slug_to_ids.get(sub.problem_slug, []):
                    if sid not in candidate_ids:
                        candidate_ids.append(sid)

                if not candidate_ids:
                    log.warning(
                        "backfill_code: no IDs found for slug=%s (not in recent 50 — may need full sync)",
                        sub.problem_slug
                    )
                    failed += 1
                    continue

                # Try each candidate until we get code
                got_code = False
                for lc_id in candidate_ids:
                    try:
                        await asyncio.sleep(0.4)
                        detail = await client.get_submission_detail(lc_id)
                        code = (detail.get("code") or "").strip() if detail else ""
                        if code:
                            sub.code_snapshot = code
                            if isinstance(sub.ai_analysis, dict):
                                cleaned = {
                                    k: v for k, v in sub.ai_analysis.items()
                                    if k not in ("code_fetch_pending", "lc_submission_id")
                                }
                                sub.ai_analysis = cleaned or None
                            fetched += 1
                            got_code = True
                            log.info(
                                "backfill_code: ✓ %s (lc_id=%s, %d chars)",
                                sub.problem_slug, lc_id, len(code)
                            )
                            break
                    except Exception as e:
                        log.warning("backfill_code: error lc_id=%s slug=%s: %s", lc_id, sub.problem_slug, e)

                if not got_code:
                    log.warning(
                        "backfill_code: ✗ no code for %s (tried %d IDs: %s)",
                        sub.problem_slug, len(candidate_ids), candidate_ids
                    )
                    failed += 1

            await db.commit()
            log.info(
                "backfill_code: done for user %s — fetched=%d failed=%d",
                user_id, fetched, failed
            )

    except Exception:
        import logging as _logging
        _logging.getLogger("codemirror-api").exception(
            "backfill_code_background_failed", extra={"user_id": user_id}
        )


@router.get("/problems")
async def get_synced_problems(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.lc_submission_snapshot import LCSubmissionSnapshot
    from app.models.lc_problem_cache import LCProblemCache
    from app.models.submission import Submission
    from app.models.enums import SubmissionVerdict
    from sqlalchemy import case, func
    
    stmt = select(LCSubmissionSnapshot).where(LCSubmissionSnapshot.user_id == current_user.id).order_by(LCSubmissionSnapshot.last_synced.desc())
    result = await db.execute(stmt)
    snapshot = result.scalar_one_or_none()
    
    if not snapshot or not snapshot.raw_payload:
        return {"problems": []}
        
    submissions = snapshot.raw_payload.get("submissions", [])
    if isinstance(submissions, dict) and "submissions" in submissions:
        submissions = submissions["submissions"]
    
    seen_slugs = [sub.get("titleSlug") for sub in submissions if sub.get("titleSlug")]
    seen_slugs_set = set(seen_slugs)
    
    # 1. Fetch difficulty and tags from Problem Cache
    cache_map = {}
    if seen_slugs:
        caches_result = await db.execute(
            select(LCProblemCache).where(LCProblemCache.slug.in_(seen_slugs_set))
        )
        for c in caches_result.scalars().all():
            cache_map[c.slug] = {
                "difficulty": c.difficulty,
                "tags": c.tags or []
            }
            
    # 2. Fetch total and failed attempts from Submission table
    stats_map = {}
    if seen_slugs:
        stats_result = await db.execute(
            select(
                Submission.problem_slug,
                func.count(Submission.id).label("total_attempts"),
                func.sum(case((Submission.verdict != SubmissionVerdict.ACCEPTED, 1), else_=0)).label("failed_attempts")
            )
            .where(Submission.user_id == current_user.id)
            .group_by(Submission.problem_slug)
        )
        for row in stats_result.all():
            stats_map[row.problem_slug] = {
                "total": row.total_attempts,
                "failed": int(row.failed_attempts or 0)
            }
    
    seen = set()
    problems = []
    for sub in submissions:
        slug = sub.get("titleSlug")
        if slug and slug not in seen:
            seen.add(slug)
            
            prob_cache = cache_map.get(slug, {"difficulty": "Medium", "tags": []})
            prob_stats = stats_map.get(slug, {"total": 1, "failed": 0 if sub.get("statusDisplay") == "Accepted" else 1})
            
            problems.append({
                "title": sub.get("title"),
                "titleSlug": slug,
                "timestamp": sub.get("timestamp"),
                "statusDisplay": sub.get("statusDisplay"),
                "lang": sub.get("lang"),
                "difficulty": prob_cache["difficulty"],
                "tags": prob_cache["tags"],
                "totalAttempts": max(prob_stats["total"], 1),
                "failedAttempts": prob_stats["failed"]
            })
    return {"problems": problems}


from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime, UTC
from app.models.submission import Submission
from app.models.enums import Platform
from app.events import SUBMISSION_CREATED
from app.events.event_bus import EventBus
from app.services.sync_service import LEETCODE_STATUS_TO_VERDICT

class ExtensionSubmission(BaseModel):
    id: Optional[Any] = None
    title: Optional[str] = None
    title_slug: Optional[str] = None
    lang: Optional[str] = None
    status_display: Optional[str] = None
    runtime: Optional[str] = None
    memory: Optional[str] = None
    timestamp: Optional[Any] = None
    code: Optional[str] = None

class ExtensionSyncPayload(BaseModel):
    submissions: List[ExtensionSubmission]
    leetcode_session: Optional[str] = None
    leetcode_csrf: Optional[str] = None
    leetcode_headers: Optional[dict[str, str]] = None

@router.post("/extension")
async def sync_from_extension(
    payload: ExtensionSyncPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import asyncio
    event_bus = EventBus(db)
    
    # Update LeetCode Session dynamically if provided in payload
    if payload.leetcode_session and payload.leetcode_csrf:
        session_stmt = select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)
        session_row = (await db.execute(session_stmt)).scalar_one_or_none()
        if session_row:
            session_row.leetcode_session = payload.leetcode_session
            session_row.leetcode_csrf = payload.leetcode_csrf
            if payload.leetcode_headers:
                session_row.leetcode_headers = payload.leetcode_headers
        else:
            new_session = LeetCodeSession(
                user_id=current_user.id,
                leetcode_session=payload.leetcode_session,
                leetcode_csrf=payload.leetcode_csrf,
                leetcode_headers=payload.leetcode_headers or {},
            )
            db.add(new_session)
        await db.flush()

    # Fetch LC session
    stmt = select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id)
    result = await db.execute(stmt)
    lc_session = result.scalar_one_or_none()

    lc_client = None
    if lc_session and lc_session.leetcode_session and lc_session.leetcode_csrf:
        lc_client = LeetCodeClient(
            lc_session.leetcode_session,
            lc_session.leetcode_csrf,
            lc_session.leetcode_headers or None
        )

    # 1. Filter out existing submissions
    new_subs_to_sync = []
    for sub in payload.submissions:
        raw_status = str(sub.status_display or "").strip().lower()
        verdict = LEETCODE_STATUS_TO_VERDICT.get(raw_status, "wrong_answer")
        
        try:
            ts = int(str(sub.timestamp or "0"))
            submitted_at = datetime.fromtimestamp(ts if ts < 10_000_000_000 else ts / 1000, tz=UTC)
        except (ValueError, TypeError):
            submitted_at = datetime.now(UTC)
            
        slug = sub.title_slug or "unknown"
        
        existing = await db.execute(
            select(Submission).where(
                Submission.user_id == current_user.id,
                Submission.problem_slug == slug,
                Submission.submitted_at == submitted_at,
            )
        )
        if existing.scalar_one_or_none():
            continue
            
        new_subs_to_sync.append((sub, slug, verdict, submitted_at))

    # 2. Concurrently fetch code and error details for new submissions
    semaphore = asyncio.Semaphore(5)
    
    async def fetch_detail(sub_id):
        async with semaphore:
            try:
                await asyncio.sleep(0.1)  # small throttle delay
                return await lc_client.get_submission_detail(str(sub_id))
            except Exception as e:
                import logging
                logging.getLogger("codemirror-api").warning(
                    f"Failed to fetch details for submission {sub_id} in sync_from_extension: {e}"
                )
                return None

    tasks = []
    for sub, slug, verdict, submitted_at in new_subs_to_sync:
        if not sub.code and sub.id and lc_client:
            tasks.append((sub, slug, verdict, submitted_at, fetch_detail(sub.id)))
        else:
            tasks.append((sub, slug, verdict, submitted_at, None))

    fetch_coroutines = [t[4] for t in tasks if t[4] is not None]
    fetched_details = []
    if fetch_coroutines:
        fetched_details = await asyncio.gather(*fetch_coroutines)

    # Map fetched details by submission ID
    fetched_map = {}
    fetch_idx = 0
    for sub, slug, verdict, submitted_at, task_coro in tasks:
        if task_coro is not None:
            detail = fetched_details[fetch_idx]
            fetch_idx += 1
            if detail:
                fetched_map[sub.id] = detail

    # 3. Create submissions in DB and trigger analysis
    count = 0
    for sub, slug, verdict, submitted_at, _ in tasks:
        code_snapshot = sub.code or ""
        error_message = None
        failing_test_cases = []
        
        detail = fetched_map.get(sub.id) if sub.id else None
        if detail:
            code_snapshot = detail.get("code") or code_snapshot
            if detail.get("compileError"):
                error_message = detail["compileError"]
            elif detail.get("runtimeError"):
                error_message = detail["runtimeError"]
            
            if detail.get("lastTestcase") or detail.get("expectedOutput") or detail.get("codeOutput"):
                failing_test_cases.append({
                    "input": detail.get("lastTestcase") or "",
                    "expected": detail.get("expectedOutput") or "",
                    "got": detail.get("codeOutput") or "",
                })
                
        if not error_message and verdict != "accepted":
            error_message = sub.status_display

        submission = Submission(
            user_id=current_user.id,
            platform=Platform.LEETCODE,
            problem_slug=slug,
            problem_title=sub.title or slug,
            language=sub.lang or "unknown",
            code_snapshot=code_snapshot,
            verdict=verdict,
            failing_test_cases=failing_test_cases,
            error_message=error_message,
            submitted_at=submitted_at,
            analysed=False,
        )
        db.add(submission)
        await db.flush()
        
        await event_bus.emit(SUBMISSION_CREATED, "submission", submission.id, current_user.id)
        
        # Trigger Celery task to run AI analysis automatically!
        try:
            from app.workers.analysis_worker import analyze_submission_task
            analyze_submission_task.delay(str(submission.id))
        except Exception as ae:
            import logging
            logging.getLogger("codemirror-api").warning(
                f"Could not queue analysis task via Celery for submission {submission.id}: {ae}"
            )
            
        count += 1
        
    current_user.onboarding_complete = True
    await db.commit()
    
    return {"status": "ok", "synced_count": count}
