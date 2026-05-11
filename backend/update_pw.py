import asyncio
from app.core.database import SessionLocal
from app.models.user import User
from app.core.auth import hash_password
from sqlalchemy import select

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == 'tester@gmail.com'))
        user = result.scalar_one_or_none()
        if user:
            user.password_hash = hash_password('tester123')
            await db.commit()
            print("Password updated!")
        else:
            print("User not found!")

if __name__ == "__main__":
    asyncio.run(main())
