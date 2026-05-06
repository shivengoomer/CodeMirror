from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import auth, patterns, revision, submissions
from app.core.config import get_settings
from app.core.database import engine
from app.core.errors import register_exception_handlers
from app.services.groq_service import groq_service

settings = get_settings()

app = FastAPI(title="CodeMirror API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.extension_origin, settings.dashboard_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(submissions.router)
app.include_router(patterns.router)
app.include_router(revision.router)


@app.get("/health")
async def health() -> dict[str, object]:
    db_status = "ok"
    db_detail: str | None = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "error"
        db_detail = str(exc)

    groq = await groq_service.healthcheck()
    return {
        "status": "ok" if db_status == "ok" and groq.get("status") in {"ok", "disabled"} else "degraded",
        "database": {"status": db_status, "detail": db_detail},
        "groq": groq,
    }


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await groq_service.wait_for_inflight()
