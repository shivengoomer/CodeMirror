import json
from typing import Any

from app.core.config import get_settings
from app.prompts import BE_1_PROMPT, BE_2_PROMPT, BE_3_PROMPT, DASH_1_PROMPT, DASH_3_PROMPT, EXT_1_PROMPT, EXT_2_PROMPT


class GroqService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: Any | None = None

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

    async def detect_recurrence(self, submission: dict[str, Any], known_patterns: list[dict[str, Any]]) -> dict[str, Any]:
        return await self._complete_json(EXT_1_PROMPT, {"submission": submission, "known_patterns": known_patterns}, "EXT-1")

    async def build_overlay_copy(self, recurrence: dict[str, Any], submission: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(EXT_2_PROMPT, {**recurrence, "submission": submission}, "EXT-2")

    async def run_pattern_aggregation(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(BE_1_PROMPT, payload, "BE-1")

    async def plan_revision_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(BE_2_PROMPT, payload, "BE-2")

    async def build_weekly_digest(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(BE_3_PROMPT, payload, "BE-3")

    async def explain_dashboard_pattern(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(DASH_1_PROMPT, payload, "DASH-1")

    async def compare_dashboard_patterns(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._complete_json(DASH_3_PROMPT, payload, "DASH-3")


groq_service = GroqService()
