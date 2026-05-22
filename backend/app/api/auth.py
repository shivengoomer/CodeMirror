from datetime import UTC, datetime
import logging
from http.cookies import SimpleCookie

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import browser_fingerprint
from app.auth.token_manager import TokenManager
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
from app.models.auth_token import AuthToken
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    AuthResponse,
    LeetCodeSessionSyncRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.user import UserResponse, UserUpdate
from app.services.onboarding import OnboardingService
from app.auth.oauth import build_leetcode_activation_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
_leetcode_cookie_debug_logged = False


# ── helpers ──────────────────────────────────────────────────────────────────

async def _authenticate(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    user.last_active = datetime.now(UTC)
    return user


async def _issue_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(db, user.id)
    await db.commit()
    await db.refresh(user)
    return access_token, refresh_token


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    return bool(await db.scalar(text("SELECT to_regclass(:table_name)"), {"table_name": f"public.{table_name}"}))


def _redact_secret(value: str | None) -> str:
    if not value:
        return "missing"
    if len(value) <= 12:
        return f"present(len={len(value)})"
    return f"{value[:6]}...{value[-6:]}(len={len(value)})"


def _redact_cookie_header(cookie: str) -> str:
    if not cookie:
        return "missing"
    safe = cookie
    for name in ("LEETCODE_SESSION", "csrftoken"):
        marker = f"{name}="
        if marker not in safe:
            continue
        parts = safe.split(marker, 1)
        before = parts[0]
        value_and_rest = parts[1]
        value, sep, rest = value_and_rest.partition(";")
        safe = f"{before}{marker}{_redact_secret(value)}{sep}{rest}"
    return safe


# ── routes ───────────────────────────────────────────────────────────────────

@router.post("/init")
async def init_leetcode_auth() -> dict[str, str]:
    return {
        "status": "activation_required",
        "login_url": build_leetcode_activation_url(),
        "message": "Login to LeetCode in the extension and POST captured cookies to /auth/leetcode-session.",
    }


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email is already registered")

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

    access_token, refresh_token = await _issue_tokens(db, user)
    return AuthResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await _authenticate(db, payload.email, payload.password)
    access_token, refresh_token = await _issue_tokens(db, user)
    return AuthResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.model_validate(user))


@router.post("/swagger-login", response_model=AccessTokenResponse, include_in_schema=False)
async def swagger_login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    user = await _authenticate(db, payload.email, payload.password)
    access_token, refresh_token = await _issue_tokens(db, user)
    return AccessTokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> AccessTokenResponse:
    new_refresh_token, user_id = await rotate_refresh_token(db, payload.refresh_token)
    await db.commit()
    return AccessTokenResponse(access_token=create_access_token(user_id), refresh_token=new_refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    updates = payload.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(current_user, field, value or None if field.endswith("_username") else value)
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await revoke_refresh_token(db, payload.refresh_token)
    await db.commit()
    return {"message": "Logged out"}


@router.post("/leetcode-session")
async def sync_leetcode_session(
    payload: LeetCodeSessionSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    global _leetcode_cookie_debug_logged

    headers = payload.leetcode_headers or {}
    cookie = headers.get("Cookie", "")
    parsed_cookie = SimpleCookie()
    if cookie:
        parsed_cookie.load(cookie)
    leetcode_session = payload.leetcode_session or (
        parsed_cookie["LEETCODE_SESSION"].value if "LEETCODE_SESSION" in parsed_cookie else None
    )
    leetcode_csrf = payload.leetcode_csrf or (
        parsed_cookie["csrftoken"].value if "csrftoken" in parsed_cookie else None
    )

    if leetcode_session:
        parts = leetcode_session.strip().split(".")
        if len(parts) == 3:
            try:
                import base64
                import json
                from fastapi import HTTPException
                payload_b64 = parts[1]
                payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                decoded_payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
                iss = decoded_payload.get("iss", "")
                if "clerk" in iss or "accounts.dev" in iss:
                    raise HTTPException(
                        status_code=400,
                        detail="The provided cookie appears to be a Clerk/dashboard token rather than a LeetCode session cookie. Please make sure you copy the LEETCODE_SESSION cookie from https://leetcode.com."
                    )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e

    if leetcode_session and not leetcode_csrf:
        from app.api.test import get_csrf
        leetcode_csrf = await get_csrf()
        if leetcode_csrf:
            if "Cookie" not in headers:
                headers["Cookie"] = f"LEETCODE_SESSION={leetcode_session}; csrftoken={leetcode_csrf}"
            else:
                if "csrftoken=" not in headers["Cookie"]:
                    headers["Cookie"] = f"{headers['Cookie'].rstrip(';')}; csrftoken={leetcode_csrf}"
            headers["x-csrftoken"] = leetcode_csrf

    if leetcode_session:
        from app.services.leetcode.client import LeetCodeClient
        client = LeetCodeClient(leetcode_session, leetcode_csrf, headers)
        if not await client.check_session_validity():
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="Invalid LeetCode session. The LeetCode server rejected this session cookie. Please make sure you copy the correct LEETCODE_SESSION cookie from https://leetcode.com and that you are logged in on LeetCode."
            )

    result = await db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == current_user.id))
    row = result.scalar_one_or_none() or LeetCodeSession(user_id=current_user.id)
    if row not in db.identity_map.values():
        db.add(row)

    row.leetcode_session = leetcode_session
    row.leetcode_csrf = leetcode_csrf
    row.leetcode_headers = headers
    row.updated_at = datetime.now(UTC)
    has_session = bool(leetcode_session)

    if not _leetcode_cookie_debug_logged:
        _leetcode_cookie_debug_logged = True
        logger.warning(
            "leetcode_cookie_capture_debug",
            extra={
                "user_id": str(current_user.id),
                "session": _redact_secret(leetcode_session),
                "csrf": _redact_secret(leetcode_csrf),
                "header_keys": sorted(headers.keys()),
                "cookie_header": _redact_cookie_header(cookie),
                "has_x_csrftoken_header": "x-csrftoken" in headers or "X-CSRFToken" in headers,
                "has_referer_header": "Referer" in headers or "referer" in headers,
                "has_user_agent_header": "User-Agent" in headers or "user-agent" in headers,
            },
        )

    if leetcode_session and await _table_exists(db, "auth_tokens"):
        token_manager = TokenManager()
        fingerprint = browser_fingerprint(headers.get("User-Agent"), headers.get("X-Forwarded-For"))
        existing_token = await db.scalar(
            select(AuthToken).where(AuthToken.user_id == current_user.id, AuthToken.browser_fingerprint == fingerprint)
        )
        auth_token = existing_token or AuthToken(
            user_id=current_user.id,
            browser_fingerprint=fingerprint,
            encrypted_session_token="",
        )
        auth_token.encrypted_session_token = token_manager.encrypt(leetcode_session)
        auth_token.csrf_token = leetcode_csrf
        auth_token.last_refreshed = datetime.now(UTC)
        auth_token.is_valid = True
        db.add(auth_token)

    await db.commit()

    logger.info("Synced LeetCode cookies for user %s", current_user.id)
    return {
        "status": "ok",
        "user_id": str(current_user.id),
        "needs_initial_sync": bool(has_session and not current_user.onboarding_complete),
        "received": {
            "has_leetcode_session": bool(payload.leetcode_session) or "LEETCODE_SESSION=" in cookie,
            "has_csrftoken": bool(leetcode_csrf),
            "has_x_csrftoken_header": "x-csrftoken" in headers,
            "has_user_agent_header": "User-Agent" in headers,
            "has_referer_header": "Referer" in headers,
            "has_content_type_header": "Content-Type" in headers,
        },
    }

from pydantic import BaseModel

class CookieRequest(BaseModel):
    username: str
    password: str

@router.post("/getCookies")
async def get_cookies(payload: CookieRequest, db: AsyncSession = Depends(get_db)):
        result = await db.execute(select(LeetCodeSession).limit(1))
        sess = result.scalar_one_or_none()
        if sess:
            logger.info("extracted_cookies session=%s csrf=%s", sess.leetcode_session, sess.leetcode_csrf)
            return {
                "LEETCODE_SESSION": sess.leetcode_session,
                "csrftoken": sess.leetcode_csrf,
                "headers": sess.leetcode_headers
            }
        return {"status": "error", "message": "No cookies found in database"}
