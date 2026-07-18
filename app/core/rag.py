"""Meridian RAG: ingest PDFs into Supabase, answer via a tool-calling agent."""

import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langsmith import traceable
from supabase import Client, create_client

from app.core.config import settings
from app.core.memory import format_history

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PDF_FOLDER = PROJECT_ROOT / "data"

load_dotenv(PROJECT_ROOT / ".env")
DB_TABLE = "documents"
SEARCH_FUNCTION = "match_documents"

CHUNK_CHARS = 1800
CHUNK_OVERLAP = 150
UPLOAD_BATCH = 40
EMBED_BATCH = 256
TOP_RESULTS = 3
MAX_RETRIES = 4

AGENT_SYSTEM_PROMPT = """
Your name is Meridian. You answer medical questions using ONLY the
search_medical_docs tool's results — never from your own general knowledge.

Chat history (for understanding follow-ups only, not as a source of facts):
{chat_history}

Rules:
- Call search_medical_docs to look up facts before answering.
- If the question has multiple parts (e.g. "dose AND side effects"), call the
  tool more than once with different, specific queries.
- Judge whether each result is actually relevant. If it isn't, try a
  rephrased query instead of using it.
- If, after searching, you still don't have enough to answer, say "I don't know".
- Keep the final answer to 2-3 sentences.
- Never reveal sensitive information such as emails, SSNs, or passwords.
"""

AGENT_MAX_ITERATIONS = 3


class FastSupabaseVectorStore(SupabaseVectorStore):
    """Pass match_count into RPC so Postgres doesn't sort all rows."""

    def similarity_search_by_vector_with_relevance_scores(
        self,
        query: List[float],
        k: int,
        filter: Optional[Dict[str, Any]] = None,
        postgrest_filter: Optional[str] = None,
        score_threshold: Optional[float] = None,
    ) -> List[Tuple[Document, float]]:
        params: Dict[str, Any] = {
            "query_embedding": query,
            "match_count": k,
        }
        if filter:
            params["filter"] = filter

        res = self._client.rpc(self.query_name, params).execute()
        matches = [
            (
                Document(
                    metadata=row.get("metadata", {}),
                    page_content=row.get("content", ""),
                ),
                row.get("similarity", 0.0),
            )
            for row in res.data
            if row.get("content")
        ]
        if score_threshold is not None:
            matches = [
                (doc, score) for doc, score in matches if score >= score_threshold
            ]
        return matches


@lru_cache
def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)


@lru_cache
def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.OPENAI_CHAT_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=0.2,
    )


@lru_cache
def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.OPENAI_EMBEDDING_MODEL,
        api_key=settings.OPENAI_API_KEY,
        chunk_size=EMBED_BATCH,
    )


def find_pdfs(folder: Path = PDF_FOLDER) -> list[Path]:
    """List PDFs in a folder, returning an empty list if none / folder missing.

    Non-raising — safe for serve-only environments (e.g. Render) where the PDFs
    are not shipped and retrieval runs over the existing Supabase index.
    """
    if not folder.exists():
        return []
    return sorted(folder.glob("*.pdf"))


def list_pdfs(folder: Path = PDF_FOLDER) -> list[Path]:
    """Strict variant used where a corpus is genuinely required (CLI ingest)."""
    paths = find_pdfs(folder)
    if not paths:
        raise FileNotFoundError(f"No PDF files found in {folder.resolve()}")
    return paths


def make_store() -> FastSupabaseVectorStore:
    return FastSupabaseVectorStore(
        client=get_supabase(),
        embedding=get_embeddings(),
        table_name=DB_TABLE,
        query_name=SEARCH_FUNCTION,
        chunk_size=UPLOAD_BATCH,
    )


def indexed_filenames() -> set[str]:
    """Return filenames that already have at least one row in Supabase."""
    names: set[str] = set()
    offset = 0
    page = 1000
    client = get_supabase()
    while True:
        result = (
            client.table(DB_TABLE)
            .select("metadata")
            .range(offset, offset + page - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        for row in rows:
            meta = row.get("metadata") or {}
            source = meta.get("filename") or meta.get("source")
            if source:
                names.add(Path(str(source)).name)
        if len(rows) < page:
            break
        offset += page
    return names


def delete_file_rows(filename: str) -> None:
    """Delete rows for one PDF in small batches (avoids statement timeouts)."""
    client = get_supabase()
    deleted = 0
    while True:
        result = (
            client.table(DB_TABLE)
            .select("id")
            .eq("metadata->>filename", filename)
            .limit(200)
            .execute()
        )
        ids = [row["id"] for row in (result.data or []) if "id" in row]
        if not ids:
            break
        client.table(DB_TABLE).delete().in_("id", ids).execute()
        deleted += len(ids)
        print(f"  cleaned {deleted} row(s) for {filename}")
        time.sleep(0.1)
    if deleted:
        print(f"  cleanup done for {filename}")


def load_pdf_chunks(pdf_path: Path) -> list[Document]:
    print(f"Loading {pdf_path.name}...")
    pages = PyMuPDFLoader(str(pdf_path)).load()
    print(f"  pages: {len(pages)}")

    for page in pages:
        page.metadata["source"] = str(pdf_path)
        page.metadata["filename"] = pdf_path.name
        page.metadata["topic"] = "medical"

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_CHARS,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_documents(pages)

    for chunk in chunks:
        filename = chunk.metadata.get("filename") or pdf_path.name
        page = chunk.metadata.get("page")
        page_number = page + 1 if isinstance(page, int) else (page or "?")
        header = f"Source: {filename} | Page: {page_number} | Topic: medical"
        chunk.metadata["raw_text"] = chunk.page_content
        chunk.metadata["context"] = header
        chunk.page_content = f"{header}\n\n{chunk.page_content}"

    print(f"  -> {len(chunks)} chunks")
    return chunks


def upload_chunks(store: SupabaseVectorStore, chunks: list[Document]) -> None:
    total = len(chunks)
    batch_size = UPLOAD_BATCH
    start = 0

    while start < total:
        end = min(start + batch_size, total)
        batch = chunks[start:end]
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                store.add_documents(batch)
                break
            except Exception as exc:
                is_timeout = "57014" in str(exc) or "timeout" in str(exc).lower()
                if not is_timeout or attempt == MAX_RETRIES:
                    raise
                wait = 0.5 * attempt
                print(
                    f"  timeout at {start}/{total} "
                    f"(retry {attempt}/{MAX_RETRIES} in {wait:.1f}s)"
                )
                time.sleep(wait)
                if batch_size > 10:
                    batch_size = max(10, batch_size // 2)
                    end = min(start + batch_size, total)
                    batch = chunks[start:end]

        start = end
        print(f"  uploaded {start}/{total}")
        time.sleep(0.05)


def ingest(folder: Path = PDF_FOLDER) -> FastSupabaseVectorStore:
    """Chunk + embed + upload any PDFs in data/ that are not yet indexed."""
    store = make_store()
    done = indexed_filenames()
    pdfs = list_pdfs(folder)

    print(f"Found {len(pdfs)} PDF(s). Already indexed: {len(done)}")
    for pdf_path in pdfs:
        if pdf_path.name in done:
            print(f"Skipping (already indexed): {pdf_path.name}")
            continue

        chunks = load_pdf_chunks(pdf_path)
        print(f"Uploading {pdf_path.name} ({len(chunks)} chunks)...")
        try:
            upload_chunks(store, chunks)
        except Exception:
            print(f"  failed on {pdf_path.name} — cleaning partial rows")
            try:
                delete_file_rows(pdf_path.name)
            except Exception as cleanup_exc:
                print(
                    f"  cleanup failed ({cleanup_exc}). Run in Supabase SQL:\n"
                    f"  delete from documents "
                    f"where metadata->>'filename' = '{pdf_path.name}';"
                )
            raise
        print(f"  done: {pdf_path.name}")

    print("Ingest complete.")
    return store


_retriever: VectorStoreRetriever | None = None
_pdf_signature: tuple[str, ...] | None = None


def get_retriever() -> VectorStoreRetriever:
    """Return a cached retriever over the Supabase vector store.

    - If local PDFs exist in data/: ingest any new ones, then build the retriever
      (preserves the local dev workflow).
    - If data/ is empty / missing (serve-only prod, e.g. Render): SKIP ingestion
      and build the retriever directly over the existing Supabase index. Never
      raises FileNotFoundError.
    """
    global _retriever, _pdf_signature

    pdfs = find_pdfs(PDF_FOLDER)
    signature = tuple(f"{p.name}:{p.stat().st_size}" for p in pdfs)
    if _retriever is not None and signature == _pdf_signature:
        return _retriever

    if pdfs:
        store = ingest(PDF_FOLDER)
    else:
        # No local corpus — serve queries straight from the existing Supabase index.
        print("No local PDFs found; serving from existing Supabase index.")
        store = make_store()

    _retriever = store.as_retriever(search_kwargs={"k": TOP_RESULTS})
    _pdf_signature = signature
    print(f"Retriever ready (top={TOP_RESULTS}).")
    return _retriever


def reload_retriever() -> None:
    global _retriever, _pdf_signature
    _retriever = None
    _pdf_signature = None


@traceable(name="retrieve_docs")
def retrieve_docs(question: str) -> list[Document]:
    return get_retriever().invoke(question)


@tool
def search_medical_docs(query: str) -> str:
    """Search indexed medical PDFs for passages relevant to the query."""
    docs = retrieve_docs(query)
    parts = [doc.metadata.get("raw_text") or doc.page_content for doc in docs]
    context = "\n\n".join(parts).strip()
    return context or "No relevant documents found."


@lru_cache
def get_agent_executor() -> AgentExecutor:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", AGENT_SYSTEM_PROMPT),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )
    tools = [search_medical_docs]
    agent = create_tool_calling_agent(get_llm(), tools, prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools,
        max_iterations=AGENT_MAX_ITERATIONS,
        verbose=False,
    )


@traceable(name="rag_answer")
def rag_answer(
    question: str,
    chat_history: list[dict[str, str]] | None = None) -> str:
    result = get_agent_executor().invoke(
        {
            "input": question,
            "chat_history": format_history(chat_history or []),
        }
    )
    return result["output"]


def main() -> None:
    print("PDFs in data/:")
    for path in list_pdfs():
        print(f" - {path.name}")
    print()
    ingest()
    print("\nReady. Start the API with:")
    print("  uvicorn app.main:app --reload")


if __name__ == "__main__":
    main()
