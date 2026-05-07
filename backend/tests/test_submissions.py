import time
import pytest


@pytest.mark.asyncio
async def test_submissions_ingest_list_get(client):
    # create auth header
    from tests.conftest import auth_header_for
    headers = await auth_header_for(client)

    now_ms = int(time.time() * 1000)
    payload = {
        "platform": "leetcode",
        "problem_slug": "two-sum",
        "problem_title": "Two Sum",
        "language": "python",
        "code": "print(\"hello\")",
        "verdict": "wrong_answer",
        "failing_test_cases": [],
        "error_message": None,
        "runtime_ms": 123,
        "timestamp": now_ms,
    }
    r = await client.post("/submissions", json=payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert "submission_id" in data

    sid = data["submission_id"]

    # List
    r = await client.get("/submissions", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(item["id"] == sid for item in body["items"]) or any(str(item["id"]) == sid for item in body["items"]) 

    # Get
    r = await client.get(f"/submissions/{sid}", headers=headers)
    assert r.status_code == 200
    get_body = r.json()
    assert get_body["problem_slug"] == "two-sum"
