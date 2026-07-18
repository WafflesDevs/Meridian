-- Meridian / myRAG — Supabase + pgvector setup
-- Run in Supabase Dashboard → SQL Editor

create extension if not exists vector;

-- LangChain SupabaseVectorStore table shape
create table if not exists documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)  -- text-embedding-3-small
);

-- Similarity search used by app/core/rag.py (SEARCH_FUNCTION = match_documents)
-- FastSupabaseVectorStore passes query_embedding + match_count (+ optional filter)
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int default 4,
  filter jsonb default '{}'
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Fast approximate nearest-neighbor index (cosine)
-- m / ef_construction: better recall for larger medical corpora
drop index if exists documents_embedding_hnsw;

create index documents_embedding_hnsw
  on documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
