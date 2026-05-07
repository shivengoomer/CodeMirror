from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/unread")
async def unread_notifications(
    current_user: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    _ = current_user
    return []
