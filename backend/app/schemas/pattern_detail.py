from pydantic import BaseModel

from app.schemas.pattern import PatternResponse
from app.schemas.submission import SubmissionOut


class PatternDetailResponse(BaseModel):
    pattern: PatternResponse
    submissions: list[SubmissionOut]
