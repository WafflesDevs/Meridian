-- If match_documents times out on a large corpus, re-run this in the SQL Editor.
-- Ensures LIMIT is applied and the HNSW index exists.

create extension if not exists vector;

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

drop index if exists documents_embedding_hnsw;

create index documents_embedding_hnsw
  on documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
