# Meridian API — production image
FROM python:3.12-slim

# System deps: build tools for a few wheels (bcrypt) + curl for healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Python deps first for better layer caching
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# App source
COPY app ./app
COPY scripts ./scripts
# PDFs are ingested at runtime; provide an empty folder so the app can start.
RUN mkdir -p data

EXPOSE 8000

# Render (and most hosts) inject $PORT; honor it so the container isn't marked
# unhealthy when the app binds to something other than 8000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1

# $PORT is provided by most hosts (Railway/Render/Fly); default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
