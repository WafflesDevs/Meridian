# Meridian — Project Handoff / Transfer Log

> Purpose: transfer full context of this work session to another machine, person, or AI.
> Everything below reflects the **actual repo state** (files read + `git log`) as of commit `c593489`.
> Repo: **WafflesDevs/Meridian**.

---

## 1. Project summary

**Meridian** is a grounded medical Q&A **RAG chatbot**. It answers questions about medicines
and conditions using **only** a curated set of indexed medical PDFs — never the open web — and
says "I don't know" when the corpus doesn't cover the question.

**Stack:**
- **Backend:** FastAPI + a LangChain **tool-calling agent** (`create_tool_calling_agent` /
  `AgentExecutor`) whose single tool searches a Supabase **pgvector** store.
- **Vector DB / data:** Supabase (Postgres + `pgvector`), tables `documents`, `users`,
  `usage_counters`.
- **LLM / embeddings:** OpenAI `gpt-4o-mini` (chat) + `text-embedding-3-small` (embeddings).
- **Frontend:** React + Vite + TypeScript (React Router), oxlint.

**Status: deployed & LIVE on Render (free tier).** See §4.

---

## 2. What was built / changed this session

Real commit history (`git log --oneline`, newest first):

| Hash | Message |
|------|---------|
| `c593489` | Add "Meet the creator" section to landing page |
| `9b93d32` | Tell agent to credit WafflesDevs as its creator when asked |
| `3777913` | Clickable knowledge-base books + WafflesDevs credits footer |
| `a1de255` | Show answer sources (document + page) under each assistant message |
| `23c1d65` | Fix /chat 500 in serve-only prod: retriever works with empty data/ |
| `b40a8b3` | Fix Render 502: optional LangSmith env, healthcheck port, trim unused deps |
| `e68bb4a` | Use Render free plan for API service |
| `5bee567` | Fix slowapi Response injection on rate-limited routes; add README screenshots |
| `74cd781` | Meridian: login-gated agentic RAG, plans, rate limiting, budget guardrails, deploy config |

Grouped logically:

### Auth (`74cd781`)
- JWT login gate on `POST /chat` via `require_role("Explorer")` (`app/core/oauth2.py`).
- `POST /createuser` (defaults new users to role `Explorer`), `POST /login` (returns bearer
  token), `GET /me` (returns `user_id`, `role`, and looks up `email`) — `app/routers/users.py`.
- Passwords hashed with **bcrypt** via passlib `CryptContext` (`app/core/utils.py`).
- Configurable **CORS** (`CORS_ORIGINS`, comma-separated) in `app/core/config.py` + `main.py`.

### Rate limiting — slowapi (`74cd781`, fix in `5bee567`)
- `app/core/ratelimit.py`: `Limiter` keyed on **authenticated user_id** (decoded from Bearer)
  and falling back to **client IP** (`user_or_ip_key`).
- `/chat` uses `CHAT_RATE_LIMIT` (default `10/minute;200/day`); `/login` + `/createuser` use
  `AUTH_RATE_LIMIT` (default `5/minute`) with `key_func=get_remote_address` (per IP).
- Returns **429** JSON via `rate_limit_exceeded_handler`.
- **The slowapi fix (`5bee567`):** every `@limiter.limit(...)` endpoint must declare
  `request: Request` **and** `response: Response` params so slowapi can inject rate-limit
  headers (otherwise it raises `parameter 'response' must be an instance of ... Response`).

### $10 budget guardrails (`74cd781`)
- Cheapest models are defaults: `gpt-4o-mini` + `text-embedding-3-small` (`config.py`).
- **Global daily cap:** `app/core/budget.py` calls the Postgres RPC `increment_chat_usage`
  (atomic counter in `usage_counters`) before each answer; once it exceeds `DAILY_CHAT_LIMIT`
  (default 200) it raises **503** ("Daily budget reached…"). **Fails open** if Supabase is
  unreachable (so the app doesn't hard-die), relying on rate limits as backup.
- ⚠️ **`OPENAI_MAX_TOKENS` (default 256) is defined in config + set in `render.yaml` but is
  NOT currently passed to `ChatOpenAI`** (`get_llm()` only sets `model`, `api_key`,
  `temperature=0.2`). Output length is presently constrained only by the system prompt
  ("Keep the final answer to 2-3 sentences"). See §8 (tech debt).

### Frontend
- **AuthContext** (`frontend/src/auth/AuthContext.tsx`) + **RequireAuth** guard
  (`frontend/src/auth/RequireAuth.tsx`) protecting `/chat`.
- **Login/Signup** page (`frontend/src/pages/Login.tsx`).
- **Username + role in chat header** (`Chat.tsx`, from `/me`).
- **Source citations under answers** (`a1de255`) — small "Sources: doc — p.N · …" line.
- **Clickable knowledge-base books** (`3777913`) — clicking a doc prefills the composer with
  an overview starter question (no auto-send).
- **WafflesDevs footer / credits** (`3777913`) — reusable `components/Credits.tsx` on
  Landing + Plans footers and a compact line under the Chat composer.
- **"Meet the creator" landing section** (`c593489`) — bundled GitHub avatar in a teal ring,
  name/role/bio + GitHub & LinkedIn buttons.

### Plans page
- `Explorer` = **"All Features" / Free** (active). `Practitioner` + `Institution` = **"TBA"**
  and disabled (`frontend/src/pages/Plans.tsx`).

### Deploy config (`74cd781`, `e68bb4a`)
- Backend `Dockerfile`; frontend `frontend/Dockerfile` + `frontend/nginx.conf`;
  `docker-compose.yml` (local); `render.yaml` (Render blueprint, **API on `plan: free`**);
  `frontend/vercel.json` (alt frontend host).

### Production fixes
- `b40a8b3` — **502 fix:** made LangSmith fully optional (`LANGCHAIN_*` default off so a
  missing key never crashes `Settings()` at boot); Docker `HEALTHCHECK` uses `${PORT:-8000}`;
  removed unused heavy deps.
- `23c1d65` — **/chat 500 fix:** `get_retriever()` no longer raises `FileNotFoundError` when
  `data/` is empty (serve-only prod). If PDFs exist locally it ingests new ones; otherwise it
  builds the retriever directly over the existing Supabase index (`find_pdfs` vs strict
  `list_pdfs`).

---

## 3. Architecture & key files

### Backend (`app/`)

| File | Responsibility |
|------|----------------|
| `main.py` | FastAPI app; registers routers (`health`, `chat`, `sources`, `users`), CORS, slowapi limiter + 429 handler; `GET /root`. |
| `core/config.py` | `pydantic-settings` `Settings` (env + `.env`). Required secrets: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SECERET_KEY`. Everything else has defaults. LangSmith optional. |
| `core/rag.py` | Core RAG: PDF ingest, `FastSupabaseVectorStore`, `get_retriever` (lazy/cached, serve-only safe), the `search_medical_docs` tool, the agent, and `rag_answer()` → `RagResult(answer, sources)`. Citations via a `ContextVar`. |
| `core/oauth2.py` | JWT create/decode, `get_current_user`, `require_role(*roles)` dependency. |
| `core/utils.py` | bcrypt `hash_password` / `verify_password` (passlib). |
| `core/memory.py` | **In-memory** chat history keyed by `thread_id` (last 6 msgs). Not persistent. |
| `core/ratelimit.py` | slowapi `Limiter` (user-id-or-IP key) + 429 JSON handler. |
| `core/budget.py` | Global daily spend cap via `increment_chat_usage` RPC → 503 when exceeded (fails open). |
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
| `auth/AuthContext.tsx`, `auth/RequireAuth.tsx` | Auth state + route guard. |
| `pages/Landing.tsx` | Hero, features, how-it-works, promise, **Meet the creator**, footer. |
| `pages/Chat.tsx` | Chat UI: header (user email+role), clickable sources sidebar, messages + per-answer citations, composer, compact credits. |
| `pages/Login.tsx`, `pages/Plans.tsx` | Auth + pricing. |
| `components/` | `Brand.tsx`, `SiteNav.tsx`, `Credits.tsx`. |
| `index.css` | All styling + design tokens (`--ink`, `--sea`, `--sea-deep`, `--mist`, `--muted`, `--line`, `.btn*`, `.site-footer`, `.creator*`, `.source-item`, `.message-sources`). |

### Request/data flow — a `POST /chat` call
1. Frontend `sendChat()` → `POST /chat` with `Authorization: Bearer <token>` and
   `{ userinput, thread_id }`.
2. `require_role("Explorer")` decodes the JWT → **401** (bad/expired) / **403** (wrong role).
3. Empty input → **400**.
4. `check_and_increment_chat_budget()` → atomic RPC; over `DAILY_CHAT_LIMIT` → **503**.
5. `get_history(thread_id)` from in-memory store.
6. `rag_answer()` runs the agent (`max_iterations=3`); the agent calls `search_medical_docs`,
   which calls `retrieve_docs()` → retriever → `FastSupabaseVectorStore` similarity search via
   the `match_documents` RPC (top **k=3**).
7. Agent answers **only** from tool results, 2–3 sentences.
8. Sources are collected (see below); `add_turn()` saves Q/A to memory.
9. Returns `LLMRes { response, thread_id, sources }`. Unhandled errors → **500**.

### Citations mechanism (ContextVar)
- `rag.py` holds `_retrieved_sources: ContextVar[list[Document] | None]`.
- `rag_answer()` sets a **fresh list** at the start (`.set([])`) and `reset()`s it in `finally`.
- `retrieve_docs()` appends every retrieved `Document` to that bucket.
- After the agent finishes, `collect_sources()` dedupes by `(filename, page)`, converts page to
  **1-based**, sorts (filename, page), caps at **5**, and builds a readable `label`
  (strips `.pdf`/`-WEB`, underscores→spaces), e.g. `microbiology — p.42`.
- Empty retrieval → empty `sources` (frontend shows nothing).

---

## 4. Deployment (LIVE)

**Hosting:** Render (free tier), two services defined in `render.yaml`:
- `meridian-api` — Docker web service, `plan: free`, health check `/health`.
- `meridian-frontend` — static site (`cd frontend && npm ci && npm run build`, publish
  `frontend/dist`, SPA rewrite `/* → /index.html`).

| Service | URL |
|---------|-----|
| API | https://meridian-api-f0u0.onrender.com (health: `/health`) |
| Frontend | https://meridian-frontend-df2r.onrender.com |
| Data | Supabase (Postgres + pgvector; tables `documents`, `users`, `usage_counters`) |

> Note: Render free web services **spin down when idle**, so the first request after idle is slow.

### Required environment variables (API service)

| Var | Notes |
|-----|-------|
| `OPENAI_API_KEY` | **secret** (required) |
| `SUPABASE_URL` | **secret** (required) |
| `SUPABASE_SECRET_KEY` | **secret** (required) |
| `SECERET_KEY` | **secret**, JWT signing key (required). Spelling is intentional — matches code. On Render it's `generateValue: true`. |
| `decoder` | `bcrypt` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE` | `60` (minutes) |
| `CORS_ORIGINS` | **Must exactly match the frontend URL**, e.g. `https://meridian-frontend-df2r.onrender.com` |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `OPENAI_MAX_TOKENS` | `256` (defined/set; not yet wired to the LLM — see §8) |
| `RATE_LIMIT_ENABLED` | `true` |
| `CHAT_RATE_LIMIT` | `10/minute;200/day` |
| `AUTH_RATE_LIMIT` | `5/minute` |
| `BUDGET_ENABLED` | `true` |
| `DAILY_CHAT_LIMIT` | `200` |
| `LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` | **optional** (tracing off by default) |

**Frontend env:** `VITE_API_URL` = the API URL. ⚠️ Vite **bakes env vars at build time**, so
changing `VITE_API_URL` requires a **frontend redeploy/rebuild**, not just a restart.
Likewise, if the frontend URL changes, update `CORS_ORIGINS` on the API.

### Supabase SQL — run once (in the Supabase SQL editor)
| Script | Creates |
|--------|---------|
| `scripts/setup_supabase.sql` | `pgvector` + `documents` table + `match_documents` RPC |
| `scripts/create_users_table.sql` | `users` table (incl. `role` column) |
| `scripts/create_usage_counters.sql` | `usage_counters` table + atomic `increment_chat_usage` RPC |

Optional/index tuning also present: `scripts/enable_hnsw.sql`, `scripts/fix_vector_search.sql`.

---

## 5. Knowledge base / corpus status

- The API reads vectors **live** from the Supabase `documents` table. **PDFs are NOT deployed**
  — they live only in local `data/` (gitignored: `data/*` except `.gitkeep`) and are embedded +
  uploaded via `python -m app.core.rag`.
- **Capacity reality (important):** Supabase free tier is **500 MB**. Real usage is roughly
  **~30 KB per chunk** at **~2.1 chunks/page**, so **~30k pages is NOT possible** — the
  practical ceiling is roughly **~14–16k chunks**. Plan the corpus around that, not raw page
  counts.
- The corpus was **trimmed to 7 PDFs** (targeting ~350 MB) currently in `data/`:

| PDF (in `data/`) | Local size |
|------------------|-----------:|
| `microbiology_-_WEB.pdf` | ~332 MB |
| `medical-surgical-nursing.pdf` | ~73 MB |
| `pharmacology-for-nurses.pdf` | ~47 MB |
| `nutrition-for-nurses.pdf` | ~32 MB |
| `where-there-is-no-doctor.pdf` | ~10 MB |
| `cdc-pink-book-vaccine-preventable-diseases.pdf` | ~5.7 MB |
| `who-essential-medicines-list-2023.pdf` | ~0.9 MB |

  (Local PDF byte size ≠ Supabase footprint; footprint is driven by **chunk count**, per above.)
- **Reset the index:** `truncate table documents;` in Supabase, then re-run ingest.
- **Add PDFs:** drop them in `data/`, run `python -m app.core.rag` (ingest dedupes by filename).
  **No redeploy needed** — the API reads Supabase live.

---

## 6. Run locally

### Backend
```bash
cd myRAG
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# create .env with at least:
#   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY, SECERET_KEY
#   decoder=bcrypt, ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE=60
#   CORS_ORIGINS=http://localhost:5173
uvicorn app.main:app --reload        # http://127.0.0.1:8000  (docs at /docs)
```
Ingest the corpus (embeds `data/*.pdf` → Supabase): `python -m app.core.rag`

### Frontend
```bash
cd frontend
npm install
# set VITE_API_URL (e.g. in frontend/.env): VITE_API_URL=http://127.0.0.1:8000
npm run dev          # http://localhost:5173
npm run lint         # oxlint
npm run build        # tsc + vite
```
See `README.md` for more detail.

---

## 7. Redeploy

- **Code change:** commit → push to `origin/main` → in Render, **Manual Deploy** the
  `meridian-api` service; **redeploy the frontend** (fresh Vite build) if any frontend/env
  (`VITE_API_URL`) changed.
- **Data change only** (new/removed PDFs): re-run `python -m app.core.rag` locally (or
  `truncate table documents;` then re-ingest). **No redeploy** — the API reads Supabase live.
- **Env change:** update in the Render dashboard; API picks it up on next deploy/restart;
  frontend env requires a rebuild.

---

## 8. Known caveats / tech debt

- **In-memory chat history** (`app/core/memory.py`) — lost on restart and **not multi-worker
  safe** (each worker/instance has its own dict). Fine for a single free-tier instance; move to
  Postgres/Redis for scale.
- **Rate-limit windows are per-worker/in-memory** (slowapi default storage) while the **budget
  cap is shared** (Postgres). With multiple workers the effective rate limit multiplies; the
  budget cap stays global.
- **`OPENAI_MAX_TOKENS` is not wired into the LLM.** It exists in config and `render.yaml` but
  `get_llm()` doesn't pass `max_tokens=` to `ChatOpenAI`; output is bounded only by the prompt's
  "2-3 sentences" instruction. Wire it up if you want a hard token cap.
- **Budget fails open** — if Supabase is unreachable the budget check lets requests through
  (by design), so rate limiting is the only guard in that window.
- **`GET /source` scans all `documents.metadata`** to list filenames — fine now, but a full
  scan that could get slow on a large corpus.
- **Licensing:** most corpus docs are **non-commercial / attribution** licensed (OpenStax nursing
  titles are CC BY-NC-SA; WHO/Hesperian have non-commercial terms). **Keep the app free and
  attribute sources**; don't put these behind paid tiers without checking each license. The CDC
  Pink Book is a **public-domain** mirror.
- **`SECERET_KEY` is intentionally misspelled** in code/env — keep it as-is or refactor
  everywhere at once.
- **Creator bio placeholder:** the "Meet the creator" section on the landing page still contains
  a `{/* TODO: Ayaan — edit your bio here */}` comment — personalize the bio text. (Display name
  is "Ayaan Ali"; GitHub `name` field is "Wafflez", bio "A FullStack Developer".)
- Working tree may carry uncommitted local edits (e.g. an agent-prompt tweak) — check
  `git status` before syncing machines.

---

_Last updated for commit `c593489`. Regenerate `git log --oneline -20` after further changes._
