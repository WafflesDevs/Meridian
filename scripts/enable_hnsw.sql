-- Enable HNSW on documents.embedding (fast vector search for Meridian)
-- Run in Supabase Dashboard → SQL Editor → Run

create extension if not exists vector;

-- Cosine-distance HNSW index (matches <=> in match_documents)
drop index if exists documents_embedding_hnsw;

create index documents_embedding_hnsw
  on documents
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Verify
select indexname, indexdef
from pg_indexes
where tablename = 'documents'
  and indexname = 'documents_embedding_hnsw';
