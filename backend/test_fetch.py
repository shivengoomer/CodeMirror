import asyncio
from app.core.database import SessionLocal
from sqlalchemy import select
from app.models.leetcode_session import LeetCodeSession
from app.auth.token_manager import TokenManager
import httpx

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(LeetCodeSession).limit(1))
        sess = result.scalar_one_or_none()
        
        if not sess:
            print("No LeetCode sessions found in the database.")
            return

        print(f"Testing for User ID: {sess.user_id}")
        
        cookies = {}
        if sess.leetcode_session:
            cookies['LEETCODE_SESSION'] = sess.leetcode_session
        if sess.leetcode_csrf:
            cookies['csrftoken'] = sess.leetcode_csrf
            
        if not cookies:
            print("Session has no cookies saved.")
            return
            
        print("Sending request to LeetCode...")
        headers = sess.leetcode_headers or {}
        headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        
        async with httpx.AsyncClient(cookies=cookies) as client:
            resp = await client.get(
                "https://leetcode.com/api/submissions/?offset=0&limit=5&lastkey=",
                headers=headers
            )
            print("Status Code:", resp.status_code)
            try:
                data = resp.json()
                print("Keys in response:", data.keys())
                if 'submissions_dump' in data:
                    print(f"Fetched {len(data['submissions_dump'])} submissions.")
                else:
                    print(data)
            except Exception as e:
                print("Failed to parse JSON. Raw text:")
                print(resp.text[:500])

asyncio.run(main())
