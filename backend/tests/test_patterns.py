import pytest


@pytest.mark.asyncio
async def test_pattern_crud(client):
    from tests.conftest import auth_header_for
    headers = await auth_header_for(client)

    payload = {
        "tag": "off-by-one",
        "title": "Off by one errors",
        "insight": "Common fencepost errors",
        "concept_cluster": ["indices", "loops"],
        "occurrence_count": 1,
        "confidence": 0.5,
        "impact": "medium",
        "suggested_revision_interval_days": 7,
    }
    r = await client.post("/patterns", json=payload, headers=headers)
    assert r.status_code == 201
    p = r.json()
    pid = p["id"]

    # List
    r = await client.get("/patterns", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert any(item["id"] == pid for item in items)

    # Get detail
    r = await client.get(f"/patterns/{pid}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["pattern"]["id"] == pid

    # Patch
    r = await client.patch(f"/patterns/{pid}", json={"title": "Updated title"}, headers=headers)
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "Updated title"

    # Delete
    r = await client.delete(f"/patterns/{pid}", headers=headers)
    assert r.status_code == 204

    # Confirm deleted
    r = await client.get(f"/patterns/{pid}", headers=headers)
    assert r.status_code == 404
