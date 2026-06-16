-- Detailed generation and gateway request logging

create extension if not exists pgcrypto;

create table if not exists public.app_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null unique,
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  user_email text,
  user_name text,

  status text not null default 'started'
    check (status in ('started', 'running', 'completed', 'failed', 'cancelled')),
  mode text,
  provider text,
  model text,

  prompt text,
  prompt_hash text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),

  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.app_request_logs (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  trace_id text not null,
  generation_id uuid references public.app_generation_sessions(id) on delete set null,

  user_email text,
  user_name text,

  event_type text not null,
  provider text,
  model text,
  action text,
  method text,
  path text,
  status_code integer check (status_code is null or status_code between 100 and 599),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),

  prompt text,
  prompt_hash text,

  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.set_app_generation_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_generation_sessions_set_updated_at on public.app_generation_sessions;
create trigger trg_app_generation_sessions_set_updated_at
before update on public.app_generation_sessions
for each row
execute function public.set_app_generation_sessions_updated_at();

create index if not exists idx_app_generation_sessions_created_at_desc
  on public.app_generation_sessions (created_at desc);

create index if not exists idx_app_generation_sessions_trace_id
  on public.app_generation_sessions (trace_id);

create index if not exists idx_app_generation_sessions_user_created_at
  on public.app_generation_sessions (user_email, created_at desc);

create index if not exists idx_app_generation_sessions_status_created_at
  on public.app_generation_sessions (status, created_at desc);

create index if not exists idx_app_generation_sessions_mode_created_at
  on public.app_generation_sessions (mode, created_at desc);

create index if not exists idx_app_request_logs_created_at_desc
  on public.app_request_logs (created_at desc);

create index if not exists idx_app_request_logs_trace_created_at
  on public.app_request_logs (trace_id, created_at asc);

create index if not exists idx_app_request_logs_generation_created_at
  on public.app_request_logs (generation_id, created_at asc);

create index if not exists idx_app_request_logs_user_created_at
  on public.app_request_logs (user_email, created_at desc);

create index if not exists idx_app_request_logs_event_created_at
  on public.app_request_logs (event_type, created_at desc);

create index if not exists idx_app_request_logs_provider_created_at
  on public.app_request_logs (provider, created_at desc);

alter table public.app_generation_sessions enable row level security;
alter table public.app_request_logs enable row level security;

-- Block direct client access; the Cloudflare Worker uses the service role key.
drop policy if exists app_generation_sessions_deny_all on public.app_generation_sessions;
create policy app_generation_sessions_deny_all
on public.app_generation_sessions
for all
to public
using (false)
with check (false);

drop policy if exists app_request_logs_deny_all on public.app_request_logs;
create policy app_request_logs_deny_all
on public.app_request_logs
for all
to public
using (false)
with check (false);

revoke all on public.app_generation_sessions from anon, authenticated;
revoke all on public.app_request_logs from anon, authenticated;

grant select, insert, update, delete on public.app_generation_sessions to service_role;
grant select, insert, update, delete on public.app_request_logs to service_role;
grant usage, select on sequence public.app_request_logs_id_seq to service_role;
