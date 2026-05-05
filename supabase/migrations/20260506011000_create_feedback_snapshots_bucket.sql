-- Ensure the feedback snapshot storage bucket exists for large report payloads

insert into storage.buckets (id, name, public)
values ('feedback-snapshots', 'feedback-snapshots', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;
