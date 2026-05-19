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
                return LeetCodeClient(TokenManager().decrypt(auth_token.encrypted_session_token), auth_token.csrf_token)

        result = await self.db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == uid))
        session = result.scalar_one_or_none()
        if not session or not session.leetcode_session:
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
            while True:
                try:
                    data = await client.get_authenticated_submissions(offset=offset, limit=50, last_key=last_key)
                except RuntimeError as exc:
                    if "LeetCode HTTP 403" not in str(exc):
                        raise
                    raise RuntimeError(
                        "LeetCode rejected the captured session while fetching submissions. "
                        "Open leetcode.com in the same browser, confirm you are logged in, "
                        "then click the CodeMirror extension again and retry sync."
                    ) from exc
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

        user_result = await self.db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if not user or not user.leetcode_username:
            return {"status": "error", "message": "Missing username"}

        try:
            recent = await client.get_recent_submissions(user.leetcode_username, limit=20)
            new_subs = [s for s in recent if int(s.get("timestamp", 0)) > last_synced_ts]

            if not new_subs:
                return {"status": "no_new_submissions"}

            count = await self._hydrate_submissions(uid, new_subs, client)
            state.last_synced_at = datetime.now(UTC)
            state.total_submissions = (state.total_submissions or 0) + count

            logger.info("incremental_sync_completed", user_id=user_id, new_submissions=count)
            return {"status": "completed", "new_submissions": count}

        except Exception as e:
            logger.exception("incremental_sync_failed", user_id=user_id)
            return {"status": "failed", "error": str(e)}

    async def _hydrate_submissions(self, user_id: uuid.UUID, raw_subs: list[dict], client: LeetCodeClient) -> int:
        """Convert raw LeetCode submissions into normalized Submission rows."""
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

            submission = Submission(
                user_id=user_id,
                platform=Platform.LEETCODE,
                problem_slug=slug,
                problem_title=raw.get("title", slug),
                language=raw.get("lang", "unknown"),
                code_snapshot="",  # Code not available in list API
                verdict=verdict,
                submitted_at=submitted_at,
                analysed=False,
            )
            self.db.add(submission)
            await self.db.flush()

            await self.event_bus.emit(SUBMISSION_CREATED, "submission", submission.id, user_id)
            count += 1

        return count
