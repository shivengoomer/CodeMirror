import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "status" in body
    assert "database" in body
    assert "groq" in body
