import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/test", tags=["test"])

class CookieCheckRequest(BaseModel):
    cookie: str
    submission_id: int | None = None

async def get_csrf():
    url = "https://leetcode.com/graphql/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=10.0)
            csrf_token = response.cookies.get("csrftoken")
            return csrf_token
        except Exception as e:
            logger.error(f"Failed to fetch CSRF token: {e}")
            return None

@router.post("/checkCookie")
async def check_cookie(payload: CookieCheckRequest):
    # Fetch CSRF Token
    csrf_token = await get_csrf()
    if not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve CSRF token from LeetCode"
        )
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "x-csrftoken": csrf_token,
        "Cookie": f"LEETCODE_SESSION={payload.cookie}; csrftoken={csrf_token}"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Determine submission ID to fetch
        sub_id = payload.submission_id
        
        if not sub_id:
            # 1. Fetch user Status to get username
            user_status_query = """
            query globalData {
              userStatus {
                username
                isSignedIn
              }
            }
            """
            try:
                user_res = await client.post(
                    "https://leetcode.com/graphql/",
                    json={"query": user_status_query},
                    headers=headers
                )
                user_res.raise_for_status()
                user_data = user_res.json()
                
                # Check for errors in response
                if "errors" in user_data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"LeetCode GraphQL Error: {user_data['errors']}"
                    )
                
                user_status = user_data.get("data", {}).get("userStatus", {})
                if not user_status.get("isSignedIn") or not user_status.get("username"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Not signed in to LeetCode with the provided session cookie."
                    )
                username = user_status["username"]
                logger.info(f"Successfully authenticated as LeetCode user: {username}")
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LeetCode user check HTTP error: {e.response.status_code}"
                )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error checking user login status: {str(e)}"
                )

            # 2. Get latest submission ID
            recent_subs_query = """
            query recentSubmissions($username: String!, $limit: Int) {
              recentSubmissionList(username: $username, limit: $limit) {
                id
                title
                titleSlug
              }
            }
            """
            try:
                subs_res = await client.post(
                    "https://leetcode.com/graphql/",
                    json={"query": recent_subs_query, "variables": {"username": username, "limit": 1}},
                    headers=headers
                )
                subs_res.raise_for_status()
                subs_data = subs_res.json()
                recent_list = subs_data.get("data", {}).get("recentSubmissionList", [])
                if not recent_list:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="No recent submissions found for this user."
                    )
                sub_id = int(recent_list[0]["id"])
                logger.info(f"Found latest submission ID: {sub_id}")
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LeetCode submission list fetch HTTP error: {e.response.status_code}"
                )
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error fetching recent submissions: {str(e)}"
                )

        # 3. Fetch submission details
        details_query = """
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
            details_res = await client.post(
                "https://leetcode.com/graphql/",
                json={"query": details_query, "variables": {"id": sub_id}},
                headers=headers
            )
            details_res.raise_for_status()
            details_data = details_res.json()
            
            if "errors" in details_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"LeetCode GraphQL Error on submission details: {details_data['errors']}"
                )
            
            sub_details = details_data.get("data", {}).get("submissionDetails")
            if not sub_details:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Submission details for ID {sub_id} not found."
                )

            # Log to terminal (do not log into database)
            logger.info("----------- LEETCODE SUBMISSION DETAILS -----------")
            logger.info(json.dumps(sub_details, indent=2))
            logger.info("---------------------------------------------------")
            
            # Also write using print to be absolutely sure it is visible in the terminal stdout
            print("----------- LEETCODE SUBMISSION DETAILS -----------")
            print(json.dumps(sub_details, indent=2))
            print("---------------------------------------------------")

            return {
                "status": "success",
                "message": "Submission details retrieved and printed to terminal successfully",
                "submission_id": sub_id,
                "data": sub_details
            }
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LeetCode submission details fetch HTTP error: {e.response.status_code}"
            )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error fetching submission details: {str(e)}"
            )


class AnalyzeTestRequest(BaseModel):
    submission_id: str
    leetcode_submission_id: str | None = None


@router.post("/analyze")
async def test_analyze_submission(
    payload: AnalyzeTestRequest,
    db: AsyncSession = Depends(get_db)
):
    report = {
        "submission_id": payload.submission_id,
        "leetcode_submission_id": payload.leetcode_submission_id,
        "steps": []
    }
    
    # Step 1: Database Lookup
    try:
        from app.models.submission import Submission
        from uuid import UUID
        sub_uuid = UUID(payload.submission_id)
        result = await db.execute(
            select(Submission).where(Submission.id == sub_uuid)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            report["steps"].append({
                "step": "1_db_lookup",
                "status": "failed",
                "message": f"Submission with ID {payload.submission_id} not found in DB."
            })
            return report
        
        report["steps"].append({
            "step": "1_db_lookup",
            "status": "success",
            "data": {
                "problem_slug": submission.problem_slug,
                "language": submission.language,
                "has_code_snapshot": bool(submission.code_snapshot),
                "code_snapshot_length": len(submission.code_snapshot) if submission.code_snapshot else 0,
                "verdict": submission.verdict,
                "has_ai_analysis": bool(submission.ai_analysis)
            }
        })
    except Exception as e:
        report["steps"].append({
            "step": "1_db_lookup",
            "status": "error",
            "message": str(e)
        })
        return report

    # Step 2: Check/Load LeetCode session credentials
    session_loaded = False
    try:
        from app.models.leetcode_session import LeetCodeSession
        sess_res = await db.execute(
            select(LeetCodeSession).where(LeetCodeSession.user_id == submission.user_id)
        )
        sess = sess_res.scalar_one_or_none()
        if sess:
            report["steps"].append({
                "step": "2_leetcode_session_check",
                "status": "success",
                "data": {
                    "has_leetcode_session": bool(sess.leetcode_session),
                    "has_leetcode_csrf": bool(sess.leetcode_csrf),
                    "has_leetcode_headers": bool(sess.leetcode_headers)
                }
            })
            session_loaded = True
        else:
            report["steps"].append({
                "step": "2_leetcode_session_check",
                "status": "warning",
                "message": "No LeetCodeSession credentials found for this user in DB."
            })
    except Exception as e:
        report["steps"].append({
            "step": "2_leetcode_session_check",
            "status": "error",
            "message": str(e)
        })

    # Step 3: Test LeetCode client and self-healing fetch (if snapshot empty or leetcode_submission_id provided)
    if session_loaded and sess.leetcode_session and (not submission.code_snapshot or payload.leetcode_submission_id):
        try:
            from app.services.leetcode.client import LeetCodeClient
            client = LeetCodeClient(sess.leetcode_session, sess.leetcode_csrf, sess.leetcode_headers or None)
            
            # Determine submission id
            lc_sub_id = payload.leetcode_submission_id
            if not lc_sub_id:
                # We try to search user's recent submissions
                from app.models.user import User
                user_res = await db.execute(select(User).where(User.id == submission.user_id))
                user = user_res.scalar_one_or_none()
                if user and user.leetcode_username:
                    recent = await client.get_recent_submissions(user.leetcode_username, limit=10)
                    target_ts = int(submission.submitted_at.timestamp())
                    for raw in recent:
                        slug = raw.get("titleSlug") or raw.get("title_slug")
                        ts = raw.get("timestamp") or raw.get("created_at")
                        if slug == submission.problem_slug and ts and abs(int(ts) - target_ts) <= 10:
                            lc_sub_id = raw.get("id")
                            break
            
            if lc_sub_id:
                detail = await client.get_submission_detail(str(lc_sub_id))
                report["steps"].append({
                    "step": "3_leetcode_fetch_snapshot",
                    "status": "success",
                    "data": {
                        "leetcode_submission_id": lc_sub_id,
                        "has_code": bool(detail.get("code")),
                        "code_length": len(detail.get("code")) if detail.get("code") else 0,
                        "runtime_error": detail.get("runtimeError"),
                        "compile_error": detail.get("compileError"),
                    }
                })
            else:
                report["steps"].append({
                    "step": "3_leetcode_fetch_snapshot",
                    "status": "warning",
                    "message": "Could not identify matching LeetCode submission ID to fetch snapshot."
                })
        except Exception as e:
            report["steps"].append({
                "step": "3_leetcode_fetch_snapshot",
                "status": "error",
                "message": str(e)
            })

    # Step 4: Run full analysis pipeline via AnalysisService
    try:
        from app.services.analysis_service import AnalysisService
        service = AnalysisService(db)
        # Note: analyze_submission will flush database changes.
        # We can commit if it succeeds, or let it rollback/re-query.
        analysis = await service.analyze_submission(
            payload.submission_id,
            leetcode_submission_id=payload.leetcode_submission_id
        )
        if analysis:
            await db.commit()
            report["steps"].append({
                "step": "4_run_analysis_pipeline",
                "status": "success",
                "data": {
                    "analysis_id": str(analysis.id),
                    "confidence_score": analysis.confidence_score,
                    "version": analysis.analysis_version,
                    "better_approach": analysis.better_approach[:100] + "..." if analysis.better_approach else None
                }
            })
        else:
            report["steps"].append({
                "step": "4_run_analysis_pipeline",
                "status": "failed",
                "message": "AnalysisService returned None."
            })
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        report["steps"].append({
            "step": "4_run_analysis_pipeline",
            "status": "error",
            "message": str(e),
            "traceback": tb_str
        })
        
    return report
