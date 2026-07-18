from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenAI
    OPENAI_API_KEY: str

    # LangSmith tracing
    LANGCHAIN_TRACING_V2: bool = True
    LANGCHAIN_API_KEY: str
    LANGCHAIN_PROJECT: str 

    # Models — cheapest sensible defaults to protect the ~$10 OpenAI budget.
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    # Hard cap on tokens generated per answer (keeps output cost predictable).
    OPENAI_MAX_TOKENS: int = 256

    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str
    decoder:str
    ALGORITHM:str
    SECERET_KEY : str
    ACCESS_TOKEN_EXPIRE:int

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

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()
