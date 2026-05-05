-- Feedback reporting schema

create extension if not exists pgcrypto;

create table if not exists public.feedback_admins (
  email text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text,
  notes text
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),

  reporter_email text not null,
  reporter_name text,
  reporter_picture text,

  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category text not null default 'bug' check (category in ('bug', 'quality', 'ux', 'performance', 'feature_request', 'other')),

  title text not null,
  description text not null,
  reproduction_steps text,
  expected_behavior text,

  mode text,
  app_version text,
  user_agent text,
  project_name text,
  history_count integer not null default 0,

  snapshot_version integer not null default 1,
  snapshot_hash text not null,
  snapshot_size_bytes bigint not null check (snapshot_size_bytes > 0),
  snapshot_json jsonb,
  snapshot_storage_path text,

  resolved_at timestamptz,
  resolved_by text,

  metadata jsonb not null default '{}'::jsonb,

  constraint feedback_reports_snapshot_source_check
    check (snapshot_json is not null or snapshot_storage_path is not null)
);

create table if not exists public.feedback_activity (
  id bigserial primary key,
  report_id uuid not null references public.feedback_reports(id) on delete cascade,
  created_at timestamptz not null default now(),

  actor_email text not null,
  actor_name text,
  kind text not null check (kind in ('created', 'comment', 'status_changed', 'priority_changed', 'system')),
  message text not null,

  from_status text,
  to_status text,
  from_priority text,
  to_priority text,

  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.set_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_feedback_reports_set_updated_at on public.feedback_reports;
create trigger trg_feedback_reports_set_updated_at
before update on public.feedback_reports
for each row
execute function public.set_feedback_updated_at();
