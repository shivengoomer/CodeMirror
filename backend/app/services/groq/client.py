import json
import asyncio
from typing import Any
from groq import AsyncGroq
from app.core.config import get_settings

class GroqClient:
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.groq_api_key
        self.model = settings.groq_model or "llama-3.3-70b-versatile"
        self._client = None

    async def get_client(self) -> AsyncGroq:
        if not self._client:
            self._client = AsyncGroq(api_key=self.api_key)
        return self._client

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1024
    ) -> dict[str, Any]:
        if not self.api_key:
            return {}

        client = await self.get_client()
        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
                temperature=temperature,
            )
            content = response.choices[0].message.content or "{}"
            parsed = json.loads(content)
            
            # Track usage
            usage = response.usage
            return {
                "data": parsed,
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens
            }
        except Exception:
            return {"data": {}, "prompt_tokens": 0, "completion_tokens": 0}

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        if not self.api_key:
            return "Groq API key not configured."

        client = await self.get_client()
        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1024,
                temperature=0.7,
            )
            return response.choices[0].message.content or ""
        except Exception:
            return "Error communicating with Groq."
