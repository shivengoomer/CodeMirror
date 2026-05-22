import pytest
import time
from unittest.mock import AsyncMock
from app.services.groq.client import GroqClient

@pytest.mark.asyncio
async def test_get_analysis_on_demand_and_cached(client, monkeypatch):
    # Setup authentication
    from tests.conftest import auth_header_for
    headers = await auth_header_for(client)

    # Mock the GroqClient.complete_json response using side_effect
    mock_complete_json = AsyncMock()
    mock_complete_json.side_effect = [
        # First call (during POST /submissions ingestion): simulates empty/failed ingestion-time analysis
        {
            "data": {},
            "prompt_tokens": 0,
            "completion_tokens": 0
        },
        # Second call (during GET /analysis synchronous on-demand fallback): returns the analysis data
        {
            "data": {
                "failure_category": "missed_edge_case",
                "root_cause": "Nested loops checking j < i missed key permutations when j starts after i.",
                "what_they_thought": "I thought scanning index j < i covers all distinct pairs.",
                "what_is_actually_true": "In order to find correct pairs, we need to search j > i or use a hash map.",
                "code_evidence": "for j in range(i)",
                "fix_direction": "Use a hash map to look up targets in O(n) time.",
                "severity": "slip",
                "repair_exercise": "Practice implementing two-sum using hash maps.",
                "refactored_code": "def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []"
            },
            "prompt_tokens": 120,
            "completion_tokens": 80
        }
    ]
    monkeypatch.setattr(GroqClient, "complete_json", mock_complete_json)

    # Ingest a new wrong_answer submission (will trigger the first mock call returning empty data)
    now_ms = int(time.time() * 1000)
    payload = {
        "platform": "leetcode",
        "problem_slug": "two-sum",
        "problem_title": "Two Sum",
        "language": "python",
        "code": "def twoSum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i):\n            if nums[i] + nums[j] == target:\n                return [i, j]",
        "verdict": "wrong_answer",
        "failing_test_cases": [
            {"input": "[3,2,4], 6", "expected": "[1,2]", "got": "None"}
        ],
        "error_message": "AssertionError: expected [1,2] got None",
        "runtime_ms": 100,
        "timestamp": now_ms,
    }
    r = await client.post("/submissions", json=payload, headers=headers)
    assert r.status_code == 201
    submission_id = r.json()["submission_id"]

    # First GET request: should trigger the second mock call and succeed (generating & caching it)
    r_anal = await client.get(f"/api/v1/analysis/{submission_id}", headers=headers)
    assert r_anal.status_code == 200
    res_data = r_anal.json()

    assert res_data["better_approach"] == "Use a hash map to look up targets in O(n) time."
    assert res_data["refactored_code"] == "def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []"
    assert mock_complete_json.call_count == 2

    # Second GET request: should load from DB cache without calling GroqClient again
    r_anal_cached = await client.get(f"/api/v1/analysis/{submission_id}", headers=headers)
    assert r_anal_cached.status_code == 200
    res_data_cached = r_anal_cached.json()
    assert res_data_cached["better_approach"] == "Use a hash map to look up targets in O(n) time."
    assert mock_complete_json.call_count == 2


@pytest.mark.asyncio
async def test_accepted_submission_analysis(client, monkeypatch):
    # Setup authentication
    from tests.conftest import auth_header_for
    headers = await auth_header_for(client)

    # Mock the GroqClient.complete_json response using side_effect
    mock_complete_json = AsyncMock()
    mock_complete_json.side_effect = [
        # First call (during POST /submissions ingestion): simulates empty/failed ingestion-time analysis
        {
            "data": {},
            "prompt_tokens": 0,
            "completion_tokens": 0
        },
        # Second call (during GET /analysis synchronous on-demand fallback): returns the analysis data
        {
            "data": {
                "failure_category": "other",
                "root_cause": "Code works, but could optimize memory by reusing arrays.",
                "what_they_thought": "I thought creating new arrays at each step is cleaner.",
                "what_is_actually_true": "In-place modifications reduce space complexity to O(1).",
                "code_evidence": "temp = list(nums)",
                "fix_direction": "Modify the input list in-place.",
                "severity": "slip",
                "repair_exercise": "Practice in-place array manipulation problems.",
                "refactored_code": "def twoSum(nums, target):\n    # optimized solution"
            },
            "prompt_tokens": 120,
            "completion_tokens": 80
        }
    ]
    monkeypatch.setattr(GroqClient, "complete_json", mock_complete_json)

    # Ingest a new accepted submission
    now_ms = int(time.time() * 1000)
    payload = {
        "platform": "leetcode",
        "problem_slug": "two-sum",
        "problem_title": "Two Sum",
        "language": "python",
        "code": "def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []",
        "verdict": "accepted",
        "failing_test_cases": [],
        "error_message": None,
        "runtime_ms": 10,
        "timestamp": now_ms,
    }
    r = await client.post("/submissions", json=payload, headers=headers)
    assert r.status_code == 201
    submission_id = r.json()["submission_id"]

    # First GET request: should trigger the second mock call and succeed (generating & caching it)
    r_anal = await client.get(f"/api/v1/analysis/{submission_id}", headers=headers)
    assert r_anal.status_code == 200
    res_data = r_anal.json()

    assert res_data["better_approach"] == "Modify the input list in-place."
    assert res_data["refactored_code"] == "def twoSum(nums, target):\n    # optimized solution"
    assert mock_complete_json.call_count == 2


@pytest.mark.asyncio
async def test_concurrent_analysis_handling(async_session, client, monkeypatch):
    # Setup authentication to create user
    from tests.conftest import register_user
    user_info, access_token, _ = await register_user(client)
    user_id = user_info["id"]

    # Mock the GroqClient.complete_json response
    mock_complete_json = AsyncMock()
    mock_complete_json.return_value = {
        "data": {
            "failure_category": "missed_edge_case",
            "root_cause": "nested loop bounds",
            "what_they_thought": "worked",
            "what_is_actually_true": "missed",
            "code_evidence": "none",
            "fix_direction": "fix loop",
            "severity": "slip",
            "repair_exercise": "practice",
            "refactored_code": "def solve(): pass"
        },
        "prompt_tokens": 10,
        "completion_tokens": 10
    }
    monkeypatch.setattr(GroqClient, "complete_json", mock_complete_json)

    # Ingest a submission directly via a db session
    from app.models.submission import Submission
    from datetime import datetime, UTC
    from sqlalchemy import select
    import uuid

    submission_id = uuid.uuid4()
    
    async with async_session() as db1:
        sub = Submission(
            id=submission_id,
            user_id=uuid.UUID(user_id),
            platform="leetcode",
            problem_slug="two-sum",
            problem_title="Two Sum",
            language="python",
            code_snapshot="def solve(): pass",
            verdict="wrong_answer",
            submitted_at=datetime.now(UTC),
            analysed=False
        )
        db1.add(sub)
        await db1.commit()

    # Now we call analyze_submission on two concurrent sessions
    from app.services.analysis_service import AnalysisService

    async with async_session() as db1, async_session() as db2:
        # Pre-load/touch the submission in both sessions to establish transactions
        await db1.execute(select(Submission).where(Submission.id == submission_id))
        await db2.execute(select(Submission).where(Submission.id == submission_id))

        service1 = AnalysisService(db1)
        service2 = AnalysisService(db2)

        # service1 runs first and successfully commits the AIAnalysis record
        anal1 = await service1.analyze_submission(str(submission_id))
        await db1.commit()

        # service2 runs. Since it started its transaction before service1 committed,
        # its internal check won't see the AIAnalysis record. It will try to insert a duplicate,
        # triggering an IntegrityError on flush, which should be caught and handled.
        anal2 = await service2.analyze_submission(str(submission_id))
        await db2.commit()

    assert anal1 is not None
    assert anal2 is not None
    assert anal1.id == anal2.id

