from fastapi import FastAPI
from slowapi.errors import RateLimitExceeded

from app.routers import chat, sources, health, users
from app.core.config import settings
from app.core.ratelimit import limiter, rate_limit_exceeded_handler
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Meridian API")

# Rate limiting (slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(sources.router)
app.include_router(users.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/root")
def root():
    return {"Message":"WELCOME"}