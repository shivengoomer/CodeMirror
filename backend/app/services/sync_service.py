"""Sync Service — LeetCode submission sync with rate limiting and retry logic."""
import uuid
from datetime import UTC, datetime, timedelta
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.events import SYNC_STARTED, SYNC_COMPLETED, SYNC_FAILED, SUBMISSION_CREATED
from app.events.event_bus import EventBus
from app.auth.token_manager import TokenManager
from app.models.auth_token import AuthToken
from app.models.leetcode_session import LeetCodeSession
from app.models.lc_submission_snapshot import LCSubmissionSnapshot
from app.models.submission import Submission
from app.models.sync_state import SyncState
from app.models.sync_job import SyncJob
from app.models.user import User
from app.models.enums import Platform, SubmissionVerdict
from app.services.leetcode.client import LeetCodeClient

logger = get_logger("sync_service")

LEETCODE_STATUS_TO_VERDICT = {
    "accepted": "accepted",
    "wrong answer": "wrong_answer",
    "time limit exceeded": "tle",
    "memory limit exceeded": "mle",
    "runtime error": "runtime_error",
    "compile error": "compile_error",
}


class SyncService:
    """Handles initial and incremental sync of LeetCode submissions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.event_bus = EventBus(db)

    async def _get_lc_client(self, user_id: str) -> LeetCodeClient | None:
        uid = uuid.UUID(user_id)
        has_auth_tokens = bool(
            await self.db.scalar(text("SELECT to_regclass(:table_name)"), {"table_name": "public.auth_tokens"})
        )
        if has_auth_tokens:
            token_result = await self.db.execute(
                select(AuthToken)
                .where(AuthToken.user_id == uid, AuthToken.is_valid.is_(True))
                .order_by(AuthToken.last_refreshed.desc().nullslast(), AuthToken.created_at.desc())
                .limit(1)
            )
            auth_token = token_result.scalar_one_or_none()
            if auth_token:
                session = TokenManager().decrypt(auth_token.encrypted_session_token)
                if session and len(session) > 20:
                    return LeetCodeClient(session, auth_token.csrf_token)

        result = await self.db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == uid))
        session = result.scalar_one_or_none()
        if not session or not session.leetcode_session:
            logger.warning("no_leetcode_session_for_user user_id=%s", user_id)
            return None

        # Real LEETCODE_SESSION cookies are 100s of chars; short values are placeholders
        if len(session.leetcode_session) <= 20:
            logger.warning(
                "leetcode_session_looks_invalid user_id=%s len=%d value=%r — "
                "Go to Settings and paste your real LEETCODE_SESSION cookie",
                user_id, len(session.leetcode_session), session.leetcode_session,
            )
            return None

        return LeetCodeClient(session.leetcode_session, session.leetcode_csrf, session.leetcode_headers or None)

    async def _get_or_create_sync_state(self, user_id: uuid.UUID) -> SyncState:
        result = await self.db.execute(select(SyncState).where(SyncState.user_id == user_id))
        state = result.scalar_one_or_none()
        if not state:
            state = SyncState(user_id=user_id, sync_status="pending")
            self.db.add(state)
            await self.db.flush()
        return state

    async def initial_sync(self, user_id: str) -> dict:
        """Full sync — fetch ALL submissions from LeetCode."""
        uid = uuid.UUID(user_id)
        client = await self._get_lc_client(user_id)
        if not client:
            return {"status": "error", "message": "No LeetCode session"}

        state = await self._get_or_create_sync_state(uid)
        state.sync_status = "in_progress"
        await self.db.flush()

        job = SyncJob(user_id=uid, job_type="initial_sync", status="processing", started_at=datetime.now(UTC))
        self.db.add(job)
        await self.db.flush()

        await self.event_bus.emit(SYNC_STARTED, "sync", job.id, uid)

        try:
            user_result = await self.db.execute(select(User).where(User.id == uid))
            user = user_result.scalar_one_or_none()
            if not user:
                raise ValueError("Missing user")
            if not user.leetcode_username:
                user.leetcode_username = await client.require_signed_in_username()
            if not user.leetcode_username:
                raise ValueError("Missing LeetCode username")

            all_submissions = []
            offset = 0
            last_key = None
            
            # Try REST API first
            try:
                while True:
                    data = await client.get_authenticated_submissions(offset=offset, limit=50, last_key=last_key)
                    batch = data.get("submissions", [])
                    all_submissions.extend(batch)
                    if not data.get("hasNext"):
                        break
                    last_key = data.get("lastKey")
                    if last_key:
                        offset = 0
                    else:
                        offset += 50
                    if not batch:
                        break
            except RuntimeError as exc:
                if "LeetCode HTTP 401" in str(exc) or "LeetCode HTTP 403" in str(exc):
                    logger.warning("REST API failed, falling back to GraphQL accepted submissions", exc_info=True)
                    # Fallback to GraphQL
                    all_submissions = []
                    offset = 0
                    while True:
                        data = await client.get_all_accepted_submissions(user.leetcode_username, offset=offset, limit=50)
                        batch = data.get("submissions", [])
                        all_submissions.extend(batch)
                        if len(batch) < 50:
                            break
                        offset += 50
                else:
                    raise

            # Store snapshot
            snapshot = LCSubmissionSnapshot(
                user_id=uid,
                last_synced=datetime.now(UTC),
                total_solved=len(all_submissions),
                raw_payload={"submissions": all_submissions},
            )
            self.db.add(snapshot)

            # Create normalized submission records
            count = await self._hydrate_submissions(uid, all_submissions, client)

            state.sync_status = "completed"
            state.last_synced_at = datetime.now(UTC)
            state.total_submissions = count

            job.status = "completed"
            job.submissions_fetched = count
            job.completed_at = datetime.now(UTC)

            user.onboarding_complete = True
            await self.event_bus.emit(SYNC_COMPLETED, "sync", job.id, uid, {"count": count})

            logger.info("initial_sync_completed", user_id=user_id, submissions=count)
            return {"status": "completed", "submissions_fetched": count}

        except Exception as e:
            state.sync_status = "failed"
            state.last_sync_error = str(e)
            state.retry_count += 1
            job.status = "failed"
            job.error_message = str(e)
            await self.event_bus.emit(SYNC_FAILED, "sync", job.id, uid, {"error": str(e)})
            logger.exception("initial_sync_failed", user_id=user_id)
            return {"status": "failed", "error": str(e)}

    async def incremental_sync(self, user_id: str) -> dict:
        """Incremental sync — fetch only new submissions since last sync."""
        uid = uuid.UUID(user_id)
        client = await self._get_lc_client(user_id)
        if not client:
            return {"status": "error", "message": "No LeetCode session"}

        state = await self._get_or_create_sync_state(uid)
        last_synced_ts = int(state.last_synced_at.timestamp()) if state.last_synced_at else 0
        
        state.sync_status = "in_progress"
        state.last_sync_error = None
        await self.db.commit()

        user_result = await self.db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if not user or not user.leetcode_username:
            state_res = await self.db.execute(select(SyncState).where(SyncState.user_id == uid))
            st = state_res.scalar_one_or_none()
            if st:
                st.sync_status = "failed"
                st.last_sync_error = "Missing username"
            await self.db.commit()
            return {"status": "error", "message": "Missing username"}

        try:
            recent = await client.get_recent_submissions(user.leetcode_username, limit=20)
            new_subs = [s for s in recent if int(s.get("timestamp", 0)) > last_synced_ts]

            state_res = await self.db.execute(select(SyncState).where(SyncState.user_id == uid))
            state = state_res.scalar_one()

            if not new_subs:
                state.sync_status = "completed"
                state.last_synced_at = datetime.now(UTC)
                await self.db.commit()
                return {"status": "no_new_submissions"}

            count = await self._hydrate_submissions(uid, new_subs, client)
            state.last_synced_at = datetime.now(UTC)
            state.total_submissions = (state.total_submissions or 0) + count
            state.sync_status = "completed"
            await self.db.commit()

            logger.info("incremental_sync_completed", user_id=user_id, new_submissions=count)
            return {"status": "completed", "new_submissions": count}

        except Exception as e:
            logger.exception("incremental_sync_failed", user_id=user_id)
            state_res = await self.db.execute(select(SyncState).where(SyncState.user_id == uid))
            st = state_res.scalar_one_or_none()
            if st:
                st.sync_status = "failed"
                st.last_sync_error = str(e)
            await self.db.commit()
            return {"status": "failed", "error": str(e)}

    async def _hydrate_submissions(self, user_id: uuid.UUID, raw_subs: list[dict], client: LeetCodeClient) -> int:
        """Convert raw LeetCode submissions into normalized Submission rows."""
        import asyncio
        count = 0
        for raw in raw_subs:
            raw_status = str(raw.get("statusDisplay", "")).strip().lower()
            verdict = LEETCODE_STATUS_TO_VERDICT.get(raw_status, "wrong_answer")

            try:
                ts = int(str(raw.get("timestamp", "0")))
                submitted_at = datetime.fromtimestamp(ts if ts < 10_000_000_000 else ts / 1000, tz=UTC)
            except (ValueError, OSError):
                submitted_at = datetime.now(UTC)

            slug = raw.get("titleSlug", "")
            if not slug:
                continue

            # Skip duplicates
            existing = await self.db.execute(
                select(Submission).where(
                    Submission.user_id == user_id,
                    Submission.problem_slug == slug,
                    Submission.submitted_at == submitted_at,
                )
            )
            if existing.scalar_one_or_none():
                continue

            code_snapshot = raw.get("code", "")
            error_message = None
            failing_test_cases = []
            lc_submission_id = raw.get("id")
            code_fetch_failed = False

            if lc_submission_id:
                try:
                    await asyncio.sleep(0.3)  # Throttle to avoid rate-limiting
                    detail = await client.get_submission_detail(str(lc_submission_id))
                    if detail:
                        fetched_code = detail.get("code") or ""
                        if fetched_code:
                            code_snapshot = fetched_code
                        else:
                            logger.warning(
                                "code_fetch_empty_for_submission",
                                submission_id=str(lc_submission_id),
                                slug=slug,
                            )
                            code_fetch_failed = True

                        # Extract error message
                        if detail.get("compileError"):
                            error_message = detail["compileError"]
                        elif detail.get("runtimeError"):
                            error_message = detail["runtimeError"]

                        # Extract failing test cases
                        if detail.get("lastTestcase") or detail.get("expectedOutput") or detail.get("codeOutput"):
                            failing_test_cases.append({
                                "input": detail.get("lastTestcase") or "",
                                "expected": detail.get("expectedOutput") or "",
                                "got": detail.get("codeOutput") or "",
                            })
                    else:
                        logger.warning(
                            "code_fetch_no_detail_returned",
                            submission_id=str(lc_submission_id),
                            slug=slug,
                        )
                        code_fetch_failed = True
                except Exception as e:
                    logger.warning(
                        "code_fetch_exception",
                        submission_id=str(lc_submission_id),
                        slug=slug,
                        error=str(e),
                    )
                    code_fetch_failed = True

            # Store the LeetCode submission ID as metadata so backfill can retry later
            extras: dict = {}
            if lc_submission_id:
                extras["lc_submission_id"] = str(lc_submission_id)
            if code_fetch_failed:
                extras["code_fetch_pending"] = True

            submission = Submission(
                user_id=user_id,
                platform=Platform.LEETCODE,
                problem_slug=slug,
                problem_title=raw.get("title", slug),
                language=raw.get("lang", "unknown"),
                code_snapshot=code_snapshot,
                verdict=verdict,
                failing_test_cases=failing_test_cases,
                error_message=error_message,
                submitted_at=submitted_at,
                analysed=False,
                ai_analysis=extras if extras else None,
            )
            self.db.add(submission)
            await self.db.flush()

            await self.event_bus.emit(SUBMISSION_CREATED, "submission", submission.id, user_id)

            # Trigger analysis worker in background
            try:
                from app.workers.analysis_worker import analyze_submission_task
                analyze_submission_task.delay(str(submission.id))
            except Exception as ae:
                logger.warning(f"Could not queue analysis task via Celery: {ae}")

            count += 1

        return count

