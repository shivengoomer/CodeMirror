from pydantic import BaseModel, Field

from app.schemas.user import UserCreate, UserResponse


class LoginRequest(BaseModel):
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=255)


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
