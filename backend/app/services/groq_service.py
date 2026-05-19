"""Compatibility facade for legacy Groq service imports used by routes/tests."""

from typing import Any

from app.services.groq.client import GroqClient


def healthcheck() -> dict[str, str]:
    client = GroqClient()
    return {"status": "ok" if client.api_key else "disabled"}


async def detect_recurrence(
    payload: dict[str, Any],
    known_patterns: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {"is_recurring": False, "matched_pattern_ids": [], "role_by_pattern_id": {}}


async def plan_revision_session(payload: dict[str, Any]) -> dict[str, Any]:
    return {"plan": "No AI revision plan generated.", "items": []}


async def run_pattern_aggregation(payload: dict[str, Any]) -> None:
    return None
