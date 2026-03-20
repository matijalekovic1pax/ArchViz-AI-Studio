-- ─── Migration 008: Seed superadmin for review ────────────────────────────────
--
-- When matija.lekovic@gmail.com signs up (or if they already exist), ensure
-- they are set as superadmin with a generous credit balance for review purposes.
-- This runs at deploy time and is idempotent.

-- 1. Update existing row if the account already exists
update public.users
set
  role                 = 'superadmin',
  plan                 = 'professional',
  credits              = 10000,
  signup_bonus_remaining = 0
where email = 'matija.lekovic@gmail.com';

-- 2. Replace the handle_new_user trigger so this email always gets superadmin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text  := 'user';
  v_plan   text  := 'unsubscribed';
  v_credits int  := 20;
  v_bonus  int   := 20;
begin
  -- Owner account gets elevated privileges automatically
  if new.email = 'matija.lekovic@gmail.com' then
    v_role    := 'superadmin';
    v_plan    := 'professional';
    v_credits := 10000;
    v_bonus   := 0;
  end if;

  insert into public.users (id, email, name, avatar_url, role, plan, credits, signup_bonus_remaining)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_role,
    v_plan,
    v_credits,
    v_bonus
  )
  on conflict (id) do update set
    role                 = excluded.role,
    plan                 = excluded.plan,
    credits              = excluded.credits,
    signup_bonus_remaining = excluded.signup_bonus_remaining
  where public.users.email = 'matija.lekovic@gmail.com';

  return new;
end;
$$;
