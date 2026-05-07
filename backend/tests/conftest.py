import asyncio
import time
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

@compiles(ARRAY, 'sqlite')
def compile_array(element, compiler, **kw):
    return "JSON"

@compiles(JSONB, 'sqlite')
def compile_jsonb(element, compiler, **kw):
    return "JSON"

from app.main import app
from app.core.database import Base, get_db
from app.services import groq_service
from app.core import rate_limit


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def engine(tmp_path_factory):
    path = tmp_path_factory.mktemp("data") / "test.db"
    database_url = f"sqlite+aiosqlite:///{path}"
    engine = create_async_engine(database_url, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def async_session(engine):
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    yield AsyncSessionLocal


@pytest.fixture
async def override_get_db(async_session):
    async def _get_test_db():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def client(override_get_db, monkeypatch):
    # Patch external services and rate limiter to deterministic no-ops
    monkeypatch.setattr(groq_service, "healthcheck", lambda: {"status": "disabled"})

    async def _detect_recurrence(payload, known_patterns=None):
        return {"is_recurring": False, "matched_pattern_ids": [], "role_by_pattern_id": {}}

    async def _plan_revision_session(payload):
        return {"plan": "ok"}

    async def _run_pattern_aggregation(payload):
        return None

    monkeypatch.setattr(groq_service, "detect_recurrence", _detect_recurrence)
    monkeypatch.setattr(groq_service, "plan_revision_session", _plan_revision_session)
    monkeypatch.setattr(groq_service, "run_pattern_aggregation", _run_pattern_aggregation)

    # Simple no-op rate limiter
    class _NoopLimiter:
        def check(self, *_):
            return None

    monkeypatch.setattr(rate_limit, "submission_rate_limiter", _NoopLimiter())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def register_user(client, email=None):
    if email is None:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "password123",
        "leetcode_username": "lc_user",
        "gfg_username": None,
        "hackerrank_username": None,
        "timezone": "UTC",
        "available_minutes_per_day": 30,
    }
    r = await client.post("/auth/register", json=payload)
    r.raise_for_status()
    data = r.json()
    return data["user"], data["access_token"], data["refresh_token"]


async def auth_header_for(client, email=None):
    _, access_token, _ = await register_user(client, email=email)
    return {"Authorization": f"Bearer {access_token}"}
