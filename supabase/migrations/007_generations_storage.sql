-- Migration 007: Persistent generations table + storage bucket
-- Generated outputs are stored in Supabase Storage and referenced here.

-- ── Generations table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id        uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  mode          text NOT NULL,
  storage_path  text NOT NULL,          -- path in the 'generations' bucket
  public_url    text,                   -- cached public URL
  prompt        text,
  credits_used  int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id    ON public.generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_org_id     ON public.generations (org_id,  created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own generations
CREATE POLICY "generations_select_own"
  ON public.generations FOR SELECT
  USING (user_id = auth.uid());

-- Org members can see org generations
CREATE POLICY "generations_select_org"
  ON public.generations FOR SELECT
  USING (
    org_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = generations.org_id
        AND user_id = auth.uid()
    )
  );

-- Service role inserts (Worker inserts on behalf of users)
CREATE POLICY "generations_insert_service"
  ON public.generations FOR INSERT
  WITH CHECK (true);

-- Superadmin bypass
CREATE POLICY "generations_superadmin"
  ON public.generations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── Storage bucket (run via Supabase dashboard or supabase CLI) ───────────────
-- The 'generations' bucket should be created as PRIVATE (authenticated access only).
-- Example CLI command:
--   supabase storage create-bucket generations --private
--
-- Storage RLS policy for the bucket:
--   Users can read files at generations/{user_id}/*
--   Service role can write to any path
