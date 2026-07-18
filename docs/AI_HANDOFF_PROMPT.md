# Meridian — Handoff Prompt for the Next AI Assistant

> Paste this whole file into a fresh AI coding assistant to continue work on Meridian with full
> context. It is written as a briefing addressed to **you** (the AI). It is self-contained; a
> longer human-readable version lives at `docs/PROJECT_LOG.md`. Everything here reflects the
> real repo state as of commit `aa14f85`.

---

## 1. Your role

You are continuing work on **Meridian**, a **production, deployed** medical Q&A **RAG** app.
Treat it as live software with real users' expectations: don't break the deployed API or
frontend, don't leak secrets, and prefer small, verified changes. Everything you need is below.

Repo: **github.com/WafflesDevs/Meridian**. Non-secret work is pushed **directly to `main`**.

---

## 2. Project overview

Meridian answers questions about medicines and conditions **only** from a curated set of indexed
medical PDFs, using a **LangChain tool-calling agent** that must call a search tool before
answering. If the corpus doesn't support an answer, it replies **"I don't know"** — it must not
fall back to the model's general knowledge.

**Stack:**
- **Backend:** FastAPI + Uvicorn (Python 3.12).
- **Agent:** `langchain-classic` tool-calling agent (`create_tool_calling_agent` + `AgentExecutor`,
  `max_iterations=3`) with one tool: `search_medical_docs`.
- **LLM / embeddings:** OpenAI `gpt-4o-mini` (chat) + `text-embedding-3-small` (embeddings).
- **Vector DB:** Supabase Postgres + `pgvector` (HNSW index), RPC `match_documents`.
- **Frontend:** React 19 + Vite + TypeScript (React Router), oxlint.

---

## 3. Architecture & key files

### Backend (`app/`)
| File | Responsibility |
|------|----------------|
| `main.py` | FastAPI app; registers routers (`health`, `chat`, `sources`, `users`), CORS, slowapi limiter + 429 handler; also `GET /root`. |
| `core/config.py` | `pydantic-settings` `Settings` reading env + `.env`. Required secrets: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SECERET_KEY`. Everything else has defaults. LangSmith optional. |
| `core/rag.py` | Heart of the app: PDF ingest, `FastSupabaseVectorStore`, `get_retriever` (lazy/cached; serve-only safe), the `search_medical_docs` tool, the agent, `get_llm()`, and `rag_answer()`. Source citations use a `ContextVar`. |
| `core/oauth2.py` | JWT `create_access_token` / `decode_access_token`, `get_current_user`, `require_role(*roles)`. |
| `core/utils.py` | bcrypt `hash_password` / `verify_password` (passlib `CryptContext`, scheme from `decoder`). |
| `core/memory.py` | **In-memory** chat history keyed by `thread_id` (keeps last 6 messages). Not persistent, not multi-worker safe. |
| `core/ratelimit.py` | slowapi `Limiter`, key = authenticated `user_id` (from Bearer) else client IP; 429 JSON handler. |
| `core/budget.py` | Global daily spend cap: calls Postgres RPC `increment_chat_usage`; raises **503** once over `DAILY_CHAT_LIMIT`. **Fails open** if Supabase is unreachable. |
| `routers/chat.py` | `POST /chat` — Explorer-gated, rate-limited, budget-checked; returns answer + sources. |
| `routers/users.py` | `POST /createuser`, `POST /login`, `GET /me` (auth routes rate-limited per IP). |
| `routers/sources.py` | `GET /source` — distinct indexed filenames from `documents.metadata`. |
| `routers/health.py` | `GET /health` → `{"Status":"Ok"}` (Render health check). |
| `schemas/schemas.py` | Pydantic models: `ChatInvoke`, `LLMRes` (+ `Source`), `Createuser`, `ReturnCreate`, `CurrentUser`, `LoginUser`, `TokenReturn`. |

### Frontend (`frontend/src/`)
| Path | Responsibility |
|------|----------------|
| `App.tsx` | Routes: `/` Landing, `/login` Login, `/plans` Plans, `/chat` → `RequireAuth`→Chat, `*`→`/`. |
| `api.ts` | `API_URL = VITE_API_URL`; `signup`/`login`/`fetchMe`/`sendChat`/`fetchSources`/`checkHealth`; token in `localStorage`; `Source` + `ChatResponse` types. |
| `auth/AuthContext.tsx`, `auth/RequireAuth.tsx` | Auth state + `/chat` route guard. |
| `pages/{Landing,Chat,Plans,Login}.tsx` | Pages. `Chat.tsx` has the header (email+role), clickable sources sidebar, per-answer citations, composer. |
| `components/` | `Brand.tsx`, `SiteNav.tsx`, `Credits.tsx`. |
| `index.css` | All styling + design tokens (`--ink`, `--sea`, `--sea-deep`, `--mist`, `--muted`, `--line`, `.btn*`, `.creator*`, `.source-item`, `.message-sources`). |

### `POST /chat` request flow
1. Frontend `sendChat()` → `POST /chat` with `Authorization: Bearer <token>` and
   `{ userinput, thread_id }`.
2. `require_role("Explorer")` decodes JWT → **401** (bad/expired) / **403** (wrong role).
3. Empty input → **400**.
4. `check_and_increment_chat_budget()` → atomic RPC; over `DAILY_CHAT_LIMIT` → **503**.
5. `get_history(thread_id)` from in-memory store.
6. `rag_answer()` runs the agent; the agent calls `search_medical_docs` → `retrieve_docs()` →
   retriever → `FastSupabaseVectorStore` similarity search via `match_documents` RPC (top **k=3**).
7. Agent answers **only** from tool output, 2–3 sentences (and `get_llm()` enforces
   `max_tokens=OPENAI_MAX_TOKENS`).
8. Sources collected (below); `add_turn()` saves Q/A to memory.
9. Returns `LLMRes { response, thread_id, sources }`. Unhandled errors → **500**.

### How source citations are captured (ContextVar)
- `rag.py` holds `_retrieved_sources: ContextVar[list[Document] | None]`.
- `rag_answer()` sets a fresh list (`.set([])`) at the start and `reset()`s in `finally`.
- `retrieve_docs()` **appends** every retrieved `Document` to that bucket.
- After the agent finishes, `collect_sources()` dedupes by `(filename, page)`, makes page
  **1-based**, sorts, caps at **5**, and builds a readable `label` (strips `.pdf`/`-WEB`,
  underscores→spaces), e.g. `microbiology — p.42`.
- Each source is `Source { filename: str, page: int | None, label: str }`; empty retrieval →
  empty list (frontend renders nothing).

---

## 4. Current deployed state (LIVE)

**Hosting:** Render (free tier), 2 services defined in `render.yaml`:
- `meridian-api` — Docker web service, `plan: free`, health check `/health`.
- `meridian-frontend` — static site (Vite build, SPA rewrite `/* → /index.html`).

| Service | URL |
|---------|-----|
| API | https://meridian-api-f0u0.onrender.com (health: `/health`) |
| Frontend | https://meridian-frontend-df2r.onrender.com |
| Data | Supabase (Postgres + pgvector) |

> Render free web services **spin down when idle** — first request after idle is slow (cold start).

**Supabase:** the user **recently migrated to a NEW Supabase project**. The URL/keys live in
**env vars only** (never in git). Tables: `documents` (vectors), `users`, `usage_counters`;
RPC `match_documents` (+ `increment_chat_usage`). If you re-point Supabase, re-run the SQL
scripts in `scripts/` (`setup_supabase.sql`, `create_users_table.sql`,
`create_usage_counters.sql`; optional `enable_hnsw.sql`, `fix_vector_search.sql`) and re-ingest.

### Required environment variables (API)
| Var | Value / note |
|-----|--------------|
| `OPENAI_API_KEY` | **secret** |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `OPENAI_MAX_TOKENS` | `256` (now enforced in `get_llm()`) |
| `SUPABASE_URL` | **secret** (new project) |
| `SUPABASE_SECRET_KEY` | **secret** (new project) |
| `SECERET_KEY` | **secret**, JWT signing key. ⚠️ **Intentional misspelling — do NOT "fix" it.** |
| `decoder` | `bcrypt` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE` | `60` (minutes) |
| `CORS_ORIGINS` | **Must EXACTLY equal the frontend URL** (`https://meridian-frontend-df2r.onrender.com`) |
| `RATE_LIMIT_ENABLED` | `true` |
| `CHAT_RATE_LIMIT` | `10/minute;200/day` |
| `AUTH_RATE_LIMIT` | `5/minute` |
| `BUDGET_ENABLED` | `true` |
| `DAILY_CHAT_LIMIT` | `200` |
| `LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` | **optional** (off by default) |

**Frontend:** `VITE_API_URL` = the API URL. ⚠️ Vite **bakes env at build time** → to change it
you must **redeploy/rebuild the frontend**, not just restart. If the frontend URL changes,
update `CORS_ORIGINS` on the API to match exactly.

---

## 5. What has been built (real commit hashes)

`git log --oneline` (newest first):

| Hash | Message |
|------|---------|
| `aa14f85` | Enforce OPENAI_MAX_TOKENS hard cap on LLM output (budget guardrail) |
| `69032c0` | Add project handoff/transfer log |
| `c593489` | Add "Meet the creator" section to landing page |
| `9b93d32` | Tell agent to credit WafflesDevs as its creator when asked |
| `3777913` | Clickable knowledge-base books + WafflesDevs credits footer |
| `a1de255` | Show answer sources (document + page) under each assistant message |
| `23c1d65` | Fix /chat 500 in serve-only prod: retriever works with empty data/ |
| `b40a8b3` | Fix Render 502: optional LangSmith env, healthcheck port, trim unused deps |
| `e68bb4a` | Use Render free plan for API service |
| `5bee567` | Fix slowapi Response injection on rate-limited routes; add README screenshots |
| `74cd781` | Meridian: login-gated agentic RAG, plans, rate limiting, budget guardrails, deploy config |

Summary of capabilities:
- **Auth** (`74cd781`): login-gate on `/chat` via `require_role("Explorer")`;
  `/createuser` (new users → role `Explorer`), `/login` (bearer token), `/me`; bcrypt hashing;
  configurable CORS.
- **Rate limiting** (`74cd781`, fix `5bee567`): slowapi, per-user `/chat`, per-IP auth routes;
  **every rate-limited route must declare `request: Request` and `response: Response` params**
  (that's the `5bee567` fix — otherwise slowapi errors injecting headers).
- **$10 budget guardrails** (`74cd781`, `aa14f85`): `gpt-4o-mini`, `max_tokens` now wired into
  `get_llm()`, and a Postgres `usage_counters` daily cap → **503** when exceeded.
- **Source citations** (`a1de255`): per-answer `Source{filename,page,label}` via ContextVar.
- **Frontend**: AuthContext + Login page + username/role in header; clickable KB books
  (prefill composer, no auto-send) (`3777913`); WafflesDevs footer/credits (`3777913`);
  "Meet the creator" landing section (`c593489`).
- **Plans**: Explorer = "All Features"/free (active); Practitioner + Institution = "TBA"/disabled.
- **Deploy config** (`74cd781`, `e68bb4a`): `Dockerfile`, `frontend/Dockerfile` + `nginx.conf`,
  `docker-compose.yml`, `render.yaml` (API free plan), `frontend/vercel.json`.
- **Prod fixes**: LangSmith made optional so `Settings()` can't crash on boot (`b40a8b3`);
  Docker healthcheck uses `${PORT:-8000}` (`b40a8b3`); retriever serves from Supabase when
  `data/` is empty (`23c1d65`).

---

## 6. Corpus / storage reality

- The API reads vectors **live** from Supabase's `documents` table. **PDFs are not deployed** —
  they live only in local `data/` (gitignored: `data/*` except `.gitkeep`) and are embedded +
  uploaded via `python -m app.core.rag`. **Adding/removing PDFs needs NO redeploy** — the API
  reads Supabase live.
- **Capacity reality:** Supabase free tier is **500 MB**. Real usage ≈ **~30 KB per chunk** at
  **~2.1 chunks/page**, so the practical ceiling is roughly **~14–16k chunks — NOT ~30k pages.**
  Budget by chunk count, not page count.
- Corpus was **trimmed to 7 PDFs** (targeting ~350 MB), currently in `data/`:
  `microbiology_-_WEB.pdf`, `medical-surgical-nursing.pdf`, `pharmacology-for-nurses.pdf`,
  `nutrition-for-nurses.pdf`, `cdc-pink-book-vaccine-preventable-diseases.pdf`,
  `where-there-is-no-doctor.pdf`, `who-essential-medicines-list-2023.pdf`.
- **Reset the index:** `truncate table documents;` in Supabase, then re-run
  `python -m app.core.rag` (ingest dedupes by filename).

---

## 7. Conventions & gotchas you MUST respect

- **Keep `SECERET_KEY` spelled exactly like that** in code and env — it's used everywhere; do
  not "correct" it.
- **Role is always `"Explorer"`** on signup, and `/chat` requires that role. Don't change the
  default role or the gate without being asked.
- **Never commit secrets** (`.env` is gitignored) or the **large PDFs** (`data/*` gitignored,
  except `.gitkeep`).
- **Rate-limited routes need `request: Request` + `response: Response` params** (slowapi header
  injection). Preserve them on `/chat`, `/login`, `/createuser`.
- **Chat history is in-memory** (`core/memory.py`) — lost on restart, **not multi-worker safe**.
- **slowapi limits are per-worker/in-memory**, while the **budget cap is Postgres-shared**
  (global). With >1 worker the effective rate limit multiplies; the budget stays global.
- **Budget fails open** — if Supabase is down, chat requests pass (rate limits are the backup).
- **Licensing:** most corpus docs are **non-commercial / attribution** (OpenStax nursing titles
  CC BY-NC-SA; WHO/Hesperian non-commercial; CDC Pink Book is public-domain mirror). **Keep the
  app free and attribute sources**; don't put them behind paid tiers without checking licenses.
- **Non-secret work is pushed directly to `main`.** Verify before pushing (see §8).

---

## 8. How to run locally & redeploy

### Run locally
**Backend:**
```bash
cd myRAG
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# .env needs at least: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SECERET_KEY,
#   decoder=bcrypt, ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE=60, CORS_ORIGINS=http://localhost:5173
uvicorn app.main:app --reload        # http://127.0.0.1:8000  (Swagger at /docs)
python -m app.core.rag               # ingest data/*.pdf → Supabase
```
**Frontend:**
```bash
cd frontend
npm install
# frontend/.env: VITE_API_URL=http://127.0.0.1:8000
npm run dev            # http://localhost:5173
npm run lint           # oxlint  — MUST pass
npm run build          # tsc + vite — MUST pass
```

### Verify before pushing
- Backend: confirm `app.main` imports/boots and `/health` returns 200.
- Frontend: `npm run lint` **and** `npm run build` both pass.

### Redeploy
- **Code change:** commit → push `origin/main` → Render **Manual Deploy** `meridian-api`; if any
  frontend or `VITE_API_URL` change, **redeploy the frontend** (fresh Vite build).
- **Data change only:** re-run `python -m app.core.rag` (or `truncate table documents;` then
  re-ingest). **No redeploy.**
- **Env change:** update in Render dashboard; API applies on next deploy/restart; frontend env
  requires a rebuild.

---

## 9. Open TODOs / suggested next steps

- **Personalize the creator bio** — `frontend/src/pages/Landing.tsx` has a
  `{/* TODO: Ayaan — edit your bio here */}` placeholder in the "Meet the creator" section.
  (Display name "Ayaan Ali"; GitHub `name` is "Wafflez".)
- **Shared/persistent state** — consider Redis (or Postgres) for slowapi storage (so limits are
  shared across workers) and for persistent, multi-worker-safe chat memory (replace
  `core/memory.py`).
- **Verify licenses before any monetization** — most corpus docs are non-commercial.
- **Storage optimization** — consider dropping the `metadata.raw_text` duplication in stored
  chunks (each chunk stores both the prefixed `page_content` and a `raw_text` copy) to reduce
  Supabase footprint and fit more of the corpus under 500 MB.
- Regenerate `git log --oneline -25` to refresh commit hashes after further work.

---

_Briefing current as of commit `aa14f85`. See `docs/PROJECT_LOG.md` for the fuller human-readable log._
