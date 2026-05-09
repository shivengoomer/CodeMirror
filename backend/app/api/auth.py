from datetime import UTC, datetime
import logging

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
)
from app.core.database import get_db
from app.models.leetcode_session import LeetCodeSession
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    AuthResponse,
    LeetCodeSessionSyncRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.user import UserResponse
from app.schemas.user import UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:

    result = await db.execute(
        select(User).where(User.email == payload.email.lower())
    )

    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email is already registered",
        )

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        leetcode_username=payload.leetcode_username,
        gfg_username=payload.gfg_username,
        hackerrank_username=payload.hackerrank_username,
        timezone=payload.timezone,
        available_minutes_per_day=payload.available_minutes_per_day,
        last_active=datetime.now(UTC),
    )

    db.add(user)

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(db, user.id)

    await db.commit()

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:

    result = await db.execute(
        select(User).where(User.email == payload.email.lower())
    )

    user = result.scalar_one_or_none()

    if not user or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user.last_active = datetime.now(UTC)

    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(db, user.id)

    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:

    new_refresh_token, user_id = await rotate_refresh_token(
        db,
        payload.refresh_token,
    )

    await db.commit()

    return AccessTokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=new_refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:

    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if payload.leetcode_username is not None:
        current_user.leetcode_username = payload.leetcode_username or None
    if payload.gfg_username is not None:
        current_user.gfg_username = payload.gfg_username or None
    if payload.hackerrank_username is not None:
        current_user.hackerrank_username = payload.hackerrank_username or None
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    if payload.available_minutes_per_day is not None:
        current_user.available_minutes_per_day = payload.available_minutes_per_day
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await revoke_refresh_token(db, payload.refresh_token)
    await db.commit()
    return {"message": "Logged out"}


@router.post("/leetcode-session")
async def sync_leetcode_session(
    payload: LeetCodeSessionSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    headers = payload.leetcode_headers or {}
    row_result = await db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id))
    row = row_result.scalar_one_or_none()
    if row is None:
        row = LeetCodeSession(user_id=current_user.id)
        db.add(row)

    row.leetcode_session = payload.leetcode_session
    row.leetcode_csrf = payload.leetcode_csrf
    row.leetcode_headers = headers
    row.updated_at = datetime.now(UTC)
    await db.commit()

    cookie_header = headers.get("Cookie", "")

    has_session_cookie = "LEETCODE_SESSION=" in cookie_header
    has_csrf_cookie = "csrftoken=" in cookie_header
    has_csrf_header = "x-csrftoken" in headers

    response_data = {
        "status": "ok",
        "user_id": str(current_user.id),
        "received": {
            "has_leetcode_session": bool(payload.leetcode_session) or has_session_cookie,
            "has_csrftoken": bool(payload.leetcode_csrf) or has_csrf_cookie,
            "has_x_csrftoken_header": has_csrf_header,
            "has_user_agent_header": "User-Agent" in headers,
            "has_referer_header": "Referer" in headers,
            "has_content_type_header": "Content-Type" in headers,
        },
    }
    logger.info("got user cookies data for %s", current_user.id)
    return response_data
