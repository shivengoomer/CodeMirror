"""Prompt builders for backend Groq jobs.
These prompts run outside the browser hot path: background tasks, cron jobs,
and dashboard-triggered re-analysis.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict


ERROR_TYPES = (
    "off_by_one",
    "null_check_missing",
    "empty_input_unhandled",
    "wrong_base_case",
    "infinite_loop",
    "wrong_data_structure",
    "integer_overflow",
    "wrong_traversal_order",
    "missed_edge_case",
    "logic_error",
    "tle_wrong_complexity",
    "tle_constant_factor",
    "mle_large_allocation",
    "compile_error_syntax",
    "compile_error_type",
    "runtime_error_index",
    "runtime_error_zerodiv",
    "runtime_error_stack",
    "wrong_return_type",
    "output_format_mismatch",
)


ErrorType = Literal[
    "off_by_one",
    "null_check_missing",
    "empty_input_unhandled",
    "wrong_base_case",
    "infinite_loop",
    "wrong_data_structure",
    "integer_overflow",
    "wrong_traversal_order",
    "missed_edge_case",
    "logic_error",
    "tle_wrong_complexity",
    "tle_constant_factor",
    "mle_large_allocation",
    "compile_error_syntax",
    "compile_error_type",
    "runtime_error_index",
    "runtime_error_zerodiv",
    "runtime_error_stack",
    "wrong_return_type",
    "output_format_mismatch",
]
Impact = Literal["low", "medium", "high", "critical"]
Verdict = Literal[
    "accepted",
    "wrong_answer",
    "tle",
    "mle",
    "runtime_error",
    "compile_error",
]


class GroqConfig(TypedDict):
    model: str
    temperature: float
    max_tokens: int
    response_format: dict[str, str]


@dataclass(frozen=True)
class ChatPrompt:
    messages: list[dict[str, str]]
    groq_config: GroqConfig


@dataclass(frozen=True)
class TaggedSubmission:
    problem_title: str
    problem_slug: str
    platform: str
    verdict: Verdict
    error_types: list[ErrorType]
    concepts: list[str]
    description: str
    submitted_at: str


@dataclass(frozen=True)
class ExistingPattern:
    id: str
    tag: ErrorType
    title: str
    occurrence_count: int
    impact: Impact


@dataclass(frozen=True)
class BatchAnalysisInput:
    total_submissions: int
    platforms: list[str]
    languages: list[str]
    date_from: str
    date_to: str
    submissions: list[TaggedSubmission]
    existing_patterns: list[ExistingPattern]


@dataclass(frozen=True)
class ActivePattern:
    tag: ErrorType
    title: str
    impact: Impact
    concept_cluster: list[str]
    occurrence_count: int


@dataclass(frozen=True)
class RevisionQueueItem:
    problem_slug: str
    platform: str
    next_due: str
    interval_days: int
    ease_factor: float
    repetitions: int
    linked_pattern_tag: ErrorType | None
    last_verdict: Verdict
    days_overdue: int


@dataclass(frozen=True)
class RevisionScheduleInput:
    today_date: str
    patterns: list[ActivePattern]
    queue: list[RevisionQueueItem]
    available_minutes: int | None = None


@dataclass(frozen=True)
class WeeklySubmission:
    problem_slug: str
    platform: str
    verdict: Verdict
    error_types: list[ErrorType]


@dataclass(frozen=True)
class PatternChange:
    title: str
    prev_count: int
    new_count: int
    impact: Impact


@dataclass(frozen=True)
class WeeklyDigestInput:
    week_start: str
    week_end: str
    submissions: list[WeeklySubmission]
    pattern_changes: list[PatternChange]
    revision_sessions_done: int
    revision_sessions_scheduled: int
    problems_resolved: list[str]
    current_streak: int


BE1_GROQ_CONFIG: GroqConfig = {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.3,
    "max_tokens": 1500,
    "response_format": {"type": "json_object"},
}

BE2_GROQ_CONFIG: GroqConfig = {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.1,
    "max_tokens": 900,
    "response_format": {"type": "json_object"},
}

BE3_GROQ_CONFIG: GroqConfig = {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.5,
    "max_tokens": 1000,
    "response_format": {"type": "json_object"},
}


BE1_SYSTEM_PROMPT = """You are a pattern recognition engine for a competitive programming coaching tool. You receive a batch of failed submissions from one user and identify deep, recurring mistake patterns — the kind of blindspots a coach would flag after watching someone fail across many problems.

You are NOT a tutor. Never suggest solutions or explain algorithms. Your output is stored in a Postgres database and rendered in a dashboard UI.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences.
2. A pattern is only worth flagging if it appears in 2+ submissions. Single occurrences go in noise[].
3. Be specific — "Off-by-one on binary search right boundary" beats "off-by-one errors".
4. The insight field is most important — name the underlying gap, not just the symptom.
5. Do not duplicate patterns already in existing_patterns — instead update their occurrence counts.
6. Rank by impact: how much would fixing this improve their overall solve rate?

ERROR TYPE TAXONOMY:
off_by_one | null_check_missing | empty_input_unhandled | wrong_base_case |
infinite_loop | wrong_data_structure | integer_overflow | wrong_traversal_order |
missed_edge_case | logic_error | tle_wrong_complexity | tle_constant_factor |
mle_large_allocation | compile_error_syntax | compile_error_type |
runtime_error_index | runtime_error_zerodiv | runtime_error_stack |
wrong_return_type | output_format_mismatch

OUTPUT SCHEMA:
{
  "patterns": [
    {
      "id": "<existing id if updating, null if new>",
      "tag": "<error_type>",
      "concept_cluster": ["<concept1>", "<concept2>"],
      "title": "<max 6 words — specific pattern name>",
      "insight": "<the deep underlying gap, written to user directly, max 25 words>",
      "evidence": ["<problem_slug_1>", "<problem_slug_2>"],
      "occurrence_count": <int>,
      "confidence": <float 0.0-1.0>,
      "impact": "<low|medium|high|critical>",
      "suggested_revision_interval_days": <1|3|7|14|30>
    }
  ],
  "noise": ["<problem_slug>"],
  "weakest_concept": "<concept that causes most failures>",
  "strongest_concept": "<concept they handle best>",
  "summary": "<2-3 sentences to the user: biggest takeaway from this batch, no solution hints>"
}"""


BE2_SYSTEM_PROMPT = """You are a spaced repetition session planner for a competitive programming revision system. You receive a user's full revision queue and must return today's ranked practice session.

Ranking combines:
1. SM-2 state — problems due today by interval come first
2. Pattern impact — problems linked to critical/high patterns are prioritised
3. Concept diversity — avoid scheduling 5 problems of the same type in one session
4. Recency — very recently failed problems should appear sooner than SM-2 alone suggests

RULES:
1. Respond with JSON only.
2. Return max 8 problems per session — focused beats overwhelming.
3. If fewer than 3 are due today by SM-2, pull forward the highest-impact ones.
4. reason must be specific — say exactly why each problem is in today's session.
5. focus_hint must reference the user's known pattern for that problem — never hint at the solution.

OUTPUT SCHEMA:
{
  "todays_session": [
    {
      "problem_slug": "<slug>",
      "platform": "<platform>",
      "priority_rank": <1-based int>,
      "reason": "<why this is in today's session, max 15 words>",
      "focus_hint": "<what pattern to watch for, NO solution hint, max 12 words>",
      "estimated_minutes": <int>
    }
  ],
  "skipped_count": <int>,
  "next_session_preview": ["<slug1>", "<slug2>", "<slug3>"],
  "session_theme": "<1 short phrase, e.g. 'Tree boundary conditions' or 'Hash map edge cases'>"
}"""


BE3_SYSTEM_PROMPT = """You write a weekly coaching digest for a competitive programmer. You receive their full week of submission data, pattern updates, and revision activity. Write a structured summary that feels like a weekly debrief from a coach — not a generic report.

RULES:
1. Respond with JSON only.
2. Be specific — reference actual problem names and pattern tags from the data.
3. progress_note must be honest — if they made no progress, say so constructively.
4. Never hint at solutions.
5. next_week_focus must name specific concepts to target, based on their weakest patterns.

OUTPUT SCHEMA:
{
  "week_summary": "<2-3 sentences: what happened this week at a high level>",
  "progress_note": "<honest 1-2 sentences on whether patterns improved or worsened>",
  "top_pattern_this_week": {
    "tag": "<error_type>",
    "title": "<pattern title>",
    "new_occurrences": <int>
  },
  "wins": ["<problem_slug or concept where they showed improvement>"],
  "persistent_blindspots": ["<pattern title>"],
  "next_week_focus": ["<concept1>", "<concept2>"],
  "motivational_note": "<1 sentence, direct, coach-like, not generic>",
  "stats": {
    "total_submissions": <int>,
    "failed": <int>,
    "accepted": <int>,
    "revision_sessions_completed": <int>,
    "new_patterns_found": <int>,
    "patterns_resolved": <int>
  }
}"""


def build_be1_prompt(data: BatchAnalysisInput) -> ChatPrompt:
    return ChatPrompt(
        messages=[
            {"role": "system", "content": BE1_SYSTEM_PROMPT},
            {"role": "user", "content": build_be1_user_prompt(data)},
        ],
        groq_config=BE1_GROQ_CONFIG,
    )


def build_be2_prompt(data: RevisionScheduleInput) -> ChatPrompt:
    return ChatPrompt(
        messages=[
            {"role": "system", "content": BE2_SYSTEM_PROMPT},
            {"role": "user", "content": build_be2_user_prompt(data)},
        ],
        groq_config=BE2_GROQ_CONFIG,
    )


def build_be3_prompt(data: WeeklyDigestInput) -> ChatPrompt:
    return ChatPrompt(
        messages=[
            {"role": "system", "content": BE3_SYSTEM_PROMPT},
            {"role": "user", "content": build_be3_user_prompt(data)},
        ],
        groq_config=BE3_GROQ_CONFIG,
    )


def should_run_pattern_aggregation(total_user_failures: int) -> bool:
    return total_user_failures > 0 and total_user_failures % 5 == 0


def build_be1_user_prompt(data: BatchAnalysisInput) -> str:
    submissions = "\n".join(_format_tagged_submission(item) for item in data.submissions)
    existing_patterns = (
        "\n".join(_format_existing_pattern(pattern) for pattern in data.existing_patterns)
        if data.existing_patterns
        else "None yet."
    )

    return f"""USER BATCH ANALYSIS

User stats:
- Total failures analysed: {data.total_submissions}
- Platforms: {', '.join(data.platforms)}
- Languages: {', '.join(data.languages)}
- Date range: {data.date_from} → {data.date_to}

Recent submissions (last {len(data.submissions)}):
{submissions}

Existing confirmed patterns (do not duplicate, update counts instead):
{existing_patterns}

Return JSON only."""


def build_be2_user_prompt(data: RevisionScheduleInput) -> str:
    patterns = "\n".join(_format_active_pattern(pattern) for pattern in data.patterns)
    queue = "\n".join(_format_revision_item(item) for item in data.queue)
    available_minutes = (
        str(data.available_minutes) if data.available_minutes is not None else "not specified"
    )

    return f"""DAILY REVISION SESSION — {data.today_date}

User's active patterns (most impactful first):
{patterns}

Revision queue:
{queue}

Today: {data.today_date}
Available time: {available_minutes} minutes

Return JSON only."""


def build_be3_user_prompt(data: WeeklyDigestInput) -> str:
    submissions = "\n".join(
        _format_weekly_submission(submission) for submission in data.submissions
    )
    pattern_changes = "\n".join(
        _format_pattern_change(change) for change in data.pattern_changes
    )

    return f"""WEEKLY DIGEST — week of {data.week_start} to {data.week_end}

Submissions this week:
{submissions}

Pattern changes this week:
{pattern_changes}

Revision sessions completed: {data.revision_sessions_done} / {data.revision_sessions_scheduled}
Problems moved to accepted after revision: {', '.join(data.problems_resolved)}
Streak: {data.current_streak} days

Return JSON only."""


def _format_tagged_submission(item: TaggedSubmission) -> str:
    return f"""---
Problem: {item.problem_title} ({item.problem_slug}) — {item.platform}
Verdict: {item.verdict}
Tags: {', '.join(item.error_types)}
Concepts: {', '.join(item.concepts)}
Description: {item.description}
Date: {item.submitted_at}"""


def _format_existing_pattern(pattern: ExistingPattern) -> str:
    return (
        f"- id: {pattern.id} | tag: {pattern.tag} | title: {pattern.title} | "
        f"occurrences: {pattern.occurrence_count} | impact: {pattern.impact}"
    )


def _format_active_pattern(pattern: ActivePattern) -> str:
    return (
        f"- tag: {pattern.tag} | title: {pattern.title} | impact: {pattern.impact} | "
        f"concepts: {', '.join(pattern.concept_cluster)} | occurrences: {pattern.occurrence_count}"
    )


def _format_revision_item(item: RevisionQueueItem) -> str:
    linked_pattern = item.linked_pattern_tag or "none"
    return f"""- slug: {item.problem_slug}
  platform: {item.platform}
  next_due: {item.next_due}
  interval_days: {item.interval_days}
  ease_factor: {item.ease_factor}
  repetitions: {item.repetitions}
  linked_pattern: {linked_pattern}
  last_verdict: {item.last_verdict}
  days_overdue: {item.days_overdue}"""


def _format_weekly_submission(item: WeeklySubmission) -> str:
    return (
        f"- {item.problem_slug} | {item.platform} | {item.verdict} | "
        f"tags: {', '.join(item.error_types)}"
    )


def _format_pattern_change(change: PatternChange) -> str:
    return (
        f"- {change.title} | was: {change.prev_count} occurrences → "
        f"now: {change.new_count} | impact: {change.impact}"
    )
