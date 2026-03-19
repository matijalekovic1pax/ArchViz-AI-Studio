-- ─── Migration 004: Row Level Security policies ───────────────────────────────

-- ── users ──────────────────────────────────────────────────────────────────
alter table public.users enable row level security;

create policy "users_read_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "superadmin_all_users" on public.users
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── organizations ──────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

create policy "org_members_read" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = id and om.user_id = auth.uid()
    )
  );

create policy "org_owner_admin_update" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "superadmin_all_orgs" on public.organizations
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── organization_members ───────────────────────────────────────────────────
alter table public.organization_members enable row level security;

create policy "org_members_read_self" on public.organization_members
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid()
    )
  );

create policy "org_admin_insert" on public.organization_members
  for insert with check (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "org_admin_delete" on public.organization_members
  for delete using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "org_admin_update_roles" on public.organization_members
  for update using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "superadmin_all_members" on public.organization_members
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── org_invites ────────────────────────────────────────────────────────────
alter table public.org_invites enable row level security;

create policy "org_admin_read_invites" on public.org_invites
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "org_admin_manage_invites" on public.org_invites
  for all using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

-- ── subscriptions ──────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

create policy "subscriptions_read_own_user" on public.subscriptions
  for select using (entity_type = 'user' and entity_id = auth.uid());

create policy "subscriptions_read_own_org" on public.subscriptions
  for select using (
    entity_type = 'org' and exists (
      select 1 from public.organization_members om
      where om.org_id = entity_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "superadmin_all_subscriptions" on public.subscriptions
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── usage_log ──────────────────────────────────────────────────────────────
alter table public.usage_log enable row level security;

create policy "usage_read_own" on public.usage_log
  for select using (user_id = auth.uid());

create policy "usage_org_admin_read" on public.usage_log
  for select using (
    org_id is not null and exists (
      select 1 from public.organization_members om
      where om.org_id = usage_log.org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "superadmin_all_usage" on public.usage_log
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── video_charges ──────────────────────────────────────────────────────────
alter table public.video_charges enable row level security;

create policy "video_charges_read_own" on public.video_charges
  for select using (user_id = auth.uid());

create policy "video_charges_org_admin_read" on public.video_charges
  for select using (
    org_id is not null and exists (
      select 1 from public.organization_members om
      where om.org_id = video_charges.org_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

create policy "superadmin_all_video_charges" on public.video_charges
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );

-- ── credit_purchases ───────────────────────────────────────────────────────
alter table public.credit_purchases enable row level security;

create policy "credit_purchases_read_own_user" on public.credit_purchases
  for select using (entity_type = 'user' and entity_id = auth.uid());

create policy "credit_purchases_read_own_org" on public.credit_purchases
  for select using (
    entity_type = 'org' and exists (
      select 1 from public.organization_members om
      where om.org_id = entity_id and om.user_id = auth.uid() and om.role in ('owner', 'admin')
    )
  );

-- ── credit_adjustments ─────────────────────────────────────────────────────
alter table public.credit_adjustments enable row level security;

create policy "superadmin_all_adjustments" on public.credit_adjustments
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin')
  );
