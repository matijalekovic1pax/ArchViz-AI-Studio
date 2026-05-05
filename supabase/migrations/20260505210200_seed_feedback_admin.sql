-- Seed initial feedback admin account

insert into public.feedback_admins (email, is_active, created_by, notes)
values ('matija.lekovic@1pax.com', true, 'migration', 'Initial admin for feedback dashboard')
on conflict (email) do update
set
  is_active = excluded.is_active,
  notes = excluded.notes;
