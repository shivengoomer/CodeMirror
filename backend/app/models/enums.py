"""
CodeMirror — Enum Definitions
===============================
All application-wide enumerations.
"""

from enum import StrEnum
from typing import TypeVar

EnumT = TypeVar("EnumT", bound=StrEnum)


def enum_values(enum_class: type[EnumT]) -> list[str]:
    return [member.value for member in enum_class]


class Platform(StrEnum):
    LEETCODE = "leetcode"
    GFG = "gfg"
    HACKERRANK = "hackerrank"


class SubmissionVerdict(StrEnum):
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    TLE = "tle"
    MLE = "mle"
    RUNTIME_ERROR = "runtime_error"
    COMPILE_ERROR = "compile_error"


class PatternImpact(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SubmissionTagRole(StrEnum):
    PRIMARY = "primary"
    CONTRIBUTING = "contributing"


class SyncStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class SyncJobType(StrEnum):
    INITIAL_SYNC = "initial_sync"
    INCREMENTAL_SYNC = "incremental_sync"


class QueueType(StrEnum):
    WEAK_TOPIC = "weak_topic"
    FORGOTTEN = "forgotten"
    MISTAKE_PATTERN = "mistake_pattern"
    INTERVIEW_PREP = "interview_prep"


class RevisionStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class PatternCategory(StrEnum):
    LOGICAL = "logical"
    SYNTACTICAL = "syntactical"
    ALGORITHMIC = "algorithmic"


class PatternSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CeleryTaskStatus(StrEnum):
    PENDING = "pending"
    STARTED = "started"
    SUCCESS = "success"
    FAILURE = "failure"
    RETRY = "retry"


class RoadmapStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class PeriodType(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ALL_TIME = "all_time"
