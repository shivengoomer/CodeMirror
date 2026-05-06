from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

import prompts
from app import models, repository
from app.llm import LLMUnavailableError, complete_json


async def run_pattern_aggregation(
    session: AsyncSession, user_id: int, limit: int = 30
) -> dict:
    submissions = await repository.list_recent_failed_submissions(session, user_id, limit=limit)
    existing = await repository.list_patterns(session, user_id)
    if not submissions:
        return {"patterns": [], "noise": [], "summary": "No failed submissions to analyse."}

    newest_first = submissions
    oldest_first = list(reversed(newest_first))
    prompt = prompts.build_be1_prompt(
        prompts.BatchAnalysisInput(
            total_submissions=len(submissions),
            platforms=sorted({item.platform for item in submissions}),
            languages=sorted({item.language for item in submissions}),
            date_from=oldest_first[0].submitted_at.date().isoformat(),
            date_to=newest_first[0].submitted_at.date().isoformat(),
            submissions=[
                prompts.TaggedSubmission(
                    problem_title=item.problem_title,
                    problem_slug=item.problem_slug,
                    platform=item.platform,
                    verdict=item.verdict,
                    error_types=item.error_types,
                    concepts=item.concepts,
                    description=item.description,
                    submitted_at=item.submitted_at.isoformat(),
                )
                for item in oldest_first
            ],
            existing_patterns=[
                prompts.ExistingPattern(
                    id=item.id,
                    tag=item.tag,
                    title=item.title,
                    occurrence_count=item.occurrence_count,
                    impact=item.impact,
                )
                for item in existing
            ],
        )
    )

    result = await _call_or_stub(prompt.messages, prompt.groq_config, fallback=_fallback_be1(submissions))
    saved = await repository.upsert_patterns(session, user_id, result.get("patterns", []))

    pattern_by_tag = {pattern.tag: pattern for pattern in saved}
    submission_by_slug = {item.problem_slug: item for item in submissions}
    for pattern in saved:
        interval = pattern.suggested_revision_interval_days
        for slug in pattern.evidence:
            submission = submission_by_slug.get(slug)
            if submission:
                await repository.add_or_update_revision_item(
                    session=session,
                    user_id=user_id,
                    problem_slug=submission.problem_slug,
                    platform=submission.platform,
                    linked_pattern_tag=pattern.tag,
                    last_verdict=submission.verdict,
                    interval_days=interval,
                )

    await session.commit()
    result["saved_pattern_ids"] = [pattern.id for pattern in saved]
    result["pattern_tags"] = list(pattern_by_tag)
    return result


async def build_revision_session(
    session: AsyncSession,
    user_id: int,
    today: date,
    available_minutes: int | None = None,
) -> models.DailySession:
    patterns = await repository.list_patterns(session, user_id)
    queue = await repository.list_revision_queue(session, user_id)
    prompt = prompts.build_be2_prompt(
        prompts.RevisionScheduleInput(
            today_date=today.isoformat(),
            available_minutes=available_minutes,
            patterns=[
                prompts.ActivePattern(
                    tag=item.tag,
                    title=item.title,
                    impact=item.impact,
                    concept_cluster=item.concept_cluster,
                    occurrence_count=item.occurrence_count,
                )
                for item in patterns
            ],
            queue=[
                prompts.RevisionQueueItem(
                    problem_slug=item.problem_slug,
                    platform=item.platform,
                    next_due=item.next_due.isoformat(),
                    interval_days=item.interval_days,
                    ease_factor=item.ease_factor,
                    repetitions=item.repetitions,
                    linked_pattern_tag=item.linked_pattern_tag,
                    last_verdict=item.last_verdict,
                    days_overdue=(today - item.next_due).days,
                )
                for item in queue
            ],
        )
    )
    result = await _call_or_stub(prompt.messages, prompt.groq_config, fallback=_fallback_be2(queue, today))
    daily = await repository.save_daily_session(session, user_id, today, result)
    await session.commit()
    return daily


async def build_weekly_digest(
    session: AsyncSession, user_id: int, week_start: date, week_end: date
) -> models.WeeklyDigest:
    submissions = await repository.submissions_between(session, user_id, week_start, week_end)
    patterns = await repository.list_patterns(session, user_id)
    accepted = [item.problem_slug for item in submissions if item.verdict == models.Verdict.accepted]

    prompt = prompts.build_be3_prompt(
        prompts.WeeklyDigestInput(
            week_start=week_start.isoformat(),
            week_end=week_end.isoformat(),
            submissions=[
                prompts.WeeklySubmission(
                    problem_slug=item.problem_slug,
                    platform=item.platform,
                    verdict=item.verdict,
                    error_types=item.error_types,
                )
                for item in submissions
            ],
            pattern_changes=[
                prompts.PatternChange(
                    title=item.title,
                    prev_count=max(item.occurrence_count - 1, 0),
                    new_count=item.occurrence_count,
                    impact=item.impact,
                )
                for item in patterns
            ],
            revision_sessions_done=0,
            revision_sessions_scheduled=0,
            problems_resolved=accepted,
            current_streak=0,
        )
    )
    result = await _call_or_stub(prompt.messages, prompt.groq_config, fallback=_fallback_be3(submissions))
    digest = await repository.save_weekly_digest(session, user_id, week_start, week_end, result)
    await session.commit()
    return digest


async def _call_or_stub(
    messages: list[dict[str, str]], config: dict, fallback: dict
) -> dict:
    try:
        return await complete_json(messages, config)
    except LLMUnavailableError:
        return fallback


def _fallback_be1(submissions: list[models.Submission]) -> dict:
    grouped: dict[str, list[models.Submission]] = {}
    for item in submissions:
        tag = item.error_types[0] if item.error_types else "logic_error"
        grouped.setdefault(tag, []).append(item)

    patterns = []
    for tag, items in grouped.items():
        if len(items) < 2:
            continue
        concepts = sorted({concept for item in items for concept in item.concepts})
        patterns.append(
            {
                "id": None,
                "tag": tag,
                "concept_cluster": concepts[:3],
                "title": f"Repeated {tag.replace('_', ' ')}"[:40],
                "insight": "This failure type is appearing across multiple recent submissions.",
                "evidence": [item.problem_slug for item in items[:5]],
                "occurrence_count": len(items),
                "confidence": 0.55,
                "impact": "medium",
                "suggested_revision_interval_days": 7,
            }
        )

    pattern_slugs = {slug for pattern in patterns for slug in pattern["evidence"]}
    return {
        "patterns": patterns,
        "noise": [item.problem_slug for item in submissions if item.problem_slug not in pattern_slugs],
        "weakest_concept": "",
        "strongest_concept": "",
        "summary": "Local fallback grouped repeated error tags. Configure GROQ_API_KEY for deeper analysis.",
    }


def _fallback_be2(queue: list[models.RevisionQueueItem], today: date) -> dict:
    ranked = sorted(queue, key=lambda item: (item.next_due > today, item.next_due))[:8]
    return {
        "todays_session": [
            {
                "problem_slug": item.problem_slug,
                "platform": item.platform,
                "priority_rank": index + 1,
                "reason": "Due by revision schedule",
                "focus_hint": item.linked_pattern_tag or "Review prior mistake",
                "estimated_minutes": 25,
            }
            for index, item in enumerate(ranked)
        ],
        "skipped_count": max(len(queue) - len(ranked), 0),
        "next_session_preview": [item.problem_slug for item in queue[8:11]],
        "session_theme": "Due revision",
    }


def _fallback_be3(submissions: list[models.Submission]) -> dict:
    failed = [item for item in submissions if item.verdict != models.Verdict.accepted]
    accepted = [item for item in submissions if item.verdict == models.Verdict.accepted]
    return {
        "week_summary": "Local fallback generated a basic weekly digest. Configure GROQ_API_KEY for coach-style detail.",
        "progress_note": "Progress needs the full model analysis to compare pattern movement accurately.",
        "top_pattern_this_week": {
            "tag": failed[0].error_types[0] if failed and failed[0].error_types else "logic_error",
            "title": "Most recent failure pattern",
            "new_occurrences": len(failed),
        },
        "wins": [item.problem_slug for item in accepted],
        "persistent_blindspots": [],
        "next_week_focus": [],
        "motivational_note": "Review the failures that repeated this week before adding more volume.",
        "stats": {
            "total_submissions": len(submissions),
            "failed": len(failed),
            "accepted": len(accepted),
            "revision_sessions_completed": 0,
            "new_patterns_found": 0,
            "patterns_resolved": len(accepted),
        },
    }
