"""Prompt helpers for AI analysis."""


def build_code_review_prompt(problem_title: str, language: str, code: str) -> str:
    return f"Review this {language} solution for {problem_title}:\n\n{code}"
