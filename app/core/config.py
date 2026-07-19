import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAI (required — real secret)
    OPENAI_API_KEY: str

    # LangSmith tracing — fully OPTIONAL. Absent key => tracing stays off and the
    # app boots fine (important for a minimal Render env).
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: str | None = None
    LANGCHAIN_PROJECT: str = "meridian"

    # Models — cheapest sensible defaults to protect the ~$10 OpenAI budget.
    OPENAI_CHAT_MODEL: str = "gpt-4.1-2025-04-14"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    # Hard cap on tokens generated per answer (keeps output cost predictable).
    OPENAI_MAX_TOKENS: int = 256

    # Supabase (required — real secrets)
    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str

    # Auth. SECERET_KEY is security-critical -> keep required. The rest get
    # sensible defaults so a missing value never hard-blocks startup.
    decoder: str = "bcrypt"
    ALGORITHM: str = "HS256"
    SECERET_KEY: str
    ACCESS_TOKEN_EXPIRE: int = 60

    # Comma-separated list of allowed frontend origins for CORS.
    # Use "*" for local dev; set your real domain(s) in production.
    CORS_ORIGINS: str = "*"

    # ——— Rate limiting (slowapi syntax: "count/period", stack with ";") ———
    RATE_LIMIT_ENABLED: bool = True
    # /chat is the expensive LLM endpoint — keep it low, keyed per user.
    CHAT_RATE_LIMIT: str = "10/minute;200/day"
    # /login + /createuser — per IP, to blunt brute-force / abuse.
    AUTH_RATE_LIMIT: str = "5/minute"

    # ——— Budget guardrail ($10 total OpenAI cap) ———
    # Global, persistent daily cap on chat calls (all users combined).
    BUDGET_ENABLED: bool = True
    DAILY_CHAT_LIMIT: int = 200

    # Max characters allowed in a single user question (~150 tokens at 600
    # chars). Caps input-token cost while still allowing a detailed question.
    MAX_PROMPT_CHARS: int = 600

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()

# LangSmith tracing only activates when a key is actually present. Without this,
# a stray LANGCHAIN_TRACING_V2=true with no key can make langsmith attempt (and
# retry) network calls on every request.
if settings.LANGCHAIN_TRACING_V2 and settings.LANGCHAIN_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
else:
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
