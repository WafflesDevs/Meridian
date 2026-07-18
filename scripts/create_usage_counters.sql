-- Meridian / myRAG — global daily usage counter for the ~$10 OpenAI budget.
-- Run in Supabase Dashboard → SQL Editor (once).
--
-- The app calls increment_chat_usage() before each /chat LLM call. It atomically
-- bumps today's counter and returns the new value; the app rejects the request
-- with a friendly 503 once DAILY_CHAT_LIMIT is exceeded.

create table if not exists usage_counters (
  day date primary key default current_date,
  chat_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Atomic "increment today's count and return it" (race-safe via upsert).
create or replace function increment_chat_usage()
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into usage_counters (day, chat_count)
  values (current_date, 1)
  on conflict (day)
  do update set chat_count = usage_counters.chat_count + 1,
                updated_at = now()
  returning chat_count into new_count;
  return new_count;
end;
$$;
