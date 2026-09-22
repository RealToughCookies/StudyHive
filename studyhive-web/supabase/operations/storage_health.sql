-- Read-only aggregate check. Run in the Supabase SQL editor as administrator.
-- Does not expose email, note text, or file names; does not remove any data.
-- All anomaly columns should be zero. Metadata checks do not verify file bytes.
with inventory as (
  select u.id, count(o.id) as actual
  from public.users u left join storage.objects o
    on o.bucket_id = 'study-files' and split_part(o.name, '/', 1) = u.id::text
  group by u.id
)
select
  (select count(*) from storage.objects where bucket_id = 'study-files') as stored_files,
  (select coalesce(sum(file_count), 0) from public.file_usage) as counted_files,
  (select count(*) from inventory i left join public.file_usage f on f.user_id = i.id
    where i.actual <> coalesce(f.file_count, 0)) as counter_mismatches,
  (select count(*) from storage.objects o where o.bucket_id = 'study-files'
    and not exists (select 1 from public.users u where u.id::text = split_part(o.name, '/', 1))) as ownerless_files,
  (select count(*) from public.note_attachments a where not exists (
    select 1 from storage.objects o where o.bucket_id = 'study-files' and o.name = a.filename)) as missing_attachment_objects,
  (select count(*) from public.note_attachments a where split_part(a.filename, '/', 1) <> a.user_id::text) as foreign_attachment_paths,
  (select count(*) from public.upload_cleanup c join public.note_attachments a on a.filename = c.path) as attached_cleanup_claims;
