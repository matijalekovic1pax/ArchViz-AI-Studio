-- ─── Migration 005: Helper functions and triggers ────────────────────────────

-- Auto-create public.users row when auth.users row is inserted
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, avatar_url, credits, signup_bonus_remaining)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    20,   -- signup bonus credits
    20    -- all 20 are bonus credits
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically deduct credits — returns false if insufficient balance
-- entity_type: 'user' or 'org'
create or replace function public.deduct_credits(
  p_entity_type text,
  p_entity_id uuid,
  p_amount int
) returns boolean language plpgsql security definer as $$
declare
  rows_updated int;
begin
  if p_entity_type = 'user' then
    update public.users
    set credits = credits - p_amount
    where id = p_entity_id and credits >= p_amount;
  elsif p_entity_type = 'org' then
    update public.organizations
    set credits = credits - p_amount
    where id = p_entity_id and credits >= p_amount;
  else
    return false;
  end if;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

-- Add credits to a user or org (used by Stripe webhook + admin adjustments)
create or replace function public.add_credits(
  p_entity_type text,
  p_entity_id uuid,
  p_amount int
) returns void language plpgsql security definer as $$
begin
  if p_entity_type = 'user' then
    update public.users set credits = credits + p_amount where id = p_entity_id;
  elsif p_entity_type = 'org' then
    update public.organizations set credits = credits + p_amount where id = p_entity_id;
  end if;
end;
$$;

-- Reset credits on subscription renewal with optional rollover (up to 50% of new period)
create or replace function public.reset_credits_on_renewal(
  p_entity_type text,
  p_entity_id uuid,
  p_credits_per_period int,
  p_rollover boolean default false
) returns void language plpgsql security definer as $$
declare
  current_credits int;
  rollover_amount int;
begin
  if p_entity_type = 'user' then
    select credits into current_credits from public.users where id = p_entity_id;
    rollover_amount := case when p_rollover then least(current_credits, floor(p_credits_per_period * 0.5)::int) else 0 end;
    update public.users set credits = p_credits_per_period + rollover_amount where id = p_entity_id;
  elsif p_entity_type = 'org' then
    select credits into current_credits from public.organizations where id = p_entity_id;
    rollover_amount := case when p_rollover then least(current_credits, floor(p_credits_per_period * 0.5)::int) else 0 end;
    update public.organizations set credits = p_credits_per_period + rollover_amount where id = p_entity_id;
  end if;
end;
$$;

-- Resolve credit pool for a user: returns (entity_type, entity_id, credits)
-- If the user is in an org, returns the org's pool; otherwise the user's pool
create or replace function public.resolve_credit_pool(p_user_id uuid)
returns table(entity_type text, entity_id uuid, credits int, plan text)
language plpgsql security definer as $$
declare
  v_org_id uuid;
begin
  -- Check if user belongs to an org
  select om.org_id into v_org_id
  from public.organization_members om
  where om.user_id = p_user_id
  limit 1;

  if v_org_id is not null then
    return query
      select 'org'::text, o.id, o.credits, o.plan
      from public.organizations o
      where o.id = v_org_id;
  else
    return query
      select 'user'::text, u.id, u.credits, u.plan
      from public.users u
      where u.id = p_user_id;
  end if;
end;
$$;

-- Update last_active_at on user when they make a request (called by Worker)
create or replace function public.touch_user_active(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.users set last_active_at = now() where id = p_user_id;
end;
$$;
