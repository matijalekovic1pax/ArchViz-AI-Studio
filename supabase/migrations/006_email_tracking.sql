-- Migration 006: Email tracking column
-- Prevents sending duplicate welcome emails

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_email_sent boolean NOT NULL DEFAULT false;

-- Index for querying users who haven't received welcome email yet
CREATE INDEX IF NOT EXISTS idx_users_welcome_email_sent
  ON public.users (welcome_email_sent)
  WHERE welcome_email_sent = false;
