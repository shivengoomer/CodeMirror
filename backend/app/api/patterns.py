from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import PatternImpact
from app.models.pattern import Pattern
from app.models.submission import Submission
from app.models.submission_tag import SubmissionTag
from app.models.user import User
from app.schemas.pattern import PatternCreate, PatternResponse, PatternUpdate
from app.schemas.pattern_detail import PatternDetailResponse
from app.schemas.submission import SubmissionResponse

router = APIRouter(prefix="/patterns", tags=["patterns"])


impact_order = case(
    (Pattern.impact == PatternImpact.CRITICAL, 0),
    (Pattern.impact == PatternImpact.HIGH, 1),
    (Pattern.impact == PatternImpact.MEDIUM, 2),
    (Pattern.impact == PatternImpact.LOW, 3),
    else_=4,
)


@router.get("", response_model=list[PatternResponse])
async def list_patterns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Pattern]:
    result = await db.execute(
        select(Pattern)
        .where(Pattern.user_id == current_user.id)
        .order_by(impact_order, Pattern.occurrence_count.desc(), Pattern.last_seen.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=PatternResponse, status_code=status.HTTP_201_CREATED)
async def create_pattern(
    payload: PatternCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Pattern:
    pattern = Pattern(user_id=current_user.id, **payload.model_dump())
    db.add(pattern)
    await db.commit()
    await db.refresh(pattern)
    return pattern


@router.get("/{pattern_id}", response_model=PatternDetailResponse)
async def get_pattern(
    pattern_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PatternDetailResponse:
    result = await db.execute(select(Pattern).where(Pattern.id == pattern_id, Pattern.user_id == current_user.id))
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")

    linked = await db.execute(
        select(Submission)
        .join(SubmissionTag, SubmissionTag.submission_id == Submission.id)
        .where(SubmissionTag.pattern_id == pattern.id, Submission.user_id == current_user.id)
        .order_by(Submission.submitted_at.desc())
    )
    return PatternDetailResponse(
        pattern=PatternResponse.model_validate(pattern),
        submissions=[SubmissionResponse.model_validate(submission) for submission in linked.scalars().all()],
    )


@router.patch("/{pattern_id}", response_model=PatternResponse)
async def update_pattern(
    pattern_id: UUID,
    payload: PatternUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Pattern:
    result = await db.execute(select(Pattern).where(Pattern.id == pattern_id, Pattern.user_id == current_user.id))
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pattern, key, value)
    await db.commit()
    await db.refresh(pattern)
    return pattern


@router.delete("/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pattern(
    pattern_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Pattern).where(Pattern.id == pattern_id, Pattern.user_id == current_user.id))
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")
    await db.delete(pattern)
    await db.commit()
