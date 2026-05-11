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
