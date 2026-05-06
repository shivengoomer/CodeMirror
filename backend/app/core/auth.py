import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User

try:
    from jose import JWTError, jwt
except ModuleNotFoundError:
    JWTError = ValueError
    jwt = None

try:
    from passlib.context import CryptContext
except ModuleNotFoundError:
    CryptContext = None

pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12, deprecated="auto") if CryptContext is not None else None
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    if pwd_context is not None:
        return pwd_context.hash(password)
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    if pwd_context is not None and not password_hash.startswith("pbkdf2_sha256$"):
        return pwd_context.verify(password, password_hash)
    try:
        _, salt, digest = password_hash.split("$", 2)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return hmac.compare_digest(candidate, digest)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _json_default(value: object) -> object:
    if isinstance(value, datetime):
        return int(value.timestamp())
    return str(value)


def _encode_jwt(payload: dict[str, object], secret: str) -> str:
    if jwt is not None:
        return jwt.encode(payload, secret, algorithm="HS256")
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    encoded_payload = _b64url_encode(json.dumps(payload, default=_json_default, separators=(",", ":")).encode())
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64url_encode(signature)}"


def _decode_jwt(token: str, secret: str) -> dict[str, object]:
    if jwt is not None:
        return jwt.decode(token, secret, algorithms=["HS256"])
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}".encode()
        expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        actual = _b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected, actual):
            raise ValueError("Invalid signature")
        payload = json.loads(_b64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid token") from exc
    exp = payload.get("exp")
    if isinstance(exp, int | float) and datetime.fromtimestamp(exp, tz=UTC) <= datetime.now(UTC):
        raise ValueError("Expired token")
    return payload


def _create_token(subject: UUID, secret: str, expires_delta: timedelta, token_type: str, jti: str | None = None) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if jti is not None:
        payload["jti"] = jti
    return _encode_jwt(payload, secret)


def create_access_token(user_id: UUID) -> str:
    settings = get_settings()
    return _create_token(
        user_id,
        settings.jwt_secret,
        timedelta(minutes=settings.access_token_expire_minutes),
        "access",
    )


async def create_refresh_token(db: AsyncSession, user_id: UUID) -> str:
    settings = get_settings()
    jti = uuid4().hex
    expires_delta = timedelta(days=settings.refresh_token_expire_days)
    token = _create_token(user_id, settings.jwt_refresh_secret, expires_delta, "refresh", jti)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_jti=jti,
            expires_at=datetime.now(UTC) + expires_delta,
        )
    )
    await db.flush()
    return token


def decode_access_token(token: str) -> UUID:
    settings = get_settings()
    try:
        payload = _decode_jwt(token, settings.jwt_secret)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc
    if payload.get("type") != "access" or payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    return UUID(payload["sub"])


async def validate_refresh_token(db: AsyncSession, token: str) -> UUID:
    settings = get_settings()
    try:
        payload = _decode_jwt(token, settings.jwt_refresh_secret)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if payload.get("type") != "refresh" or payload.get("sub") is None or payload.get("jti") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(RefreshToken).where(RefreshToken.token_jti == payload["jti"]))
    stored_token = result.scalar_one_or_none()
    if stored_token is None or stored_token.revoked_at is not None or stored_token.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is not active")

    return UUID(payload["sub"])


async def rotate_refresh_token(db: AsyncSession, token: str) -> tuple[str, UUID]:
    settings = get_settings()
    try:
        payload = _decode_jwt(token, settings.jwt_refresh_secret)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if payload.get("type") != "refresh" or payload.get("sub") is None or payload.get("jti") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(RefreshToken).where(RefreshToken.token_jti == payload["jti"]))
    stored_token = result.scalar_one_or_none()
    if stored_token is None or stored_token.revoked_at is not None or stored_token.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is not active")

    stored_token.revoked_at = datetime.now(UTC)
    user_id = UUID(payload["sub"])
    new_refresh = await create_refresh_token(db, user_id)
    return new_refresh, user_id


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    user_id = decode_access_token(token)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
