-- =============================================================================
-- ArchViz AI Studio — Full database schema + seed
-- Paste this into Supabase SQL Editor and run once on a fresh project.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE, etc.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Users (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id                    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 text        NOT NULL,
  name                  text,
  avatar_url            text,
  role                  text        NOT NULL DEFAULT 'user'          CHECK (role IN ('user', 'superadmin')),
  plan                  text        NOT NULL DEFAULT 'unsubscribed'  CHECK (plan IN ('unsubscribed', 'starter', 'professional')),
  credits               int         NOT NULL DEFAULT 0,
  signup_bonus_remaining int        NOT NULL DEFAULT 20,
  stripe_customer_id    text        UNIQUE,
  suspended_at          timestamptz,
  welcome_email_sent    boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_active_at        timestamptz
);

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text        NOT NULL,
  owner_id                 uuid        NOT NULL REFERENCES public.users(id),
  plan                     text        NOT NULL DEFAULT 'studio' CHECK (plan IN ('studio', 'enterprise')),
  credits                  int         NOT NULL DEFAULT 0,
  seat_limit               int         NOT NULL DEFAULT 5,
  extra_credits_purchased  int         NOT NULL DEFAULT 0,
  stripe_customer_id       text        UNIQUE,
  stripe_subscription_id   text        UNIQUE,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Organization invites
CREATE TABLE IF NOT EXISTS public.org_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token       uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by  uuid        NOT NULL REFERENCES public.users(id),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions (user and org)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type            text        NOT NULL CHECK (entity_type IN ('user', 'org')),
  entity_id              uuid        NOT NULL,
  stripe_subscription_id text        UNIQUE NOT NULL,
  plan                   text        NOT NULL,
  status                 text        NOT NULL,
  credits_per_period     int         NOT NULL,
  current_period_start   timestamptz NOT NULL,
  current_period_end     timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Video charges (pay-per-generation)
CREATE TABLE IF NOT EXISTS public.video_charges (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES public.users(id),
  org_id                   uuid        REFERENCES public.organizations(id),
  model                    text        NOT NULL,
  duration_seconds         int         NOT NULL,
  amount_cents             int         NOT NULL,
  stripe_payment_intent_id text        UNIQUE,
  status                   text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Credit top-up purchases
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type              text        NOT NULL CHECK (entity_type IN ('user', 'org')),
  entity_id                uuid        NOT NULL,
  credits_purchased        int         NOT NULL,
  amount_cents             int         NOT NULL,
  stripe_payment_intent_id text        UNIQUE,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Usage log (every generation)
CREATE TABLE IF NOT EXISTS public.usage_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id),
  org_id       uuid        REFERENCES public.organizations(id),
  mode         text        NOT NULL,
  credits_used int         NOT NULL,
  used_bonus   boolean     NOT NULL DEFAULT false,
  output_url   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Manual credit adjustments by superadmin
CREATE TABLE IF NOT EXISTS public.credit_adjustments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text        NOT NULL CHECK (entity_type IN ('user', 'org')),
  entity_id    uuid        NOT NULL,
  amount       int         NOT NULL,
  reason       text        NOT NULL,
  performed_by uuid        NOT NULL REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Persistent generation history
CREATE TABLE IF NOT EXISTS public.generations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id       uuid        REFERENCES public.organizations(id)  ON DELETE SET NULL,
  mode         text        NOT NULL,
  storage_path text        NOT NULL,
  public_url   text,
  prompt       text,
  credits_used int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_org_id  ON public.generations (org_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_welcome_email ON public.users (welcome_email_sent) WHERE welcome_email_sent = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_charges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_purchases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations         ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_read_own"        ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"      ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "superadmin_all_users"  ON public.users FOR ALL    USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- organizations
CREATE POLICY "org_members_read"       ON public.organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = id AND om.user_id = auth.uid())
);
CREATE POLICY "org_owner_admin_update" ON public.organizations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);
CREATE POLICY "superadmin_all_orgs"    ON public.organizations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- organization_members
CREATE POLICY "org_members_read_self"    ON public.organization_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid())
);
CREATE POLICY "org_admin_insert"         ON public.organization_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);
CREATE POLICY "org_admin_delete"         ON public.organization_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);
CREATE POLICY "org_admin_update_roles"   ON public.organization_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);
CREATE POLICY "superadmin_all_members"   ON public.organization_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- org_invites
CREATE POLICY "org_admin_read_invites"   ON public.org_invites FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);
CREATE POLICY "org_admin_manage_invites" ON public.org_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM public.organization_members om WHERE om.org_id = org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
);

-- subscriptions
CREATE POLICY "subscriptions_read_own_user" ON public.subscriptions FOR SELECT USING (entity_type = 'user' AND entity_id = auth.uid());
CREATE POLICY "subscriptions_read_own_org"  ON public.subscriptions FOR SELECT USING (
  entity_type = 'org' AND EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.org_id = entity_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "superadmin_all_subscriptions" ON public.subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- usage_log
CREATE POLICY "usage_read_own"       ON public.usage_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usage_org_admin_read" ON public.usage_log FOR SELECT USING (
  org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.org_id = usage_log.org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "superadmin_all_usage" ON public.usage_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- video_charges
CREATE POLICY "video_charges_read_own"          ON public.video_charges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "video_charges_org_admin_read"    ON public.video_charges FOR SELECT USING (
  org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.org_id = video_charges.org_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);
CREATE POLICY "superadmin_all_video_charges"    ON public.video_charges FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- credit_purchases
CREATE POLICY "credit_purchases_read_own_user" ON public.credit_purchases FOR SELECT USING (entity_type = 'user' AND entity_id = auth.uid());
CREATE POLICY "credit_purchases_read_own_org"  ON public.credit_purchases FOR SELECT USING (
  entity_type = 'org' AND EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.org_id = entity_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- credit_adjustments
CREATE POLICY "superadmin_all_adjustments" ON public.credit_adjustments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);

-- generations
CREATE POLICY "generations_select_own"     ON public.generations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "generations_select_org"     ON public.generations FOR SELECT USING (
  org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members WHERE org_id = generations.org_id AND user_id = auth.uid()
  )
);
CREATE POLICY "generations_insert_service" ON public.generations FOR INSERT WITH CHECK (true);
CREATE POLICY "generations_superadmin"     ON public.generations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-create public.users row on signup
-- If the signing-up email is the owner account, grant superadmin immediately.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role    text := 'user';
  v_plan    text := 'unsubscribed';
  v_credits int  := 20;
  v_bonus   int  := 20;
BEGIN
  IF new.email = 'matija.lekovic@gmail.com' THEN
    v_role    := 'superadmin';
    v_plan    := 'professional';
    v_credits := 10000;
    v_bonus   := 0;
  END IF;

  INSERT INTO public.users (id, email, name, avatar_url, role, plan, credits, signup_bonus_remaining)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_role,
    v_plan,
    v_credits,
    v_bonus
  )
  ON CONFLICT (id) DO UPDATE SET
    role                  = EXCLUDED.role,
    plan                  = EXCLUDED.plan,
    credits               = EXCLUDED.credits,
    signup_bonus_remaining = EXCLUDED.signup_bonus_remaining
  WHERE public.users.email = 'matija.lekovic@gmail.com';

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomically deduct credits — returns false if insufficient
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_entity_type text,
  p_entity_id   uuid,
  p_amount      int
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rows_updated int;
BEGIN
  IF p_entity_type = 'user' THEN
    UPDATE public.users SET credits = credits - p_amount
    WHERE id = p_entity_id AND credits >= p_amount;
  ELSIF p_entity_type = 'org' THEN
    UPDATE public.organizations SET credits = credits - p_amount
    WHERE id = p_entity_id AND credits >= p_amount;
  ELSE
    RETURN false;
  END IF;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Add credits to a user or org
CREATE OR REPLACE FUNCTION public.add_credits(
  p_entity_type text,
  p_entity_id   uuid,
  p_amount      int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_entity_type = 'user' THEN
    UPDATE public.users SET credits = credits + p_amount WHERE id = p_entity_id;
  ELSIF p_entity_type = 'org' THEN
    UPDATE public.organizations SET credits = credits + p_amount WHERE id = p_entity_id;
  END IF;
END;
$$;

-- Reset credits on subscription renewal with optional 50% rollover
CREATE OR REPLACE FUNCTION public.reset_credits_on_renewal(
  p_entity_type      text,
  p_entity_id        uuid,
  p_credits_per_period int,
  p_rollover         boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_credits int;
  rollover_amount int;
BEGIN
  IF p_entity_type = 'user' THEN
    SELECT credits INTO current_credits FROM public.users WHERE id = p_entity_id;
    rollover_amount := CASE WHEN p_rollover THEN LEAST(current_credits, FLOOR(p_credits_per_period * 0.5)::int) ELSE 0 END;
    UPDATE public.users SET credits = p_credits_per_period + rollover_amount WHERE id = p_entity_id;
  ELSIF p_entity_type = 'org' THEN
    SELECT credits INTO current_credits FROM public.organizations WHERE id = p_entity_id;
    rollover_amount := CASE WHEN p_rollover THEN LEAST(current_credits, FLOOR(p_credits_per_period * 0.5)::int) ELSE 0 END;
    UPDATE public.organizations SET credits = p_credits_per_period + rollover_amount WHERE id = p_entity_id;
  END IF;
END;
$$;

-- Resolve credit pool for a user (org pool if they belong to one)
CREATE OR REPLACE FUNCTION public.resolve_credit_pool(p_user_id uuid)
RETURNS TABLE(entity_type text, entity_id uuid, credits int, plan text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT om.org_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = p_user_id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY SELECT 'org'::text, o.id, o.credits, o.plan FROM public.organizations o WHERE o.id = v_org_id;
  ELSE
    RETURN QUERY SELECT 'user'::text, u.id, u.credits, u.plan FROM public.users u WHERE u.id = p_user_id;
  END IF;
END;
$$;

-- Stamp last_active_at (called by Cloudflare Worker on each request)
CREATE OR REPLACE FUNCTION public.touch_user_active(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users SET last_active_at = now() WHERE id = p_user_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SEED — owner account
-- ─────────────────────────────────────────────────────────────────────────────
-- If matija.lekovic@gmail.com already exists in public.users (because they
-- signed up before this script ran), promote them to superadmin now.

UPDATE public.users
SET
  role                  = 'superadmin',
  plan                  = 'professional',
  credits               = 10000,
  signup_bonus_remaining = 0
WHERE email = 'matija.lekovic@gmail.com';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET (manual step — cannot be done via SQL)
-- ─────────────────────────────────────────────────────────────────────────────
-- Create a private bucket called "generations" in the Supabase dashboard:
--   Storage → New bucket → Name: generations → Private: ON
--
-- Then add these storage RLS policies (Dashboard → Storage → Policies):
--
--   Policy 1 — authenticated users read their own files:
--     USING ( bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1] )
--
--   Policy 2 — service role can write anything:
--     WITH CHECK ( true )   (restrict to service_role via Supabase dashboard toggle)
-- =============================================================================
