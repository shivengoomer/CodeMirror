import json
from typing import Any

from groq import AsyncGroq

from app.config import get_settings


class LLMUnavailableError(RuntimeError):
    pass


async def complete_json(messages: list[dict[str, str]], config: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.groq_api_key:
        raise LLMUnavailableError("GROQ_API_KEY is not configured")

    client = AsyncGroq(api_key=settings.groq_api_key)
    response = await client.chat.completions.create(
        messages=messages,
        model=settings.groq_model or config["model"],
        temperature=config["temperature"],
        max_tokens=config["max_tokens"],
        response_format=config["response_format"],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)
