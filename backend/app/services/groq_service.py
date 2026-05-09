import asyncio
import json
from asyncio import Lock
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings

EXT_1_SYSTEM = """
You are a coding mistake tagger embedded in a browser extension. You receive one failed
submission and return a structured JSON object. This runs in real-time — the user is waiting.

You are NOT a tutor. Never reveal the solution, algorithm, or correct approach.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences, no preamble.
2. Never hint at the correct solution in any field.
3. Keep all strings concise — overlay body max 25 words, description max 15 words.
4. Pick the most specific error_type first.
5. Set is_recurring = true only if submission matches one of the known_patterns provided.

ERROR TYPE TAXONOMY:
off_by_one | null_check_missing | empty_input_unhandled | wrong_base_case |
infinite_loop | wrong_data_structure | integer_overflow | wrong_traversal_order |
missed_edge_case | logic_error | tle_wrong_complexity | tle_constant_factor |
mle_large_allocation | compile_error_syntax | compile_error_type |
runtime_error_index | runtime_error_zerodiv | runtime_error_stack |
wrong_return_type | output_format_mismatch

OUTPUT SCHEMA (return exactly this):
{
  "error_types": ["<primary>", "<secondary_if_applicable>"],
  "concepts": ["<concept1>", "<concept2>"],
  "description": "<what went wrong, max 15 words>",
  "confidence": <float 0.0-1.0>,
  "severity": "<low|medium|high>",
  "is_recurring": <true|false>,
  "matched_pattern_ids": [],
  "overlay": {
    "headline": "<max 8 words>",
    "body": "<max 25 words, no solution hint>",
    "call_to_action": "<max 15 words, self-reflection question>",
    "badge_label": "<2-3 words>"
  }
}
"""

BE_1_SYSTEM = """
You are a pattern recognition engine for a competitive programming coaching tool.
You receive a batch of failed submissions from one user and identify deep recurring
mistake patterns.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences.
2. A pattern is only worth flagging if it appears in 2+ submissions.
3. The insight field names the underlying gap, not the symptom. Write directly to user.
4. Do not duplicate patterns already in existing_patterns — update occurrence counts.
5. Rank by impact.

OUTPUT SCHEMA:
{
  "patterns": [{
    "id": "<existing id or null>",
    "tag": "<error_type>",
    "concept_cluster": ["<concept>"],
    "title": "<max 6 words>",
    "insight": "<max 25 words, to user directly>",
    "evidence": ["<problem_slug>"],
    "occurrence_count": <int>,
    "confidence": <float>,
    "impact": "<low|medium|high|critical>",
    "suggested_revision_interval_days": <1|3|7|14|30>
  }],
  "noise": ["<problem_slug>"],
  "summary": "<2-3 sentences, biggest takeaway, no solution hints>"
}
"""


class GroqService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: Any | None = None
        self._pending_requests = 0
        self._pending_lock = Lock()

    async def _get_client(self) -> Any | None:
        if not self.settings.groq_api_key:
            return None
        if self._client is None:
            from groq import AsyncGroq

            self._client = AsyncGroq(api_key=self.settings.groq_api_key)
        return self._client

    async def _complete_json(
        self,
        *,
        system_prompt: str,
        payload: dict[str, Any],
        temperature: float,
        max_tokens: int,
        fallback: dict[str, Any],
        retry_429_once: bool,
    ) -> dict[str, Any]:
        client = await self._get_client()
        if client is None:
            return fallback

        async with self._pending_lock:
            self._pending_requests += 1
        try:
            attempts = 2 if retry_429_once else 1
            for attempt in range(attempts):
                try:
                    response = await client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": json.dumps(payload, default=str)},
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=max_tokens,
                        temperature=temperature,
                    )
                    content = response.choices[0].message.content or "{}"
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        return parsed
                    return fallback
                except Exception as exc:
                    if retry_429_once and attempt == 0 and "429" in str(exc):
                        await asyncio.sleep(2)
                        continue
                    return fallback
            return fallback
        finally:
            async with self._pending_lock:
                self._pending_requests -= 1

    async def run_ext1(self, submission: dict[str, Any], known_patterns: list[dict[str, Any]]) -> dict[str, Any]:
        try:
            fallback = {
                "error_types": [],
                "concepts": [],
                "description": "Analysis unavailable.",
                "confidence": 0.0,
                "severity": "low",
                "is_recurring": False,
                "matched_pattern_ids": [],
                "overlay": {
                    "headline": "Pattern check unavailable",
                    "body": "Saved your failed submission. Pattern tagging is temporarily unavailable.",
                    "call_to_action": "What assumption failed here?",
                    "badge_label": "Saved",
                },
            }
            return await self._complete_json(
                system_prompt=EXT_1_SYSTEM,
                payload={"submission": submission, "known_patterns": known_patterns},
                temperature=0.2,
                max_tokens=800,
                fallback=fallback,
                retry_429_once=True,
            )
        except Exception:
            return {
                "error_types": [],
                "concepts": [],
                "description": "Analysis unavailable.",
                "confidence": 0.0,
                "severity": "low",
                "is_recurring": False,
                "matched_pattern_ids": [],
                "overlay": {
                    "headline": "Pattern check unavailable",
                    "body": "Saved your failed submission. Pattern tagging is temporarily unavailable.",
                    "call_to_action": "What assumption failed here?",
                    "badge_label": "Saved",
                },
            }

    async def detect_recurrence(
        self, payload: dict[str, Any], known_patterns: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """Backward-compatible alias used by older tests/routes."""
        result = await self.run_ext1(payload, known_patterns or [])
        return {
            "is_recurring": bool(result.get("is_recurring", False)),
            "matched_pattern_ids": result.get("matched_pattern_ids", []),
            "role_by_pattern_id": result.get("role_by_pattern_id", {}),
            "overlay": result.get("overlay", {}),
            "error_types": result.get("error_types", []),
            "concepts": result.get("concepts", []),
        }

    async def run_be1(self, submissions: list[dict[str, Any]], existing_patterns: list[dict[str, Any]]) -> dict[str, Any]:
        try:
            return await self._complete_json(
                system_prompt=BE_1_SYSTEM,
                payload={"submissions": submissions, "existing_patterns": existing_patterns},
                temperature=0.1,
                max_tokens=1500,
                fallback={"patterns": [], "noise": [], "summary": ""},
                retry_429_once=False,
            )
        except Exception:
            return {"patterns": [], "noise": [], "summary": ""}

    async def run_pattern_aggregation(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Backward-compatible alias used by older tests/routes."""
        submissions = payload.get("submissions", [])
        existing_patterns = payload.get("existing_patterns", [])
        if not isinstance(submissions, list):
            submissions = []
        if not isinstance(existing_patterns, list):
            existing_patterns = []
        return await self.run_be1(submissions, existing_patterns)

    async def plan_revision_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            due_items = payload.get("due_items", [])
            if not isinstance(due_items, list):
                due_items = []
            return {
                "items": due_items,
                "focus": "Review recurring mistakes first.",
                "estimated_minutes": 30,
            }
        except Exception:
            return {"items": [], "focus": "Review recurring mistakes first.", "estimated_minutes": 30}

    async def build_weekly_digest(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            _ = payload
            return {"highlights": [], "message": "Digest unavailable."}
        except Exception:
            return {"highlights": [], "message": "Digest unavailable."}

    async def healthcheck(self) -> dict[str, str]:
        try:
            if not self.settings.groq_api_key:
                return {"status": "disabled", "detail": "GROQ_API_KEY not configured"}
            result = await self._complete_json(
                system_prompt='Return JSON {"ok": true}.',
                payload={"ts": datetime.now(UTC).isoformat()},
                temperature=0.0,
                max_tokens=50,
                fallback={"ok": False},
                retry_429_once=False,
            )
            return {"status": "ok"} if result.get("ok") else {"status": "unreachable", "detail": "health probe failed"}
        except Exception:
            return {"status": "unreachable", "detail": "health probe failed"}

    async def wait_for_inflight(self, timeout_seconds: float = 10.0) -> None:
        try:
            deadline = asyncio.get_running_loop().time() + timeout_seconds
            while True:
                async with self._pending_lock:
                    pending = self._pending_requests
                if pending == 0:
                    return
                if asyncio.get_running_loop().time() >= deadline:
                    return
                await asyncio.sleep(0.1)
        except Exception:
            return


groq_service = GroqService()
