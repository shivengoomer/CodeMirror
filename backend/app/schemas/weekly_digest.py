from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMModel


class WeeklyDigestBase(BaseModel):
    week_start: date
    week_end: date
    digest_json: dict[str, Any]


class WeeklyDigestCreate(WeeklyDigestBase):
    pass


class WeeklyDigestResponse(WeeklyDigestBase, ORMModel):
    id: UUID
    user_id: UUID
    created_at: datetime
