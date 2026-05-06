from datetime import date
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, repository, schemas, services
from app.config import get_settings
from app.database import get_session, init_db
from app.deps import get_current_user
from prompts import should_run_pattern_aggregation


settings = get_settings()
app = FastAPI(title="AlgoHelp Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def current_user_dep(
    session: SessionDep,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> models.User:
    return await get_current_user(session=session, x_user_id=x_user_id)


UserDep = Annotated[models.User, Depends(current_user_dep)]


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/submission", response_model=schemas.SubmissionOut)
async def receive_submission(
    payload: schemas.SubmissionIn,
    bg: BackgroundTasks,
    session: SessionDep,
    user: UserDep,
) -> models.Submission:
    submission = await repository.store_submission(session, user, payload)
    failure_count = await repository.count_user_failures(session, user.id)
    await session.commit()

    if payload.verdict != "accepted" and should_run_pattern_aggregation(failure_count):
        bg.add_task(_run_pattern_aggregation_task, user.id)

    return submission


@app.get("/submissions", response_model=list[schemas.SubmissionOut])
async def list_submissions(session: SessionDep, user: UserDep, limit: int = 30) -> list[models.Submission]:
    return await repository.list_recent_failed_submissions(session, user.id, limit=limit)


@app.get("/patterns", response_model=list[schemas.PatternOut])
async def list_patterns(session: SessionDep, user: UserDep) -> list[models.Pattern]:
    return await repository.list_patterns(session, user.id)


@app.post("/patterns/reanalyse")
async def reanalyse_patterns(
    payload: schemas.ReanalyseRequest,
    session: SessionDep,
    user: UserDep,
) -> dict:
    return await services.run_pattern_aggregation(session, user.id, limit=payload.limit)


@app.post("/revision/queue", status_code=201)
async def add_revision_item(
    payload: schemas.RevisionQueueIn,
    session: SessionDep,
    user: UserDep,
) -> dict[str, int]:
    item = await repository.add_or_update_revision_item(
        session=session,
        user_id=user.id,
        problem_slug=payload.problem_slug,
        platform=payload.platform,
        linked_pattern_tag=payload.linked_pattern_tag,
        last_verdict=payload.last_verdict,
        interval_days=payload.interval_days,
    )
    item.next_due = payload.next_due
    item.ease_factor = payload.ease_factor
    item.repetitions = payload.repetitions
    await session.commit()
    return {"id": item.id}


@app.post("/revision/session", response_model=schemas.DailySessionOut)
async def create_revision_session(
    payload: schemas.RevisionSessionRequest,
    session: SessionDep,
    user: UserDep,
) -> models.DailySession:
    session_date = payload.today_date or date.today()
    return await services.build_revision_session(
        session=session,
        user_id=user.id,
        today=session_date,
        available_minutes=payload.available_minutes,
    )


@app.post("/weekly-digests", response_model=schemas.WeeklyDigestOut)
async def create_weekly_digest(
    payload: schemas.WeeklyDigestRequest,
    session: SessionDep,
    user: UserDep,
) -> models.WeeklyDigest:
    if payload.week_end < payload.week_start:
        raise HTTPException(status_code=400, detail="week_end must be after week_start")
    return await services.build_weekly_digest(
        session=session,
        user_id=user.id,
        week_start=payload.week_start,
        week_end=payload.week_end,
    )


async def _run_pattern_aggregation_task(user_id: int) -> None:
    from app.database import SessionLocal

    async with SessionLocal() as session:
        await services.run_pattern_aggregation(session, user_id)
