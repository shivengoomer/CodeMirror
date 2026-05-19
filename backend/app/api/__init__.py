"""API route modules."""
from app.api import (
    auth, cache, chat, notifications, patterns,
    revision, submissions, sync, health, analysis,
    analytics_routes, roadmap, insights, revision_v1,
)

__all__ = [
    "auth", "cache", "chat", "notifications", "patterns",
    "revision", "submissions", "sync", "health", "analysis",
    "analytics_routes", "roadmap", "insights", "revision_v1",
]
