from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, patterns, revision, submissions
from app.core.config import get_settings
from app.core.errors import register_exception_handlers

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
async def health() -> dict[str, str]:
    return {"status": "ok"}
