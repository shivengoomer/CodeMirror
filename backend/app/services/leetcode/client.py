from typing import Any
import logging
import httpx

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_SUBMISSIONS_URL = "https://leetcode.com/api/submissions/"
logger = logging.getLogger(__name__)
_leetcode_client_debug_logged = False


def _redact(value: str | None) -> str:
    if not value:
        return "missing"
    if len(value) <= 12:
        return f"present(len={len(value)})"
    return f"{value[:6]}...{value[-6:]}(len={len(value)})"


def _redact_cookie(cookie: str | None) -> str:
    if not cookie:
        return "missing"
    safe = cookie
    for name in ("LEETCODE_SESSION", "csrftoken"):
        marker = f"{name}="
        if marker not in safe:
            continue
        before, value_and_rest = safe.split(marker, 1)
        value, sep, rest = value_and_rest.partition(";")
        safe = f"{before}{marker}{_redact(value)}{sep}{rest}"
    return safe

class LeetCodeClient:
    def __init__(
        self,
        session_cookie: str,
        csrf_token: str | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.session_cookie = session_cookie
        self.csrf_token = csrf_token or ""
        captured_headers = headers or {}
        captured_cookie = captured_headers.get("Cookie") or captured_headers.get("cookie")
        cookie = captured_cookie or f"LEETCODE_SESSION={session_cookie}; csrftoken={self.csrf_token}"
        self.headers = {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com/submissions/",
            "Origin": "https://leetcode.com",
            "User-Agent": captured_headers.get("User-Agent")
            or captured_headers.get("user-agent")
            or "Mozilla/5.0",
            "Cookie": cookie,
            "x-csrftoken": self.csrf_token,
        }
        for key, value in captured_headers.items():
            if key.lower() in {"cookie", "user-agent", "referer", "x-csrftoken"} and value:
                self.headers[key] = value
        if not self.headers.get("x-csrftoken") and self.headers.get("X-CSRFToken"):
            self.headers["x-csrftoken"] = self.headers["X-CSRFToken"]
        self._log_debug_once("init")

    def _log_debug_once(self, stage: str) -> None:
        global _leetcode_client_debug_logged
        if _leetcode_client_debug_logged:
            return
        _leetcode_client_debug_logged = True
        logger.warning(
            "leetcode_client_debug",
            extra={
                "stage": stage,
                "session": _redact(self.session_cookie),
                "csrf": _redact(self.csrf_token),
                "header_keys": sorted(self.headers.keys()),
                "cookie_header": _redact_cookie(self.headers.get("Cookie") or self.headers.get("cookie")),
                "referer": self.headers.get("Referer") or self.headers.get("referer"),
                "user_agent": self.headers.get("User-Agent") or self.headers.get("user-agent"),
                "has_x_csrftoken": bool(self.headers.get("x-csrftoken") or self.headers.get("X-CSRFToken")),
            },
        )

    async def _post(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": variables or {}},
                headers=self.headers,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                body = response.text[:500]
                raise RuntimeError(f"LeetCode GraphQL HTTP {response.status_code}: {body}") from exc
            payload = response.json()
            if payload.get("errors"):
                raise RuntimeError(f"LeetCode GraphQL errors: {payload['errors']}")
            return payload

    async def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            response = await client.get(url, params=params or {}, headers=self.headers)
            if response.status_code >= 400:
                body = response.text[:500]
                logger.warning(
                    "leetcode_http_error",
                    extra={
                        "url": str(response.url),
                        "status_code": response.status_code,
                        "body": body,
                        "cookie_header": _redact_cookie(self.headers.get("Cookie") or self.headers.get("cookie")),
                        "has_x_csrftoken": bool(self.headers.get("x-csrftoken") or self.headers.get("X-CSRFToken")),
                    },
                )
                raise RuntimeError(f"LeetCode HTTP {response.status_code}: {body}")
            content_type = response.headers.get("content-type", "")
            if "application/json" not in content_type:
                raise RuntimeError(f"LeetCode returned non-JSON response: {response.text[:300]}")
            return response.json()

    async def get_recent_submissions(self, username: str, limit: int = 20) -> list[dict[str, Any]]:
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
        data = await self._post(query, {"username": username, "limit": limit})
        return data.get("data", {}).get("recentSubmissionList") or []

    async def get_submission_detail(self, submission_id: str) -> dict[str, Any]:
        # LeetCode IDs are often large strings or ints
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
              content
              topicTags {
                name
                slug
              }
            }
          }
        }
        """
        data = await self._post(query, {"submissionId": int(submission_id)})
        return data.get("data", {}).get("submissionDetails") or {}

    async def get_problem_metadata(self, slug: str) -> dict[str, Any]:
        query = """
        query getQuestion($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            title
            difficulty
            content
            topicTags {
              name
              slug
            }
          }
        }
        """
        data = await self._post(query, {"titleSlug": slug})
        return data.get("data", {}).get("question") or {}

    async def get_full_profile_data(self, username: str) -> dict[str, Any]:
        query = """
        query userFullProfile($username: String!) {
          matchedUser(username: $username) {
            username
            submitStats {
              acSubmissionNum {
                difficulty
                count
                submissions
              }
              totalSubmissionNum {
                difficulty
                count
                submissions
              }
            }
          }
          userSolvedTopics(username: $username) {
            topicName
            topicSlug
            solvedCount
          }
        }
        """
        data = await self._post(query, {"username": username})
        return data.get("data") or {}

    async def get_current_username(self) -> str | None:
        query = """
        query globalData {
          userStatus {
            username
            isSignedIn
          }
        }
        """
        data = await self._post(query)
        status = data.get("data", {}).get("userStatus") or {}
        if status.get("isSignedIn") and status.get("username"):
            return status["username"]
        return None

    async def require_signed_in_username(self) -> str:
        username = await self.get_current_username()
        if not username:
            raise RuntimeError("LeetCode session is invalid or expired. Re-open LeetCode, log in, then click the extension again.")
        return username

    async def get_all_accepted_submissions(self, username: str, offset: int = 0, limit: int = 20) -> dict[str, Any]:
        # Public profile accepted submissions fallback.
        query = """
        query recentAcSubmissions($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
              id
              title
              titleSlug
              timestamp
              statusDisplay
              lang
          }
        }
        """
        data = await self._post(query, {"username": username, "limit": limit})
        submissions = data.get("data", {}).get("recentAcSubmissionList") or []
        return {"submissions": submissions[offset: offset + limit], "hasNext": False, "total": len(submissions)}

    async def get_authenticated_submissions(
        self,
        offset: int = 0,
        limit: int = 20,
        last_key: str | None = None,
    ) -> dict[str, Any]:
        """Fetch signed-in user's submission list using LeetCode session cookies."""
        params: dict[str, Any] = {"offset": offset, "limit": limit}
        if last_key:
            params["lastkey"] = last_key

        data = await self._get(LEETCODE_SUBMISSIONS_URL, params=params)
        raw_submissions = data.get("submissions_dump") or data.get("submissions") or []
        submissions = [self._normalize_submission(item) for item in raw_submissions]
        return {
            "submissions": submissions,
            "hasNext": bool(data.get("has_next") or data.get("hasNext")),
            "lastKey": data.get("last_key") or data.get("lastKey"),
            "total": data.get("total_num") or data.get("total"),
        }

    @staticmethod
    def _normalize_submission(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("id"),
            "title": item.get("title") or item.get("question_title") or item.get("title_slug") or item.get("titleSlug"),
            "titleSlug": item.get("titleSlug") or item.get("title_slug"),
            "timestamp": item.get("timestamp") or item.get("created_at"),
            "statusDisplay": item.get("statusDisplay") or item.get("status_display"),
            "lang": item.get("lang") or item.get("lang_name"),
            "runtime": item.get("runtime"),
            "memory": item.get("memory"),
            "code": item.get("code"),
        }
