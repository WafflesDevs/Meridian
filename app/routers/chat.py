import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.rag import rag_answer
from app.core.memory import add_turn, get_history
from app.schemas.schemas import ChatInvoke, LLMRes
from app.core.oauth2 import require_role
from app.core.budget import check_and_increment_chat_budget
from app.core.config import settings
from app.core.ratelimit import limiter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=LLMRes, status_code=status.HTTP_200_OK)
@limiter.limit(settings.CHAT_RATE_LIMIT)
def chat(
    request: Request,
    response: Response,
    payload: ChatInvoke,
    user: dict = Depends(require_role("Explorer")),
):
    thread_id = payload.thread_id or str(uuid.uuid4())

    question = payload.userinput.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    # Reject overly long prompts cheaply, BEFORE spending budget / calling the LLM.
    if len(question) > settings.MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Question is too long ({len(question)} characters). "
                f"Please keep it under {settings.MAX_PROMPT_CHARS} characters."
            ),
        )

    # Global daily spend guardrail (raises 503 once the cap is reached).
    check_and_increment_chat_budget()

    try:
        history = get_history(thread_id)
        result = rag_answer(payload.userinput, chat_history=history)
        add_turn(thread_id, payload.userinput, result.answer)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate answer",
        )

    return LLMRes(
        response=result.answer,
        thread_id=thread_id,
        sources=result.sources,
    )
