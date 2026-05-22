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


def _parse_csrftoken_from_set_cookie(set_cookie: str | None) -> str | None:
    """Extract csrftoken value from a Set-Cookie header string."""
    if not set_cookie:
        return None
    for part in set_cookie.split(","):
        part = part.strip()
        if "csrftoken=" in part:
            for segment in part.split(";"):
                segment = segment.strip()
                if segment.startswith("csrftoken="):
                    return segment[len("csrftoken="):]
    return None


class LeetCodeClient:
    """
    Authenticated LeetCode API client.

    Authentication strategy (mirrors leetcode-query's Credential.init):
    1. Hit GET /graphql/ unauthenticated → extract fresh csrftoken from set-cookie header.
    2. Use LEETCODE_SESSION cookie + that fresh csrftoken for all subsequent requests.

    We deliberately NEVER use the csrftoken stored in the DB — it may be stale.
    """

    def __init__(
        self,
        session_cookie: str,
        csrf_token: str | None = None,  # kept for API compat but ignored
        headers: dict[str, str] | None = None,
    ):
        self.session_cookie = session_cookie
        captured_headers = headers or {}

        # Only set LEETCODE_SESSION here — csrftoken is fetched fresh by _ensure_csrf()
        self.cookies: dict[str, str] = {}
        if session_cookie:
            self.cookies["LEETCODE_SESSION"] = session_cookie
        # NOTE: we intentionally do NOT put csrftoken from DB into self.cookies
        # Stored CSRF tokens are routinely stale; we always fetch fresh from LeetCode.
        self.csrf_token: str = ""  # populated lazily by _ensure_csrf()

        self.user_agent = (
            captured_headers.get("User-Agent")
            or captured_headers.get("user-agent")
            or "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        self.headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com/",
            "Origin": "https://leetcode.com",
            "User-Agent": self.user_agent,
        }
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
                "user_agent": self.user_agent,
            },
        )

    async def _ensure_csrf(self) -> None:
        """
        Fetch a fresh CSRF token from LeetCode — exactly like leetcode-query's Credential.init().
        Makes an unauthenticated GET /graphql/ and extracts csrftoken from the set-cookie header.
        Cached for the lifetime of this client instance.
        """
        if self.csrf_token:
            return  # already have a fresh one for this session

        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                response = await c.get(
                    "https://leetcode.com/graphql/",
                    headers={"User-Agent": self.user_agent},
                )
                # httpx automatically parses cookies
                csrf = response.cookies.get("csrftoken")
                if not csrf:
                    # fallback: manually parse set-cookie header
                    csrf = _parse_csrftoken_from_set_cookie(
                        response.headers.get("set-cookie")
                    )
                if csrf:
                    self.csrf_token = csrf
                    self.cookies["csrftoken"] = csrf
                    self.headers["x-csrftoken"] = csrf
                    logger.info("leetcode_csrf_refreshed csrf_len=%d", len(csrf))
                else:
                    logger.warning("leetcode_csrf_fetch_returned_empty")
        except Exception as e:
            logger.error("leetcode_csrf_fetch_failed: %s", e)

    async def _post(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        await self._ensure_csrf()

        async with httpx.AsyncClient(timeout=30.0, cookies=self.cookies) as client:
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

    async def _post_permissive(
        self, query: str, variables: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Like _post but never raises on GraphQL errors — used for submission detail fetches."""
        await self._ensure_csrf()

        async with httpx.AsyncClient(timeout=30.0, cookies=self.cookies) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": variables or {}},
                headers=self.headers,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                body = response.text[:500]
                logger.warning(
                    "leetcode_detail_http_error",
                    extra={"status": response.status_code, "body": body},
                )
                return {}
            payload = response.json()
            if payload.get("errors"):
                logger.warning(
                    "leetcode_detail_graphql_errors",
                    extra={"errors": str(payload["errors"])[:300]},
                )
                # Still return the payload — caller extracts data.submissionDetails
                # which may be null, and that's handled downstream
                return payload
            return payload

    async def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        await self._ensure_csrf()

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False, cookies=self.cookies) as client:
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
        """Fetch detailed info for a single submission including code.
        Returns an empty dict if the submission is inaccessible (expired session,
        wrong ID, rate-limited, etc.) so callers don't need to guard against exceptions.
        """
        # LeetCode IDs are often large strings or ints
        query = """
        query submissionDetails($id: Int!) {
          submissionDetails(submissionId: $id) {
            id
            runtime
            runtimeDisplay
            runtimePercentile
            runtimeDistribution
            memory
            memoryDisplay
            memoryPercentile
            memoryDistribution
            code
            timestamp
            statusCode
            user {
              username
              profile {
                realName
                userAvatar
              }
            }
            lang {
              name
              verboseName
            }
            question {
              questionId
              titleSlug
              hasFrontendPreview
            }
            notes
            flagType
            topicTags {
              tagId
              slug
              name
            }
            runtimeError
            compileError
            lastTestcase
            codeOutput
            expectedOutput
            totalCorrect
            totalTestcases
            fullCodeOutput
            testDescriptions
            testBodies
            testInfo
            stdOutput
          }
        }
        """
        try:
            int_id = int(submission_id)
        except (ValueError, TypeError):
            logger.warning("get_submission_detail: invalid id %r", submission_id)
            return {}

        # Use permissive post so GraphQL errors don't blow up the whole sync loop
        payload = await self._post_permissive(query, {"id": int_id})
        detail = payload.get("data", {}).get("submissionDetails")
        if not detail:
            logger.warning(
                "get_submission_detail: null result for submission_id=%s", submission_id
            )
            return {}
        return detail

    async def check_session_validity(self) -> bool:
        """Verify if the LEETCODE_SESSION cookie is currently valid and signed in."""
        query = """
        query globalData {
          userStatus {
            username
            isSignedIn
          }
        }
        """
        try:
            payload = await self._post_permissive(query)
            status = payload.get("data", {}).get("userStatus")
            if status and status.get("isSignedIn"):
                return True
        except Exception as e:
            logger.warning("check_session_validity: failed checking session validity: %s", e)
        return False

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
