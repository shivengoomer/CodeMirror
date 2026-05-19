"""Roadmap API — AI-powered learning paths and progress tracking."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.roadmap import Roadmap

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


class RoadmapCreateRequest(BaseModel):
    goal: str
    timeline_weeks: int = 12
    target_company: str | None = None
    target_role: str | None = None


@router.get("")
async def get_current_roadmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Roadmap)
        .where(Roadmap.user_id == current_user.id, Roadmap.status == "active")
        .order_by(Roadmap.created_at.desc())
    )
    roadmap = result.scalar_one_or_none()
    if not roadmap:
        return {"status": "no_active_roadmap"}
    return {
        "id": str(roadmap.id),
        "goal": roadmap.goal,
        "timeline_weeks": roadmap.timeline_weeks,
        "target_company": roadmap.target_company,
        "target_role": roadmap.target_role,
        "weekly_plan": roadmap.weekly_plan,
        "milestones": roadmap.milestones,
        "current_week": roadmap.current_week,
        "completion_percentage": roadmap.completion_percentage,
        "status": roadmap.status,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_roadmap(
    body: RoadmapCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    roadmap = Roadmap(
        user_id=current_user.id,
        goal=body.goal,
        timeline_weeks=body.timeline_weeks,
        target_company=body.target_company,
        target_role=body.target_role,
        weekly_plan=[],
        milestones=[],
    )
    db.add(roadmap)
    await db.commit()
    await db.refresh(roadmap)
    return {"id": str(roadmap.id), "status": "created"}


@router.put("/{roadmap_id}")
async def update_roadmap_progress(
    roadmap_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == current_user.id)
    )
    roadmap = result.scalar_one_or_none()
    if not roadmap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found")
    roadmap.current_week = min(roadmap.current_week + 1, roadmap.timeline_weeks or 12)
    roadmap.completion_percentage = (roadmap.current_week / (roadmap.timeline_weeks or 12)) * 100
    await db.commit()
    return {"status": "updated", "current_week": roadmap.current_week}
