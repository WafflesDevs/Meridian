"""Rate limiting for the Meridian API (slowapi).

The default key function keys limits on the authenticated user_id (decoded from
the Bearer token) when present, and falls back to the client IP otherwise. Auth
routes (login / createuser) pass ``key_func=get_remote_address`` explicitly so
they are always limited per IP.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.oauth2 import decode_access_token


def user_or_ip_key(request: Request) -> str:
    """Prefer the authenticated user id; fall back to the client IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[len("Bearer ") :].strip()
        try:
            payload = decode_access_token(token)
            user_id = payload.get("user_id")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=user_or_ip_key,
    enabled=settings.RATE_LIMIT_ENABLED,
    headers_enabled=True,
)


def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Rate limit exceeded. Please slow down and try again shortly."
            ),
            "limit": str(exc.limit.limit),
        },
    )
