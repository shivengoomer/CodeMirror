import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.ai_analysis import AIAnalysis
from app.models.submission import Submission

async def main():
    sub_id = "3ed14202-2d51-456f-a451-e2ecf7d5ad3b"
    async with SessionLocal() as db:
        sub_res = await db.execute(select(Submission).where(Submission.id == sub_id))
        sub = sub_res.scalar_one_or_none()
        if sub:
            print("Submission found:")
            print("  id:", sub.id)
            print("  user_id:", sub.user_id)
            print("  code_snapshot:", sub.code_snapshot)
            print("  analysed:", sub.analysed)
            print("  ai_analysis in submission:", sub.ai_analysis)
        else:
            print("Submission not found in DB!")
            
        anal_res = await db.execute(select(AIAnalysis).where(AIAnalysis.submission_id == sub_id))
        anals = anal_res.scalars().all()
        print(f"\nFound {len(anals)} AIAnalysis records for submission:")
        for a in anals:
            print("  id:", a.id)
            print("  submission_id:", a.submission_id)
            print("  user_id:", a.user_id)
            print("  created_at:", a.created_at)

if __name__ == "__main__":
    asyncio.run(main())
