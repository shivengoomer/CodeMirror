"""Pydantic schema modules."""

from app.schemas.auth import AccessTokenResponse, AuthResponse, LoginRequest, RefreshRequest, RegisterRequest
from app.schemas.pattern import PatternCreate, PatternResponse, PatternUpdate
from app.schemas.pattern_detail import PatternDetailResponse
from app.schemas.revision import RevisionCompleteRequest, RevisionSessionResponse
from app.schemas.revision_queue import RevisionQueueItemCreate, RevisionQueueItemResponse, RevisionQueueItemUpdate
from app.schemas.submission import FailingCase, SubmissionCreate, SubmissionIngestResponse, SubmissionListResponse, SubmissionResponse, SubmissionUpdate, UnifiedSubmissionIn
from app.schemas.submission_tag import SubmissionTagCreate, SubmissionTagResponse
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.weekly_digest import WeeklyDigestCreate, WeeklyDigestResponse

__all__ = [
    "FailingCase",
    "AccessTokenResponse",
    "AuthResponse",
    "LoginRequest",
    "PatternCreate",
    "PatternDetailResponse",
    "PatternResponse",
    "PatternUpdate",
    "RevisionQueueItemCreate",
    "RevisionQueueItemResponse",
    "RevisionQueueItemUpdate",
    "RevisionCompleteRequest",
    "RevisionSessionResponse",
    "RefreshRequest",
    "RegisterRequest",
    "SubmissionCreate",
    "SubmissionIngestResponse",
    "SubmissionListResponse",
    "SubmissionResponse",
    "SubmissionTagCreate",
    "SubmissionTagResponse",
    "SubmissionUpdate",
    "UnifiedSubmissionIn",
    "UserCreate",
    "UserResponse",
    "UserUpdate",
    "WeeklyDigestCreate",
    "WeeklyDigestResponse",
]
