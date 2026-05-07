import pytest


@pytest.mark.asyncio
async def test_register_login_me_refresh(client):
    # Register
    email = "test+auth@example.com"
    payload = {
        "email": email,
        "password": "password123",
        "leetcode_username": "lc_user",
        "gfg_username": None,
        "hackerrank_username": None,
        "timezone": "UTC",
        "available_minutes_per_day": 20,
    }
    r = await client.post("/auth/register", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data and "refresh_token" in data and "user" in data

    access = data["access_token"]
    refresh = data["refresh_token"]

    # Me
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    me = r.json()
    assert me["email"] == email.lower()

    # Login
    r = await client.post("/auth/login", json={"email": email, "password": "password123"})
    assert r.status_code == 200
    data2 = r.json()
    assert "access_token" in data2 and "refresh_token" in data2

    # Refresh
    r = await client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    refdata = r.json()
    assert "access_token" in refdata and "refresh_token" in refdata
