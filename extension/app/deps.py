from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, repository


async def get_current_user(
    session: AsyncSession,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> models.User:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header",
        )
    return await repository.get_or_create_user(session, x_user_id)
