"""Health check endpoints — comprehensive service health monitoring."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, check_database_connection
from app.services.groq.client import GroqClient

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    db_ok = await check_database_connection()
    groq_client = GroqClient()
    groq_status = "ok" if groq_client.api_key else "disabled"
    return {
        "status": "ok" if db_ok and groq_status == "ok" else "degraded",
        "database": {"status": "ok" if db_ok else "error"},
        "groq": {"status": groq_status},
    }


@router.get("/health/db")
async def health_db() -> dict:
    ok = await check_database_connection()
    return {"status": "ok" if ok else "error"}


@router.get("/health/redis")
async def health_redis() -> dict:
    try:
        import redis
        from app.core.config import get_settings
        r = redis.from_url(get_settings().redis_url, socket_timeout=2)
        r.ping()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/health/celery")
async def health_celery() -> dict:
    try:
        from app.workers import celery_app
        inspect = celery_app.control.inspect()
        active = inspect.active()
        return {"status": "ok" if active else "no_workers", "workers": list(active.keys()) if active else []}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
