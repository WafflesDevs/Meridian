"""Global spend guardrail for the ~$10 OpenAI budget.

A single Postgres counter (``usage_counters``) tracks how many chat/LLM calls
happened today across ALL users. Before each expensive LLM call we atomically
increment the counter and, once it passes ``DAILY_CHAT_LIMIT``, reject further
requests with a friendly 503 until the next day.

This is intentionally simple and robust: the increment + read is a single atomic
RPC (see scripts/create_usage_counters.sql), so it is safe under concurrency and
survives restarts / multiple workers.
"""

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.rag import get_supabase


class BudgetExceeded(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Daily budget reached — Meridian has hit its free usage cap for "
                "today. Please try again tomorrow."
            ),
        )


def check_and_increment_chat_budget() -> None:
    """Atomically count this chat call; raise 503 if the daily cap is exceeded.

    Fails open: if the counter backend is unreachable we let the request through
    rather than taking the whole app down, and rely on rate limiting as a second
    line of defense.
    """
    if not settings.BUDGET_ENABLED:
        return

    try:
        result = get_supabase().rpc("increment_chat_usage").execute()
        count = result.data
    except Exception:
        # Counter unavailable — don't hard-fail the user; rate limits still apply.
        return

    if isinstance(count, int) and count > settings.DAILY_CHAT_LIMIT:
        raise BudgetExceeded()
