from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, get_current_user, hash_password, validate_refresh_token, verify_password
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import AccessTokenResponse, AuthResponse, LoginRequest, RefreshRequest, RegisterRequest
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email is already registered")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        leetcode_username=payload.leetcode_username,
        gfg_username=payload.gfg_username,
        hackerrank_username=payload.hackerrank_username,
        timezone=payload.timezone,
        available_minutes_per_day=payload.available_minutes_per_day,
    )
    db.add(user)
    await db.flush()
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(db, user.id)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user.last_active = datetime.now(UTC)
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(db, user.id)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> AccessTokenResponse:
    user_id = await validate_refresh_token(db, payload.refresh_token)
    return AccessTokenResponse(access_token=create_access_token(user_id))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
