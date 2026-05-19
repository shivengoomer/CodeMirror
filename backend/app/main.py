"""
CodeMirror AI Coach — FastAPI Application Entry Point
=======================================================
Production-grade modular architecture with event-driven processing.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth, cache, chat, notifications, patterns,
    revision, submissions, sync, health, analysis,
    analytics_routes, roadmap, insights, revision_v1,
)
from app.core.config import get_settings
from app.core.database import check_database_connection
from app.core.errors import register_exception_handlers
from app.core.logging_config import setup_logging, get_logger

settings = get_settings()
setup_logging(settings.log_level, settings.log_format)
logger = get_logger("main")


# ── Lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("service_starting", env=settings.app_env)

    # Start APScheduler (kept for backward compatibility)
    try:
        from app.core.scheduler import start_scheduler, scheduler
        from app.services.jobs import sync_active_users, prune_problem_cache, send_revision_reminders
        start_scheduler()
        if not scheduler.get_job("sync_active_users"):
            scheduler.add_job(sync_active_users, "interval", hours=6, id="sync_active_users", replace_existing=True)
        if not scheduler.get_job("prune_problem_cache"):
            scheduler.add_job(prune_problem_cache, "interval", hours=24, id="prune_problem_cache", replace_existing=True)
        if not scheduler.get_job("send_revision_reminders"):
            scheduler.add_job(send_revision_reminders, "interval", hours=1, id="send_revision_reminders", replace_existing=True)
    except Exception:
        logger.warning("scheduler_init_skipped", reason="APScheduler setup failed — Celery handles periodic tasks")

    logger.info("service_started")
    yield
    logger.info("service_shutting_down")

    try:
        from app.core.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass


# ── App ───────────────────────────────────────────────────────────

app = FastAPI(
    title="CodeMirror AI Coach API",
    version="2.0.0",
    description="LeetCode AI Coaching Platform — Production Backend",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────

origins = settings.cors_origins
origins_with_slash = origins + [o + "/" for o in origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_with_slash,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error Handlers ────────────────────────────────────────────────

register_exception_handlers(app)

# ── Routers (existing — backward compatible) ──────────────────────

app.include_router(auth.router)
app.include_router(submissions.router)
app.include_router(patterns.router)
app.include_router(revision.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(sync.router)
app.include_router(cache.router)

# ── Routers (new v2 — under /api/v1) ─────────────────────────────

v1_prefix = settings.api_v1_prefix

app.include_router(health.router)
app.include_router(auth.router, prefix=v1_prefix)
app.include_router(sync.router, prefix=v1_prefix)
app.include_router(submissions.router, prefix=v1_prefix)
app.include_router(revision.router, prefix=v1_prefix)
app.include_router(revision_v1.router, prefix=v1_prefix)
app.include_router(patterns.router, prefix=v1_prefix)
app.include_router(insights.router, prefix=v1_prefix)
app.include_router(analysis.router, prefix=v1_prefix)
app.include_router(analytics_routes.router, prefix=v1_prefix)
app.include_router(roadmap.router, prefix=v1_prefix)
