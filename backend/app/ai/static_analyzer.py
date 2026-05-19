"""Static-analysis placeholder for Tree-sitter/linter integration."""

from dataclasses import dataclass


@dataclass
class StaticAnalysisResult:
    lines_of_code: int
    function_count: int = 0
    loop_count: int = 0
    conditional_count: int = 0


def analyze_code_structure(code: str) -> StaticAnalysisResult:
    return StaticAnalysisResult(lines_of_code=len([line for line in code.splitlines() if line.strip()]))
