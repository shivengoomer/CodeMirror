from typing import Any
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    current_view: str | None = None
    open_submission_title: str | None = None
    top_patterns: str | None = None
    weekly_submissions: int | None = 0
    weekly_failures: int | None = 0
    weekly_acs: int | None = 0
    revision_queue_count: int | None = 0

class ChatResponse(BaseModel):
    text: str
