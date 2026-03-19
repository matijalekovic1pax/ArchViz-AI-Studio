-- ─── Migration 003: Usage log and admin audit tables ─────────────────────────

-- Usage log (every generation)
create table public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  org_id uuid references public.organizations(id),
  mode text not null,
  credits_used int not null,
  used_bonus boolean not null default false,
  output_url text,
  created_at timestamptz not null default now()
);

-- Manual credit adjustments by superadmin
create table public.credit_adjustments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  amount int not null,
  reason text not null,
  performed_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
