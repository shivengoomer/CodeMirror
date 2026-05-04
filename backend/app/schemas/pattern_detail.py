from pydantic import BaseModel

from app.schemas.pattern import PatternResponse
from app.schemas.submission import SubmissionResponse


class PatternDetailResponse(BaseModel):
    pattern: PatternResponse
    submissions: list[SubmissionResponse]
