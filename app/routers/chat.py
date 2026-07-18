import uuid

from fastapi import APIRouter, HTTPException, status,Depends

from app.core.rag import rag_answer
from app.core.memory import add_turn, get_history
from app.schemas.schemas import ChatInvoke, LLMRes
from app.core.oauth2 import require_role,get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=LLMRes, status_code=status.HTTP_200_OK)
def chat(payload: ChatInvoke , user: dict = Depends(require_role("Explorer"))):
    thread_id = payload.thread_id or str(uuid.uuid4())

    if not payload.userinput.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    try:
        history = get_history(thread_id)
        answer = rag_answer(payload.userinput, chat_history=history)
        add_turn(thread_id, payload.userinput, answer)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate answer",
        )

    return LLMRes(response=answer, thread_id=thread_id)
