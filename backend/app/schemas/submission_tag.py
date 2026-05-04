from uuid import UUID

from pydantic import BaseModel

from app.models.enums import SubmissionTagRole
from app.schemas.common import ORMModel


class SubmissionTagBase(BaseModel):
    submission_id: UUID
    pattern_id: UUID
    role: SubmissionTagRole


class SubmissionTagCreate(SubmissionTagBase):
    pass


class SubmissionTagResponse(SubmissionTagBase, ORMModel):
    pass
