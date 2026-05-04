from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedResponse(ORMModel):
    id: UUID
    created_at: datetime


class DateRange(BaseModel):
    week_start: date
    week_end: date
