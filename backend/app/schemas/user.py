from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class UserBase(BaseModel):
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    leetcode_username: str | None = Field(default=None, max_length=100)
    gfg_username: str | None = Field(default=None, max_length=100)
    hackerrank_username: str | None = Field(default=None, max_length=100)
    timezone: str = Field(default="UTC", max_length=50)
    available_minutes_per_day: int | None = Field(default=None, ge=0)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=255)


class UserUpdate(BaseModel):
    leetcode_username: str | None = Field(default=None, max_length=100)
    gfg_username: str | None = Field(default=None, max_length=100)
    hackerrank_username: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=50)
    available_minutes_per_day: int | None = Field(default=None, ge=0)


class UserResponse(UserBase, ORMModel):
    id: UUID
    created_at: datetime
    last_active: datetime
