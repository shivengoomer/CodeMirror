"""SQLAlchemy model modules — all models must be imported here for Alembic."""

from app.models.enums import (
    CeleryTaskStatus, PatternCategory, PatternImpact, PatternSeverity,
    PeriodType, Platform, QueueType, RevisionStatus, RoadmapStatus,
    SubmissionTagRole, SubmissionVerdict, SyncJobType, SyncStatus,
)

# ── Existing Models ──────────────────────────────────────────────
from app.models.user import User
from app.models.submission import Submission
from app.models.pattern import Pattern
from app.models.revision_queue import RevisionQueueItem
from app.models.refresh_token import RefreshToken
from app.models.leetcode_session import LeetCodeSession
from app.models.lc_submission_snapshot import LCSubmissionSnapshot
from app.models.lc_problem_cache import LCProblemCache
from app.models.submission_analysis_cache import SubmissionAnalysisCache
from app.models.submission_tag import SubmissionTag
from app.models.weekly_digest import WeeklyDigest
from app.models.job_error import JobError

# ── New Models (v2) ──────────────────────────────────────────────
from app.models.sync_state import SyncState
from app.models.sync_job import SyncJob
from app.models.event import Event
from app.models.celery_task import CeleryTask
from app.models.auth_token import AuthToken, JWTToken
from app.models.ai_analysis import AIAnalysis
from app.models.ast_metadata import ASTMetadata
from app.models.pattern_detection import PatternDetection
from app.models.topic_strength import TopicStrength
from app.models.topic_analytics import TopicAnalytics
from app.models.learning_style import LearningStyle
from app.models.roadmap import Roadmap
from app.models.roadmap_progress import RoadmapProgress
from app.models.interview_readiness import InterviewReadiness
from app.models.user_statistics import UserStatistics
from app.models.daily_report import DailyIntelligenceReport
from app.models.heatmap_data import HeatmapData
from app.models.complexity_progression import ComplexityProgression
from app.models.code_evolution import CodeEvolution

__all__ = [
    # Enums
    "CeleryTaskStatus", "PatternCategory", "PatternImpact", "PatternSeverity",
    "PeriodType", "Platform", "QueueType", "RevisionStatus", "RoadmapStatus",
    "SubmissionTagRole", "SubmissionVerdict", "SyncJobType", "SyncStatus",
    # Existing
    "User", "Submission", "Pattern", "RevisionQueueItem", "RefreshToken",
    "LeetCodeSession", "LCSubmissionSnapshot", "LCProblemCache",
    "SubmissionAnalysisCache", "SubmissionTag", "WeeklyDigest", "JobError",
    # New v2
    "SyncState", "SyncJob", "Event", "CeleryTask", "AuthToken", "JWTToken",
    "AIAnalysis", "ASTMetadata", "PatternDetection", "TopicStrength",
    "TopicAnalytics", "LearningStyle",
    "Roadmap", "RoadmapProgress", "InterviewReadiness",
    "UserStatistics", "DailyIntelligenceReport", "HeatmapData",
    "ComplexityProgression", "CodeEvolution",
]
