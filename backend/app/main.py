import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, notifications, patterns, revision, submissions
from app.core.config import get_settings
from app.core.database import check_database_connection
from app.core.errors import register_exception_handlers
from app.services.groq_service import groq_service

settings = get_settings()
logger = logging.getLogger("codemirror-api")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="CodeMirror API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.extension_origin, settings.dashboard_origin],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(submissions.router)
app.include_router(patterns.router)
app.include_router(revision.router)
app.include_router(notifications.router)


@app.get("/health")
async def health() -> dict[str, object]:
    db_ok = await check_database_connection()

    groq = await groq_service.healthcheck()
    return {
        "status": "ok" if db_ok and groq.get("status") in {"ok", "disabled"} else "degraded",
        "database": {"status": "ok" if db_ok else "error", "detail": None if db_ok else "database unreachable"},
        "groq": groq,
    }


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("service_startup")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("service_shutdown")
    await groq_service.wait_for_inflight()
