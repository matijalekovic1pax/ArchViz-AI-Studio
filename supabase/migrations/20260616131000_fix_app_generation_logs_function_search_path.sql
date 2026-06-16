-- Lock app generation log trigger function search_path for Supabase security advisor.

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
