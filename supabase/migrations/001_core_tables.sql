-- ─── Migration 001: Core user and organization tables ────────────────────────

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'superadmin')),
  plan text not null default 'unsubscribed' check (plan in ('unsubscribed', 'starter', 'professional')),
  credits int not null default 0,
  signup_bonus_remaining int not null default 20,
  stripe_customer_id text unique,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id),
  plan text not null default 'studio' check (plan in ('studio', 'enterprise')),
  credits int not null default 0,
  seat_limit int not null default 5,
  extra_credits_purchased int not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now()
);

-- Organization members
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Organization invites
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references public.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
