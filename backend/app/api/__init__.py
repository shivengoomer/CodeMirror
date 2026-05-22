"""API route modules."""
from app.api import (
    auth, cache, chat, notifications, patterns,
    revision, submissions, sync, health, analysis,
    analytics_routes, roadmap, insights, revision_v1, test,
)

__all__ = [
    "auth", "cache", "chat", "notifications", "patterns",
    "revision", "submissions", "sync", "health", "analysis",
    "analytics_routes", "roadmap", "insights", "revision_v1", "test",
]
