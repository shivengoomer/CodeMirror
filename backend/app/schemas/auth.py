from pydantic import BaseModel, Field

from app.schemas.user import UserCreate, UserResponse


class LoginRequest(BaseModel):
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=255)


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class AuthResponse(AccessTokenResponse):
    refresh_token: str
    user: UserResponse


class RegisterRequest(UserCreate):
    pass


class LeetCodeSessionSyncRequest(BaseModel):
    leetcode_session: str | None = None
    leetcode_csrf: str | None = None
    leetcode_headers: dict[str, str] | None = None
