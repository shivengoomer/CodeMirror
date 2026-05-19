import asyncio
from datetime import UTC, datetime
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.submission import Submission
from app.models.lc_submission_snapshot import LCSubmissionSnapshot
from app.models.leetcode_session import LeetCodeSession
from app.services.leetcode.client import LeetCodeClient

async def backfill():
    async with SessionLocal() as db:
        result = await db.execute(select(Submission.user_id).where(Submission.code_snapshot == "").distinct())
        user_ids = result.scalars().all()

        for user_id in user_ids:
            print(f"Processing user {user_id}")
            sess_res = await db.execute(select(LeetCodeSession).where(LeetCodeSession.user_id == user_id))
            sess = sess_res.scalar_one_or_none()
            if not sess or not sess.leetcode_session:
                print("No session for user")
                continue
            client = LeetCodeClient(sess.leetcode_session, sess.leetcode_csrf, sess.leetcode_headers)

            snap_res = await db.execute(
                select(LCSubmissionSnapshot)
                .where(LCSubmissionSnapshot.user_id == user_id)
                .order_by(LCSubmissionSnapshot.last_synced.desc())
            )
            snaps = snap_res.scalars().all()
            mapping = {}
            for snap in snaps:
                if snap.raw_payload and "submissions" in snap.raw_payload:
                    for raw in snap.raw_payload["submissions"]:
                        slug = raw.get("titleSlug")
                        ts = raw.get("timestamp")
                        lc_id = raw.get("id")
                        if slug and ts and lc_id:
                            mapping[f"{slug}_{ts}"] = lc_id

            subs_res = await db.execute(
                select(Submission)
                .where(Submission.user_id == user_id, Submission.code_snapshot == "")
            )
            subs = subs_res.scalars().all()

            for sub in subs:
                ts = int(sub.submitted_at.timestamp())
                key = f"{sub.problem_slug}_{ts}"
                lc_id = mapping.get(key)
                if not lc_id:
                    # try rough match
                    for k, v in mapping.items():
                        if k.startswith(sub.problem_slug):
                            lc_id = v
                            break
                if lc_id:
                    try:
                        print(f"Fetching code for {sub.problem_slug} (id: {lc_id})")
                        await asyncio.sleep(0.3)
                        detail = await client.get_submission_detail(str(lc_id))
                        code = detail.get("code", "")
                        if code:
                            sub.code_snapshot = code
                            print(" -> SUCCESS")
                    except Exception as e:
                        print(" -> ERROR", e)

            await db.commit()
            print(f"Done user {user_id}")

if __name__ == "__main__":
    asyncio.run(backfill())
