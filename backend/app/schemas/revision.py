from typing import Any

from pydantic import BaseModel, Field

from app.schemas.revision_queue import RevisionQueueItemResponse


class RevisionCompleteRequest(BaseModel):
    quality: int = Field(ge=0, le=5)
    last_verdict: str | None = Field(default=None, max_length=50)


class RevisionSessionResponse(BaseModel):
    items: list[RevisionQueueItemResponse]
    plan: dict[str, Any]
