"""
CodeMirror — Application Settings
==================================
Centralized Pydantic settings with support for all services.
"""

from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment / .env file."""

    # ── Application ───────────────────────────────────────────────
    app_name: str = "codemirror-ai-coach"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"
    api_v1_prefix: str = "/api/v1"

    # ── Database ──────────────────────────────────────────────────
    database_url: str
    db_pool_size: int = 20
    db_max_overflow: int = 0
    db_echo: bool = False

    # ── Redis ─────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 50

    # ── Celery ────────────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    celery_task_always_eager: bool = False

    # ── AI (Groq) ─────────────────────────────────────────────────
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_tokens: int = 4096
    groq_temperature: float = 0.2

    # ── JWT ───────────────────────────────────────────────────────
    jwt_secret: str
    jwt_refresh_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # ── Encryption ────────────────────────────────────────────────
    encryption_key: str = ""

    # ── CORS ──────────────────────────────────────────────────────
    extension_origin: str = "chrome-extension://your-extension-id"
    dashboard_origin: str = "http://localhost:3000"

    # ── LeetCode ──────────────────────────────────────────────────
    leetcode_api_url: str = "https://leetcode.com/graphql"
    leetcode_rate_limit_per_minute: int = 100

    # ── Logging ───────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: str = "json"

    # ── Monitoring ────────────────────────────────────────────────
    sentry_dsn: str = ""
    prometheus_port: int = 9090

    # ── Rate Limiting ─────────────────────────────────────────────
    rate_limit_per_minute: int = 60
    rate_limit_burst: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def sync_database_url(self) -> str:
        """Synchronous DB URL for APScheduler / Alembic."""
        url = self.database_url
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "")
        return url

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            self.extension_origin,
            self.dashboard_origin,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://localhost:8000",
        ]
        return [o.rstrip("/") for o in origins if o]


@lru_cache
def get_settings() -> Settings:
    return Settings()
