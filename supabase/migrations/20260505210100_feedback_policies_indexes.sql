-- Feedback reporting indexes and RLS policy scaffolding

create index if not exists idx_feedback_reports_created_at_desc
  on public.feedback_reports (created_at desc);

create index if not exists idx_feedback_reports_status_created_at
  on public.feedback_reports (status, created_at desc);

create index if not exists idx_feedback_reports_priority_created_at
  on public.feedback_reports (priority, created_at desc);

create index if not exists idx_feedback_reports_reporter_email_created_at
  on public.feedback_reports (reporter_email, created_at desc);

create index if not exists idx_feedback_reports_mode_created_at
  on public.feedback_reports (mode, created_at desc);

create index if not exists idx_feedback_activity_report_created_at
  on public.feedback_activity (report_id, created_at asc);

alter table public.feedback_admins enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.feedback_activity enable row level security;

-- Block direct client access; gateway uses service role key.
drop policy if exists feedback_admins_deny_all on public.feedback_admins;
create policy feedback_admins_deny_all
on public.feedback_admins
for all
to public
using (false)
with check (false);

drop policy if exists feedback_reports_deny_all on public.feedback_reports;
create policy feedback_reports_deny_all
on public.feedback_reports
for all
to public
using (false)
with check (false);

drop policy if exists feedback_activity_deny_all on public.feedback_activity;
create policy feedback_activity_deny_all
on public.feedback_activity
for all
to public
using (false)
with check (false);
