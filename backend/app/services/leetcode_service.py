from typing import Any

import httpx

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"


def _headers(session_cookie: str, csrf_token: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin": "https://leetcode.com",
        "User-Agent": "Mozilla/5.0",
        "Cookie": f"LEETCODE_SESSION={session_cookie}; csrftoken={csrf_token}",
        "x-csrftoken": csrf_token,
    }


async def get_recent_submissions(username: str, session: str, csrf: str, limit: int = 20) -> list[dict[str, Any]]:
    query = """
    query recentSubmissions($username: String!, $limit: Int) {
      recentSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
        statusDisplay
        lang
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": {"username": username, "limit": limit}},
                headers=_headers(session, csrf),
            )
            response.raise_for_status()
            data = response.json()
            rows = data.get("data", {}).get("recentSubmissionList") or []
            if not isinstance(rows, list):
                return []
            out: list[dict[str, Any]] = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                out.append(
                    {
                        "id": row.get("id"),
                        "title": row.get("title", ""),
                        "titleSlug": row.get("titleSlug", ""),
                        "timestamp": row.get("timestamp", ""),
                        "statusDisplay": row.get("statusDisplay", ""),
                        "lang": row.get("lang", ""),
                    }
                )
            return out
    except httpx.HTTPError:
        return []


async def get_submission_detail(submission_id: int, session: str, csrf: str) -> dict[str, Any]:
    query = """
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        runtimePercentile
        memory
        memoryPercentile
        code
        timestamp
        statusDisplay
        lang { name }
        question {
          title
          titleSlug
          difficulty
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": {"submissionId": submission_id}},
                headers=_headers(session, csrf),
            )
            response.raise_for_status()
            data = response.json()
            detail = data.get("data", {}).get("submissionDetails") or {}
            return {
                "runtimePercentile": float(detail.get("runtimePercentile") or 0.0),
                "memoryPercentile": float(detail.get("memoryPercentile") or 0.0),
                "runtime": detail.get("runtime", ""),
                "memory": detail.get("memory", ""),
                "code": detail.get("code", ""),
                "timestamp": detail.get("timestamp", ""),
                "statusDisplay": detail.get("statusDisplay", ""),
                "lang": (detail.get("lang") or {}).get("name", "") if isinstance(detail.get("lang"), dict) else "",
                "question": detail.get("question", {}) if isinstance(detail.get("question"), dict) else {},
            }
    except httpx.HTTPError:
        return {}


async def get_problem_metadata(slug: str, session: str, csrf: str) -> dict[str, Any]:
    query = """
    query getQuestion($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        difficulty
        topicTags {
          name
          slug
        }
      }
    }
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": {"titleSlug": slug}},
                headers=_headers(session, csrf),
            )
            response.raise_for_status()
            data = response.json()
            question = data.get("data", {}).get("question") or {}
            tags = question.get("topicTags") or []
            safe_tags = []
            for tag in tags:
                if isinstance(tag, dict):
                    safe_tags.append({"name": tag.get("name", ""), "slug": tag.get("slug", "")})
            return {
                "difficulty": question.get("difficulty", ""),
                "topicTags": safe_tags,
                "questionId": question.get("questionId", ""),
            }
    except httpx.HTTPError:
        return {}
