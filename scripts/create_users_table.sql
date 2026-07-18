-- Meridian / myRAG — users table for custom JWT auth
-- Run in Supabase Dashboard → SQL Editor
-- App code should hash passwords before INSERT (never store plaintext).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'Explorer',
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (email);

-- If the table already existed without a role column, add it:
alter table users add column if not exists role text not null default 'Explorer';
