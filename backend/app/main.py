import logging
from inspect import isawaitable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, cache, chat, notifications, patterns, revision, submissions, sync
from app.core.config import get_settings
from app.core.database import check_database_connection
from app.core.errors import register_exception_handlers
from app.services.groq.client import GroqClient

settings = get_settings()
logger = logging.getLogger("codemirror-api")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="CodeMirror API", version="0.1.0")

origins = [
    settings.extension_origin,
    settings.dashboard_origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://localhost:8000",
]

# Remove potential None or empty strings and strip trailing slashes
origins = [o.rstrip("/") for o in origins if o]
# Add variants with and without trailing slashes
origins = origins + [o + "/" for o in origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(chat.router)
app.include_router(sync.router)
app.include_router(cache.router)


@app.get("/health")
async def health() -> dict[str, object]:
    db_ok = await check_database_connection()
    groq_client = GroqClient()
    # Simple healthcheck: just return ok if API key is present
    groq_status = "ok" if groq_client.api_key else "disabled"
    return {
        "status": "ok" if db_ok and groq_status == "ok" else "degraded",
        "database": {"status": "ok" if db_ok else "error", "detail": None if db_ok else "database unreachable"},
        "groq": {"status": groq_status},
    }


from app.core.scheduler import start_scheduler, shutdown_scheduler, scheduler
from app.services.jobs import sync_active_users, prune_problem_cache, send_revision_reminders

@app.on_event("startup")
async def on_startup() -> None:
    logger.info("service_startup")
    start_scheduler()
    
    # Register jobs if not already registered
    if not scheduler.get_job('sync_active_users'):
        scheduler.add_job(sync_active_users, 'interval', hours=6, id='sync_active_users', replace_existing=True)
    if not scheduler.get_job('prune_problem_cache'):
        scheduler.add_job(prune_problem_cache, 'interval', hours=24, id='prune_problem_cache', replace_existing=True)
    if not scheduler.get_job('send_revision_reminders'):
        scheduler.add_job(send_revision_reminders, 'interval', hours=1, id='send_revision_reminders', replace_existing=True)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("service_shutdown")
    shutdown_scheduler()
