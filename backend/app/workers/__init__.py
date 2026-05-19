"""Celery app configuration."""
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any

try:
    from celery import Celery
except ModuleNotFoundError:  # pragma: no cover - local slim env fallback
    Celery = None

from app.core.config import get_settings

settings = get_settings()

class _EagerTask:
    def __init__(self, fn: Callable[..., Any], bind: bool = False) -> None:
        self.fn = fn
        self.bind = bind
        self.request = SimpleNamespace(retries=0)
        self.__name__ = getattr(fn, "__name__", "task")

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        if self.bind:
            return self.fn(self, *args, **kwargs)
        return self.fn(*args, **kwargs)

    def delay(self, *args: Any, **kwargs: Any) -> Any:
        return self(*args, **kwargs)

    def retry(self, exc: Exception, countdown: int = 0) -> None:
        raise exc


class _EagerCelery:
    """Small Celery-compatible fallback for import checks and local tests."""

    conf: dict[str, Any] = {}

    def task(self, *args: Any, **kwargs: Any):
        def decorator(fn: Callable[..., Any]) -> _EagerTask:
            return _EagerTask(fn, bind=bool(kwargs.get("bind")))

        if args and callable(args[0]):
            return decorator(args[0])
        return decorator

    def autodiscover_tasks(self, packages: list[str]) -> None:
        return None

    class control:
        @staticmethod
        def inspect():
            return None


celery_app = (
    Celery("codemirror", broker=settings.celery_broker_url, backend=settings.celery_result_backend)
    if Celery is not None
    else _EagerCelery()
)

if Celery is not None:
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_default_queue="default",
        task_queues={
            "default": {"exchange": "default", "routing_key": "default"},
            "sync": {"exchange": "sync", "routing_key": "sync"},
            "analysis": {"exchange": "analysis", "routing_key": "analysis"},
            "analytics": {"exchange": "analytics", "routing_key": "analytics"},
        },
        task_routes={
            "app.workers.sync_worker.*": {"queue": "sync"},
            "app.workers.analysis_worker.*": {"queue": "analysis"},
            "app.workers.analytics_worker.*": {"queue": "analytics"},
        },
        beat_schedule={
            "periodic-incremental-sync": {
                "task": "app.workers.sync_worker.periodic_incremental_sync",
                "schedule": 3600.0,
            },
            "generate-daily-reports": {
                "task": "app.workers.analytics_worker.generate_all_daily_reports",
                "schedule": 86400.0,
            },
            "update-interview-readiness": {
                "task": "app.workers.analytics_worker.update_all_interview_readiness",
                "schedule": 604800.0,
            },
        },
    )

celery_app.autodiscover_tasks([
    "app.workers.sync_worker",
    "app.workers.analysis_worker",
    "app.workers.pattern_worker",
    "app.workers.revision_worker",
    "app.workers.analytics_worker",
])
