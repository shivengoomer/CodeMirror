from typing import Any
import httpx

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

class LeetCodeClient:
    def __init__(self, session_cookie: str, csrf_token: str):
        self.session_cookie = session_cookie
        self.csrf_token = csrf_token
        self.headers = {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com",
            "Origin": "https://leetcode.com",
            "User-Agent": "Mozilla/5.0",
            "Cookie": f"LEETCODE_SESSION={session_cookie}; csrftoken={csrf_token}",
            "x-csrftoken": csrf_token,
        }

    async def _post(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={"query": query, "variables": variables or {}},
                headers=self.headers,
            )
            response.raise_for_status()
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

    async def get_all_accepted_submissions(self, username: str, offset: int = 0, limit: int = 20) -> dict[str, Any]:
        # This is for the bulk ingest. Note: LeetCode limits this.
        query = """
        query userSubmissions($username: String!, $offset: Int, $limit: Int) {
          submissionList(username: $username, offset: $offset, limit: $limit) {
            submissions {
              id
              title
              titleSlug
              timestamp
              statusDisplay
              lang
            }
            hasNext
            total
          }
        }
        """
        data = await self._post(query, {"username": username, "offset": offset, "limit": limit})
        return data.get("data", {}).get("submissionList") or {}
