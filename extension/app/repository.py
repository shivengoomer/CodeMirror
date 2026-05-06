from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas import SubmissionIn


async def get_or_create_user(session: AsyncSession, external_id: str) -> models.User:
    result = await session.execute(select(models.User).where(models.User.external_id == external_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = models.User(external_id=external_id)
    session.add(user)
    await session.flush()
    return user


async def store_submission(
    session: AsyncSession, user: models.User, payload: SubmissionIn
) -> models.Submission:
    overlay = payload.overlay.model_dump() if hasattr(payload.overlay, "model_dump") else payload.overlay
    submission = models.Submission(
        user_id=user.id,
        platform=payload.platform,
        problem_title=payload.problem_title,
        problem_slug=payload.problem_slug,
        language=payload.language,
        verdict=payload.verdict,
        error_message=payload.error_message,
        code=payload.code,
        failing_cases=payload.failing_cases,
        error_types=payload.error_types,
        concepts=payload.concepts,
        description=payload.description,
        failing_pattern=payload.failing_pattern,
        confidence=payload.confidence,
        severity=payload.severity,
        is_recurring=payload.is_recurring,
        matched_pattern_ids=payload.matched_pattern_ids,
        overlay=overlay,
        submitted_at=payload.submitted_at or datetime.now(UTC),
    )
    session.add(submission)
    await session.flush()
    return submission


async def count_user_failures(session: AsyncSession, user_id: int) -> int:
    result = await session.execute(
        select(func.count(models.Submission.id)).where(
            models.Submission.user_id == user_id,
            models.Submission.verdict != models.Verdict.accepted,
        )
    )
    return int(result.scalar_one())


async def list_recent_failed_submissions(
    session: AsyncSession, user_id: int, limit: int = 30
) -> list[models.Submission]:
    result = await session.execute(
        select(models.Submission)
        .where(
            models.Submission.user_id == user_id,
            models.Submission.verdict != models.Verdict.accepted,
        )
        .order_by(models.Submission.submitted_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_patterns(session: AsyncSession, user_id: int) -> list[models.Pattern]:
    result = await session.execute(
        select(models.Pattern)
        .where(models.Pattern.user_id == user_id, models.Pattern.resolved_at.is_(None))
        .order_by(models.Pattern.occurrence_count.desc(), models.Pattern.last_seen_at.desc())
    )
    return list(result.scalars().all())


async def upsert_patterns(
    session: AsyncSession, user_id: int, patterns: list[dict]
) -> list[models.Pattern]:
    saved: list[models.Pattern] = []
    for item in patterns:
        pattern_id = item.get("id") or f"pat_{uuid4().hex[:10]}"
        existing = await session.get(models.Pattern, pattern_id)
        if existing is None:
            existing = models.Pattern(
                id=pattern_id,
                user_id=user_id,
                tag=item["tag"],
                title=item["title"],
                insight=item["insight"],
                impact=item["impact"],
            )
            session.add(existing)

        existing.concept_cluster = item.get("concept_cluster", [])
        existing.evidence = item.get("evidence", [])
        existing.occurrence_count = int(item.get("occurrence_count", existing.occurrence_count))
        existing.confidence = float(item.get("confidence", existing.confidence or 0))
        existing.impact = item.get("impact", existing.impact)
        existing.suggested_revision_interval_days = int(
            item.get("suggested_revision_interval_days", existing.suggested_revision_interval_days)
        )
        existing.last_seen_at = datetime.now(UTC)
        saved.append(existing)

    await session.flush()
    return saved


async def add_or_update_revision_item(
    session: AsyncSession,
    user_id: int,
    problem_slug: str,
    platform: str,
    linked_pattern_tag: str | None,
    last_verdict: str,
    interval_days: int,
) -> models.RevisionQueueItem:
    result = await session.execute(
        select(models.RevisionQueueItem).where(
            models.RevisionQueueItem.user_id == user_id,
            models.RevisionQueueItem.problem_slug == problem_slug,
            models.RevisionQueueItem.platform == platform,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        item = models.RevisionQueueItem(
            user_id=user_id,
            problem_slug=problem_slug,
            platform=platform,
            linked_pattern_tag=linked_pattern_tag,
            last_verdict=last_verdict,
            next_due=date.today() + timedelta(days=max(interval_days, 1)),
            interval_days=max(interval_days, 1),
        )
        session.add(item)
    else:
        item.linked_pattern_tag = linked_pattern_tag or item.linked_pattern_tag
        item.last_verdict = last_verdict
        item.interval_days = max(interval_days, 1)
        item.next_due = min(item.next_due, date.today() + timedelta(days=item.interval_days))
        item.active = True
        item.updated_at = datetime.now(UTC)
    await session.flush()
    return item


async def list_revision_queue(
    session: AsyncSession, user_id: int
) -> list[models.RevisionQueueItem]:
    result = await session.execute(
        select(models.RevisionQueueItem)
        .where(models.RevisionQueueItem.user_id == user_id, models.RevisionQueueItem.active.is_(True))
        .order_by(models.RevisionQueueItem.next_due.asc())
    )
    return list(result.scalars().all())


async def save_daily_session(
    session: AsyncSession, user_id: int, session_date: date, payload: dict
) -> models.DailySession:
    result = await session.execute(
        select(models.DailySession).where(
            models.DailySession.user_id == user_id,
            models.DailySession.session_date == session_date,
        )
    )
    daily = result.scalar_one_or_none()
    if daily is None:
        daily = models.DailySession(user_id=user_id, session_date=session_date)
        session.add(daily)

    daily.todays_session = payload.get("todays_session", [])
    daily.skipped_count = int(payload.get("skipped_count", 0))
    daily.next_session_preview = payload.get("next_session_preview", [])
    daily.session_theme = payload.get("session_theme", "")
    await session.flush()
    return daily


async def save_weekly_digest(
    session: AsyncSession, user_id: int, week_start: date, week_end: date, payload: dict
) -> models.WeeklyDigest:
    result = await session.execute(
        select(models.WeeklyDigest).where(
            models.WeeklyDigest.user_id == user_id,
            models.WeeklyDigest.week_start == week_start,
            models.WeeklyDigest.week_end == week_end,
        )
    )
    digest = result.scalar_one_or_none()
    if digest is None:
        digest = models.WeeklyDigest(user_id=user_id, week_start=week_start, week_end=week_end)
        session.add(digest)

    digest.payload = payload
    await session.flush()
    return digest


async def submissions_between(
    session: AsyncSession, user_id: int, start: date, end: date
) -> list[models.Submission]:
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=UTC)
    end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
    result = await session.execute(
        select(models.Submission)
        .where(
            models.Submission.user_id == user_id,
            models.Submission.submitted_at >= start_dt,
            models.Submission.submitted_at < end_dt,
        )
        .order_by(models.Submission.submitted_at.asc())
    )
    return list(result.scalars().all())
