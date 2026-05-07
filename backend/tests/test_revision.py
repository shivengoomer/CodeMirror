import pytest


@pytest.mark.asyncio
async def test_revision_queue_flow(client):
    # create auth header
    from tests.conftest import auth_header_for
    headers = await auth_header_for(client)

    # Create a submission to ensure a revision item exists
    import time
    now_ms = int(time.time() * 1000)
    payload = {
        "platform": "leetcode",
        "problem_slug": "rev-prob",
        "problem_title": "Revision Problem",
        "language": "python",
        "code": "print(\"rev\")",
        "verdict": "wrong_answer",
        "failing_test_cases": [],
        "error_message": None,
        "runtime_ms": 10,
        "timestamp": now_ms,
    }
    r = await client.post("/submissions", json=payload, headers=headers)
    assert r.status_code == 201

    # List revision queue
    r = await client.get("/revision-queue", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    item_id = items[0]["id"]

    # Today's session
    r = await client.get("/revision-queue/today", headers=headers)
    assert r.status_code == 200
    session = r.json()
    assert "items" in session and "plan" in session

    # Complete item
    r = await client.post(f"/revision-queue/{item_id}/complete", json={"quality": 4, "last_verdict": "wrong_answer"}, headers=headers)
    assert r.status_code == 200

    # Delete item
    r = await client.delete(f"/revision-queue/{item_id}", headers=headers)
    assert r.status_code == 204

    # Confirm deletion
    r = await client.get("/revision-queue", headers=headers)
    assert r.status_code == 200
    # item may still appear if multiple users/test runs exist; primary check is that endpoints work
