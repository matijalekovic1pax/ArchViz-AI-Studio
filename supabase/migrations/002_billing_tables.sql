-- ─── Migration 002: Subscriptions and billing tables ─────────────────────────

-- Subscriptions (covers both individual users and orgs)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  stripe_subscription_id text unique not null,
  plan text not null,
  status text not null,
  credits_per_period int not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Video charges (pay-per-generation)
create table public.video_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  org_id uuid references public.organizations(id),
  model text not null,
  duration_seconds int not null,
  amount_cents int not null,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

-- Credit top-up purchases
create table public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'org')),
  entity_id uuid not null,
  credits_purchased int not null,
  amount_cents int not null,
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now()
);
