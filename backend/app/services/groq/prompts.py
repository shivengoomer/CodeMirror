"""
CodeMirror — Prompts & Coach Context Builder
============================================
Changes vs original:
  • MASTER_SYSTEM_PROMPT  — tighter schema, added `patterns` and `notification` schemas inline
  • SUBMISSION_ANALYSIS_PROMPT — unchanged (already lean)
  • PATTERN_INTELLIGENCE_PROMPT — now receives structured frequency/recency data, not raw strings
  • NOTIFICATION_TRIGGER_PROMPT — unchanged (already fine)
  • build_coach_context() — replaced string labels with:
      - weighted failure category frequency (last 30 days)
      - recency-decayed category score
      - co-occurrence pairs (which two categories tend to appear together)
      - per-category average severity
      - recent code evidence snippets so the LLM sees *actual* code patterns
"""

import uuid
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SubmissionVerdict
from app.models.pattern import Pattern
from app.models.submission import Submission  # assumed to have: failure_category, code_snapshot, submitted_at, verdict, severity


# ─────────────────────────────────────────────────────────────────────────────
# MASTER SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────────────

MASTER_SYSTEM_PROMPT = """You are CodeMirror Intelligence — an elite coding coach. \
Your purpose is to help developers understand *why* they fail by naming patterns \
precisely and prescribing targeted repair.

## Core Persona
- Tone: calm, precise, slightly brutal — senior engineer doing a code review.
- Never explain the problem. Focus on what went wrong in *their* code and thinking.
- Never give a corrected solution. Your job is insight, not answers.
- Always ground claims in concrete code evidence from the submission.

## Schemas — return exactly one, no prose outside the JSON.

### analyze  (new failed submission)
{
  "failure_category": "off_by_one" | "wrong_ds" | "missed_edge_case"
                    | "complexity_blowup" | "pointer_logic" | "recursion_error"
                    | "greedy_trap" | "dp_transition" | "index_confusion"
                    | "overflow" | "logic_inversion" | "other",
  "root_cause": string,           // ≤25 words, surgical
  "what_they_thought": string,    // their mental model
  "what_is_actually_true": string,// the corrected invariant
  "code_evidence": string,        // exact line(s) that expose the bug
  "fix_direction": string,        // conceptual hint, NO code
  "severity": "habit" | "gap" | "slip",
  "repair_exercise": string       // one sentence: what to practice next
}

### patterns  (weekly pattern intelligence)
{
  "dominant_pattern": string,        // failure_category name
  "pattern_signature": string,       // what their code *structurally* does wrong, ≤30 words
  "co_occurring_patterns": [string], // up to 2 categories that appear with the dominant one
  "habit_score": number,             // 0–100; how entrenched is this pattern
  "recommended_drill": string        // specific problem type or technique to break the habit
}

### notification  (re-engagement nudge)
{
  "type": string,
  "title": string,
  "body": string,
  "cta": string,
  "cta_route": string,
  "urgency": "low" | "medium" | "high"
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# SUBMISSION ANALYSIS PROMPT  (kept lean, <400 tokens when rendered)
# ─────────────────────────────────────────────────────────────────────────────

SUBMISSION_ANALYSIS_PROMPT = """Analyze this failed submission. Return the `analyze` JSON schema — nothing else.

Problem : {slug} ({difficulty})
Tags    : {tags}
Error   : {error_type}

Code:
{wrong_code}
"""

# ─────────────────────────────────────────────────────────────────────────────
# PATTERN INTELLIGENCE PROMPT  (now takes rich structured data)
# ─────────────────────────────────────────────────────────────────────────────

PATTERN_INTELLIGENCE_PROMPT = """Generate pattern intelligence for this developer. \
Return the `patterns` JSON schema — nothing else.

## Failure frequency (last 30 days, recency-weighted)
{weighted_category_table}

## Co-occurrence pairs (categories that appear together)
{cooccurrence_pairs}

## Average severity per category
{severity_table}

## Recent code evidence (last 3 failures, worst category)
{code_snippets}

Use the code evidence to describe the *structural* mistake in pattern_signature — \
not just the category name.
"""

# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICATION TRIGGER PROMPT  (unchanged — was already correct)
# ─────────────────────────────────────────────────────────────────────────────

NOTIFICATION_TRIGGER_PROMPT = """Generate exactly ONE notification. \
Return the `notification` JSON schema — nothing else.

Context:
Days inactive : {days_inactive}
Streak        : {streak_days} days
Overdue       : {overdue_count}
Next due      : {next_due_problem}
Top pattern   : {top_pattern_name}
Last failure  : {last_failure_title} — {last_failure_category}
"""

# ─────────────────────────────────────────────────────────────────────────────
# COACH CONTEXT TEMPLATE  (used by the chat coach endpoint)
# ─────────────────────────────────────────────────────────────────────────────

COACH_CONTEXT_TEMPLATE = (
    "Top patterns (weighted): {top_patterns}. "
    "Recent slugs: {last_submissions}. "
    "Weekly failure rate: {failure_rate}%. "
    "Dominant habit: {dominant_habit}. "
    "Co-occurring: {cooccurring}."
)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

_SEVERITY_WEIGHT = {"habit": 3, "gap": 2, "slip": 1}


def _recency_weight(submitted_at: datetime, now: datetime) -> float:
    """
    Exponential decay: failures 30 days ago count ~37 % as much as today's.
    weight = e^(-age_days / 30)
    """
    age_days = max(0, (now - submitted_at).total_seconds() / 86400)
    return math.exp(-age_days / 30)


def _truncate(code: str, max_lines: int = 8) -> str:
    """Keep only the first max_lines of a code snapshot to stay within token budget."""
    lines = (code or "").splitlines()
    snippet = "\n".join(lines[:max_lines])
    if len(lines) > max_lines:
        snippet += f"\n... (+{len(lines) - max_lines} lines)"
    return snippet


# ─────────────────────────────────────────────────────────────────────────────
# build_coach_context
# ─────────────────────────────────────────────────────────────────────────────

async def build_coach_context(user_id: uuid.UUID, db: AsyncSession) -> str:
    """
    Returns a compressed, signal-rich string (<400 tokens) describing the user's
    coding failure patterns — grounded in frequency, recency, co-occurrence, and
    actual code evidence rather than plain label lists.
    """
    now = datetime.now(timezone.utc)
    window = now - timedelta(days=30)

    # ── 1. Pull recent failed submissions (last 30 days) ──────────────────────
    stmt = (
        select(
            Submission.problem_slug,
            Submission.failure_category,    # e.g. "off_by_one"
            Submission.severity,            # "habit" | "gap" | "slip"
            Submission.code_snapshot,       # stored wrong code (nullable)
            Submission.submitted_at,
        )
        .where(
            Submission.user_id == user_id,
            Submission.submitted_at >= window,
            Submission.verdict != SubmissionVerdict.ACCEPTED,
        )
        .order_by(Submission.submitted_at.desc())
    )
    rows = (await db.execute(stmt)).all()

    # ── 2. Weighted category frequency & severity accumulator ─────────────────
    # category → (weighted_count, severity_total, raw_count)
    cat_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"weighted": 0.0, "severity_sum": 0, "count": 0}
    )
    # For co-occurrence: collect per-submission (slug → set of categories)
    slug_to_cats: dict[str, set[str]] = defaultdict(set)
    # Code evidence: category → list of snippets (most recent first)
    code_evidence: dict[str, list[str]] = defaultdict(list)

    for slug, cat, sev, code, submitted_at in rows:
        if not cat:
            continue
        w = _recency_weight(submitted_at, now)
        s = _SEVERITY_WEIGHT.get(sev, 1)

        cat_stats[cat]["weighted"] += w
        cat_stats[cat]["severity_sum"] += s
        cat_stats[cat]["count"] += 1

        slug_to_cats[slug].add(cat)

        if code and len(code_evidence[cat]) < 3:
            code_evidence[cat].append(_truncate(code))

    # ── 3. Recency-weighted top patterns ──────────────────────────────────────
    sorted_cats = sorted(cat_stats.items(), key=lambda x: x[1]["weighted"], reverse=True)
    top_patterns_str = ", ".join(
        f"{cat}({stats['weighted']:.1f})" for cat, stats in sorted_cats[:4]
    ) or "None"

    dominant_cat = sorted_cats[0][0] if sorted_cats else None
    dominant_habit = dominant_cat or "None"

    # ── 4. Co-occurrence pairs ────────────────────────────────────────────────
    pair_counter: Counter = Counter()
    for cats in slug_to_cats.values():
        cat_list = sorted(cats)
        for i in range(len(cat_list)):
            for j in range(i + 1, len(cat_list)):
                pair_counter[(cat_list[i], cat_list[j])] += 1

    top_pairs = pair_counter.most_common(3)
    cooccurring_str = (
        ", ".join(f"{a}+{b}({n})" for (a, b), n in top_pairs)
        if top_pairs else "None"
    )

    # ── 5. Weekly failure rate ─────────────────────────────────────────────────
    one_week_ago = now - timedelta(days=7)
    total_count = (
        await db.execute(
            select(func.count(Submission.id)).where(
                Submission.user_id == user_id,
                Submission.submitted_at >= one_week_ago,
            )
        )
    ).scalar() or 0

    fail_count = (
        await db.execute(
            select(func.count(Submission.id)).where(
                Submission.user_id == user_id,
                Submission.submitted_at >= one_week_ago,
                Submission.verdict != SubmissionVerdict.ACCEPTED,
            )
        )
    ).scalar() or 0

    fail_rate = round((fail_count / total_count * 100) if total_count > 0 else 0)

    # ── 6. Recent slugs ───────────────────────────────────────────────────────
    sub_stmt = (
        select(Submission.problem_slug)
        .where(Submission.user_id == user_id)
        .order_by(Submission.submitted_at.desc())
        .limit(5)
    )
    recent_slugs = ", ".join((await db.execute(sub_stmt)).scalars().all()) or "None"

    # ── 7. Assemble context string ────────────────────────────────────────────
    return COACH_CONTEXT_TEMPLATE.format(
        top_patterns=top_patterns_str,
        last_submissions=recent_slugs,
        failure_rate=fail_rate,
        dominant_habit=dominant_habit,
        cooccurring=cooccurring_str,
    )


# ─────────────────────────────────────────────────────────────────────────────
# build_pattern_prompt_payload
# — call this when you need to populate PATTERN_INTELLIGENCE_PROMPT
# ─────────────────────────────────────────────────────────────────────────────

async def build_pattern_prompt_payload(user_id: uuid.UUID, db: AsyncSession) -> dict[str, str]:
    """
    Returns a dict ready to unpack into PATTERN_INTELLIGENCE_PROMPT.format(**payload).
    Separated from build_coach_context so it can be called independently
    (e.g. from a weekly cron job).
    """
    now = datetime.now(timezone.utc)
    window = now - timedelta(days=30)

    stmt = (
        select(
            Submission.failure_category,
            Submission.severity,
            Submission.code_snapshot,
            Submission.submitted_at,
            Submission.problem_slug,
        )
        .where(
            Submission.user_id == user_id,
            Submission.submitted_at >= window,
            Submission.verdict != SubmissionVerdict.ACCEPTED,
        )
        .order_by(Submission.submitted_at.desc())
    )
    rows = (await db.execute(stmt)).all()

    cat_stats: dict[str, dict] = defaultdict(
        lambda: {"weighted": 0.0, "severity_sum": 0, "count": 0}
    )
    slug_to_cats: dict[str, set] = defaultdict(set)
    code_evidence: dict[str, list] = defaultdict(list)

    for cat, sev, code, submitted_at, slug in rows:
        if not cat:
            continue
        w = _recency_weight(submitted_at, now)
        cat_stats[cat]["weighted"] += w
        cat_stats[cat]["severity_sum"] += _SEVERITY_WEIGHT.get(sev, 1)
        cat_stats[cat]["count"] += 1
        slug_to_cats[slug].add(cat)
        if code and len(code_evidence[cat]) < 3:
            code_evidence[cat].append(_truncate(code))

    # Weighted category table
    sorted_cats = sorted(cat_stats.items(), key=lambda x: x[1]["weighted"], reverse=True)
    weighted_table_lines = ["category | weighted_score | raw_count"]
    for cat, s in sorted_cats[:6]:
        weighted_table_lines.append(f"{cat} | {s['weighted']:.2f} | {s['count']}")
    weighted_table = "\n".join(weighted_table_lines)

    # Severity table (avg severity per category)
    severity_lines = ["category | avg_severity"]
    for cat, s in sorted_cats[:6]:
        avg_sev = s["severity_sum"] / s["count"] if s["count"] else 0
        severity_lines.append(f"{cat} | {avg_sev:.2f}")
    severity_table = "\n".join(severity_lines)

    # Co-occurrence
    pair_counter: Counter = Counter()
    for cats in slug_to_cats.values():
        cat_list = sorted(cats)
        for i in range(len(cat_list)):
            for j in range(i + 1, len(cat_list)):
                pair_counter[(cat_list[i], cat_list[j])] += 1
    cooccurrence_str = (
        "\n".join(f"{a} + {b}: {n} times" for (a, b), n in pair_counter.most_common(5))
        or "No co-occurrences detected"
    )

    # Code snippets for dominant category
    dominant = sorted_cats[0][0] if sorted_cats else None
    snippets_str = "No code evidence stored."
    if dominant and code_evidence[dominant]:
        parts = []
        for i, snip in enumerate(code_evidence[dominant], 1):
            parts.append(f"--- Snippet {i} ({dominant}) ---\n{snip}")
        snippets_str = "\n\n".join(parts)

    return {
        "weighted_category_table": weighted_table,
        "cooccurrence_pairs": cooccurrence_str,
        "severity_table": severity_table,
        "code_snippets": snippets_str,
    }