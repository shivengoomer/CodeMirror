import asyncio
from app.core.database import SessionLocal
from sqlalchemy import select
from app.models.user import User

async def main():
    async with SessionLocal() as db:
        users = await db.execute(select(User))
        for u in users.scalars():
            print(f"User: {u.email}, LC Username: {u.leetcode_username}")

asyncio.run(main())
