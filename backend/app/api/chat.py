from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.groq.client import GroqClient
from app.services.groq.prompts import MASTER_SYSTEM_PROMPT, build_coach_context

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("", response_model=ChatResponse)
async def chat_with_coach(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ChatResponse:
    # Build compressed context
    summary = await build_coach_context(current_user.id, db)
    
    full_user_prompt = f"Context: {summary}\nUser: {body.message}"
    
    groq_client = GroqClient()
    response_text = await groq_client.complete_text(
        system_prompt=MASTER_SYSTEM_PROMPT,
        user_prompt=full_user_prompt
    )
    
    return ChatResponse(text=response_text)
