import json
from asyncio import Lock
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings
from app.prompts import BE_1_PROMPT, BE_2_PROMPT, BE_3_PROMPT, DASH_1_PROMPT, DASH_3_PROMPT, EXT_1_PROMPT, EXT_2_PROMPT


class GroqService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: Any | None = None
        self._pending_requests = 0
        self._pending_lock = Lock()
        self._last_recurrence_cache: dict[str, dict[str, Any]] = {}

    def _fallback(self, prompt_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        if prompt_name == "EXT-1":
            patterns = payload.get("known_patterns", [])
            return {
                "is_recurring": False,
                "matched_pattern_ids": [],
                "primary_pattern_id": patterns[0]["id"] if patterns else None,
                "role_by_pattern_id": {},
                "confidence": 0.0,
                "summary": "No recurring pattern detected yet.",
            }
        if prompt_name == "EXT-2":
            return {
                "title": "Recurring pattern noticed",
                "message": "This failure resembles an earlier mistake pattern. Review the linked dashboard pattern when you are ready.",
                "confidence": payload.get("confidence", 0.0),
                "pattern_id": payload.get("primary_pattern_id"),
            }
        if prompt_name == "BE-2":
            return {
                "items": payload.get("due_items", []),
                "focus": "Review due problems with the highest-impact linked patterns first.",
                "estimated_minutes": 30,
            }
        return {}

    async def _complete_json(self, system_prompt: str, payload: dict[str, Any], prompt_name: str) -> dict[str, Any]:
        if not self.settings.groq_api_key:
            return self._fallback(prompt_name, payload)

        if self._client is None:
            from groq import AsyncGroq

            self._client = AsyncGroq(api_key=self.settings.groq_api_key)

        async with self._pending_lock:
            self._pending_requests += 1
        try:
            retries = 3
            for attempt in range(retries):
                try:
                    response = await self._client.chat.completions.create(
                        model=self.settings.groq_model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": json.dumps(payload, default=str)},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                    )
                    content = response.choices[0].message.content or "{}"
                    return json.loads(content)
                except Exception:
                    if attempt == retries - 1:
                        raise
                    # Exponential backoff: 0.5s, 1s, then final attempt.
                    import asyncio

                    await asyncio.sleep(0.5 * (2**attempt))
            return {}
        finally:
            async with self._pending_lock:
                self._pending_requests -= 1

    async def detect_recurrence(self, submission: dict[str, Any], known_patterns: list[dict[str, Any]]) -> dict[str, Any]:
        cache_key = json.dumps(
            {
                "problem_slug": submission.get("problem_slug"),
                "verdict": submission.get("verdict"),
                "known_patterns": [pattern.get("id") for pattern in known_patterns],
            },
            sort_keys=True,
        )
        try:
            result = await self._complete_json(EXT_1_PROMPT, {"submission": submission, "known_patterns": known_patterns}, "EXT-1")
            self._last_recurrence_cache[cache_key] = result
            return result
        except Exception:
            cached = self._last_recurrence_cache.get(cache_key)
            if cached is not None:
                return cached
            return self._fallback("EXT-1", {"submission": submission, "known_patterns": known_patterns})

    async def build_overlay_copy(self, recurrence: dict[str, Any], submission: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(EXT_2_PROMPT, {**recurrence, "submission": submission}, "EXT-2")
        except Exception:
            return self._fallback("EXT-2", recurrence)

    async def run_pattern_aggregation(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(BE_1_PROMPT, payload, "BE-1")
        except Exception:
            return {}

    async def plan_revision_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(BE_2_PROMPT, payload, "BE-2")
        except Exception:
            return self._fallback("BE-2", payload)

    async def build_weekly_digest(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(BE_3_PROMPT, payload, "BE-3")
        except Exception:
            return {}

    async def explain_dashboard_pattern(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(DASH_1_PROMPT, payload, "DASH-1")
        except Exception:
            return {}

    async def compare_dashboard_patterns(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._complete_json(DASH_3_PROMPT, payload, "DASH-3")
        except Exception:
            return {}

    async def healthcheck(self) -> dict[str, str]:
        if not self.settings.groq_api_key:
            return {"status": "disabled", "detail": "GROQ_API_KEY not configured"}
        try:
            await self._complete_json(
                "Return JSON {\"ok\": true}.",
                {"ts": datetime.now(UTC).isoformat()},
                "health",
            )
            return {"status": "ok"}
        except Exception as exc:
            return {"status": "unreachable", "detail": str(exc)}

    async def wait_for_inflight(self, timeout_seconds: float = 10.0) -> None:
        import asyncio

        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            async with self._pending_lock:
                pending = self._pending_requests
            if pending == 0:
                return
            if asyncio.get_running_loop().time() >= deadline:
                return
            await asyncio.sleep(0.1)


groq_service = GroqService()
