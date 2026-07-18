# Meridian

**Grounded medical Q&A over your own documents.**

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://www.langchain.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=uvicorn&logoColor=white)](https://www.uvicorn.org/)

Meridian is a full-stack **agentic RAG** app: FastAPI backend, Supabase/pgvector retrieval, tool-calling LangChain agent, thread-aware chat memory, and a React frontend. Answers come only from indexed PDFs — not the open web.

> **Educational use only.** Meridian is not a diagnosis tool and does not replace a licensed clinician.

---

## Features

- **Agentic RAG** — LLM calls a `search_medical_docs` tool (can rephrase / multi-query) before answering  
- **Document-grounded answers** with OpenAI chat + embeddings  
- **Contextual retrieval** (source/page headers embedded with each chunk)  
- **Supabase + pgvector** cloud vector store  
- **Vector-only search** tuned to avoid statement timeouts  
- **Thread memory** for follow-up questions  
- **JWT auth** — sign up / log in; the chat is locked behind a login (bcrypt + PyJWT)  
- **Role-based** — new users get the `Explorer` role (all features, free)  
- **FastAPI** routes: `/health`, `/chat` (protected), `/source`, `/createuser`, `/login`, `/me`  
- **React frontend** — landing, plans, login/signup, and a protected medical chat UI  
- **LangSmith tracing** support  
- **Deploy-ready** — Dockerfiles, `docker-compose`, and Render/Vercel configs  

---

## Architecture

```text
PDF folder (data/)
        │
        ▼
   chunk + contextualize
        │
        ▼
 Supabase Postgres (pgvector)
        │
        ▼
 FastAPI  ──►  agent (tool-calling)  ──►  search_medical_docs  ──►  answer
        │
        ▼
 React UI (Meridian)
```

| Layer | Stack |
|-------|--------|
| Frontend | React + Vite + TypeScript |
| API | FastAPI + Uvicorn |
| RAG | LangChain + OpenAI |
| Vectors | Supabase (`documents` + `match_documents`) |
| Memory | In-process thread history (`app/core/memory.py`) |

---

## Project structure

```text
myRAG/
├── app/
│   ├── main.py            # FastAPI app + CORS
│   ├── core/
│   │   ├── rag.py         # ingest + retrieve + answer
│   │   ├── memory.py      # chat thread history
│   │   ├── oauth2.py      # JWT create/verify + auth dependencies
│   │   ├── utils.py       # bcrypt password hashing
│   │   └── config.py      # pydantic settings from .env
│   ├── routers/           # /chat (protected) /health /source /createuser /login /me
│   └── schemas/           # request/response models
├── frontend/              # Meridian UI (React + Vite)
│   ├── src/auth/          # AuthContext + RequireAuth (route guard)
│   ├── src/pages/         # Landing, Login, Chat, Plans
│   ├── Dockerfile         # nginx static image
│   └── vercel.json        # SPA routing for Vercel
├── scripts/
│   ├── setup_supabase.sql
│   ├── create_users_table.sql
│   ├── fix_vector_search.sql
│   └── enable_hnsw.sql
├── data/                  # put your PDFs here (gitignored)
├── Dockerfile             # API image
├── docker-compose.yml     # full stack, local
├── render.yaml            # cloud blueprint (API + frontend)
├── .env.example
└── requirements.txt
```

---

## Prerequisites

- Python **3.12+**
- Node.js **18+**
- OpenAI API key  
- Supabase project (URL + **secret** key)  
- Optional: LangSmith key for tracing  

---

## 1. Clone & backend setup

```bash
git clone <your-repo-url>
cd myRAG

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
# fill in OPENAI_* and SUPABASE_* values
```

---

## 2. Supabase (pgvector)

In the Supabase dashboard → **SQL Editor**, run:

[`scripts/setup_supabase.sql`](scripts/setup_supabase.sql)

That creates:

- `vector` extension  
- `documents` table  
- `match_documents(...)` RPC (with a real `LIMIT`)  
- HNSW index for fast similarity search  

Then create the **users** table for auth (run once):

[`scripts/create_users_table.sql`](scripts/create_users_table.sql)

And the **usage counter** for the daily budget guardrail (run once):

[`scripts/create_usage_counters.sql`](scripts/create_usage_counters.sql)

> The login system needs a `role` column. If you created `users` earlier without it, run:
> ```sql
> alter table users add column if not exists role text not null default 'Explorer';
> ```

If search later times out on a large corpus, re-run:

[`scripts/fix_vector_search.sql`](scripts/fix_vector_search.sql)

**Keys:** Project Settings → API → `SUPABASE_URL` + Secret key (`sb_secret_...` or legacy `service_role`).

### Auth environment variables

Add these to `.env` (see `.env.example`):

```bash
decoder=bcrypt
ALGORITHM=HS256
SECERET_KEY=$(openssl rand -hex 32)   # any long random hex string
ACCESS_TOKEN_EXPIRE=60                 # token lifetime in minutes
CORS_ORIGINS=*                         # lock to your frontend origin in prod
```

---

## 3. Add documents

```bash
# place PDFs here (not committed to git)
data/your-medical-docs.pdf
```

Use documents you have rights to publish/demo (e.g. public CDC/WHO/FDA materials). Do **not** commit copyrighted textbooks.

---

## 4. Run the API

```bash
source .venv/bin/activate
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000  
- Docs: http://127.0.0.1:8000/docs  

First `/chat` request will:

1. Load PDFs from `data/`  
2. Chunk + contextualize  
3. Embed + upload any **new** files to Supabase  
4. Answer the question  

Later requests skip already-indexed files.

### Useful API shapes

**`POST /createuser`** → creates an account (role is always `Explorer`)
```json
{ "email": "you@example.com", "password": "at-least-8-chars" }
```

**`POST /login`** → returns a JWT
```json
{ "email": "you@example.com", "password": "at-least-8-chars" }
```
```json
{ "token": "eyJ...", "type": "bearer" }
```

**`POST /chat`** — **requires** `Authorization: Bearer <token>`
```json
{
  "userinput": "What are common flu symptoms?",
  "thread_id": null
}
```

```json
{
  "response": "...",
  "thread_id": "uuid"
}
```

Send the returned `thread_id` on follow-ups to keep conversation memory.

**`GET /me`** (Bearer) → `{ "user_id": "...", "role": "Explorer" }`  
**`GET /source`** → `{ "sources": ["file.pdf", ...] }`  
**`GET /health`** → `{ "Status": "Ok" }`

---

## 5. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

Open http://localhost:5173

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing | Public |
| `/login` | Login / Sign up | Public |
| `/plans` | Plans (Explorer = all features, paid = TBA) | Public |
| `/chat` | Assistant | **Login required** |

The `/chat` route is protected: unauthenticated visitors are redirected to `/login`.
Create an account (you'll be an `Explorer`), and you're taken straight to the chat.

---

## Cost, rate limits & budget guardrails

Meridian runs on a hard **~$10 total OpenAI budget**, so cost control is built in:

**Cheap by default**
- Chat model: `gpt-4o-mini` · Embeddings: `text-embedding-3-small`
- Output capped at `OPENAI_MAX_TOKENS` (default **256**), low temperature
- Tight retrieval (`k=3`) and agent iterations to keep tokens down

**Rate limiting** (via `slowapi`, returns **HTTP 429** with JSON detail)

| Endpoint | Default limit | Keyed on |
|----------|---------------|----------|
| `/chat` | `10/minute;200/day` (`CHAT_RATE_LIMIT`) | authenticated `user_id`, else client IP |
| `/login`, `/createuser` | `5/minute` (`AUTH_RATE_LIMIT`) | client IP |

Toggle with `RATE_LIMIT_ENABLED`.

**Global daily budget cap** — a persistent Supabase counter (`usage_counters`)
is atomically incremented before every LLM call. Once the day's count passes
`DAILY_CHAT_LIMIT` (default **200**), `/chat` returns a friendly **HTTP 503**
("daily budget reached") until the next day. It fails open (never hard-crashes)
if the counter is unreachable, with rate limits as a backstop. Toggle with
`BUDGET_ENABLED`.

> With `gpt-4o-mini` + a 256-token cap, a chat call costs roughly a fraction of
> a cent, so a 200/day cap keeps daily spend well under a dollar — comfortably
> inside the $10 total. Lower `DAILY_CHAT_LIMIT` / `CHAT_RATE_LIMIT` to tighten
> further.

All values are env-overridable — see `.env.example`.

## Configuration knobs (`app/core/rag.py`)

| Variable | Meaning |
|----------|---------|
| `CHUNK_CHARS` | Chunk size |
| `CHUNK_OVERLAP_CHARS` | Overlap between chunks |
| `MAX_PAGES` | Cap pages per PDF (`None` = all) |
| `UPLOAD_BATCH` | Supabase upload batch size |
| `TOP_RESULTS` | Chunks returned per tool search |
| `AGENT_MAX_ITERATIONS` | Max agent tool-call loops per question |

---

## Resetting the vector index

Supabase SQL Editor:

```sql
delete from documents;
```

Then restart the API and ask a question to re-ingest.

---

## Go live 🚀

The app is deploy-ready. Pick one of the paths below.

### Option A — Run the whole stack locally with Docker

```bash
# from repo root, with a filled-in .env
docker compose up --build
```

- API → http://localhost:8000  
- Frontend → http://localhost:5173  

`docker-compose.yml` mounts `./data` into the API so your PDFs get ingested, and
pre-sets `CORS_ORIGINS` to the frontend origin.

### Option B — Deploy to the cloud (recommended)

Three pieces: **Supabase** (already cloud) + **API** + **Frontend**.

**1. Database — Supabase**  
Already hosted. Make sure you ran `scripts/setup_supabase.sql` and
`scripts/create_users_table.sql` in the SQL Editor.

**2. API — Render / Railway / Fly (Docker)**  
A `Dockerfile` is included and reads `$PORT` automatically.

- **Render (easiest):** New → **Blueprint** and point it at this repo — [`render.yaml`](render.yaml) provisions the API + frontend. After the first deploy, fill the secret env vars (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS`) in the dashboard. `SECERET_KEY` is auto-generated.
- **Railway / Fly:** deploy the Dockerfile and set the same env vars. Start command (if not using Docker): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Required API env vars in the host dashboard:

```
OPENAI_API_KEY, OPENAI_CHAT_MODEL, OPENAI_EMBEDDING_MODEL, OPENAI_MAX_TOKENS,
SUPABASE_URL, SUPABASE_SECRET_KEY,
decoder, ALGORITHM, SECERET_KEY, ACCESS_TOKEN_EXPIRE,
CORS_ORIGINS   (= your frontend URL, e.g. https://meridian.vercel.app),
RATE_LIMIT_ENABLED, CHAT_RATE_LIMIT, AUTH_RATE_LIMIT,
BUDGET_ENABLED, DAILY_CHAT_LIMIT
```

**3. Frontend — Vercel / Netlify (static)**  

```bash
# Build settings
Root directory:   frontend
Build command:    npm run build
Output directory: dist
Env var:          VITE_API_URL = https://your-api-host.onrender.com
```

- Vercel: [`frontend/vercel.json`](frontend/vercel.json) already handles SPA routing.  
- Or build the included [`frontend/Dockerfile`](frontend/Dockerfile) (nginx) and host anywhere.

### Go-live checklist ✅

- [ ] `setup_supabase.sql`, `create_users_table.sql` **and** `create_usage_counters.sql` run in Supabase  
- [ ] API env vars set (incl. a strong random `SECERET_KEY`)  
- [ ] `CORS_ORIGINS` set to your **exact** frontend URL (not `*`)  
- [ ] Frontend `VITE_API_URL` points at the **public** API URL  
- [ ] Create an account on `/login`, confirm `/chat` opens and answers  
- [ ] PDFs present (mounted volume locally, or committed/ingested on the host)

---

## Disclaimer

Meridian provides educational information grounded in user-supplied documents. It does not diagnose, treat, or prescribe. Always consult a qualified clinician for medical decisions.

---

## License

Add your preferred license before publishing (MIT is common for portfolio demos).
