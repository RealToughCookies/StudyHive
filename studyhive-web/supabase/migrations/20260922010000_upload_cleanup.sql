-- Cleanup is requested by the owner through pro-service; this migration deletes no files.
begin;
create table public.upload_cleanup (
 path text primary key,
 user_id bigint not null references public.users(id) on delete cascade,
 marked_at timestamptz not null default now()
);
create index on public.upload_cleanup(user_id);
create index on public.note_attachments(filename);
alter table public.upload_cleanup enable row level security;
revoke all on public.upload_cleanup from public,anon,authenticated;

create function public.guard_attachment_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.filename=old.filename and new.user_id=old.user_id then return new; end if;
 perform public.require_writable_account(new.user_id);
 if split_part(new.filename,'/',1)<>new.user_id::text or
   not exists(select 1 from storage.objects where bucket_id='study-files' and name=new.filename) then
  raise exception 'Upload this file to your workspace before attaching it';
 end if;
 if exists(select 1 from public.upload_cleanup where path=new.filename) then
  raise exception 'This unused upload is being removed. Upload the file again';
 end if;
 return new;
end $$;
create trigger attachment_file_guard before insert or update on public.note_attachments
 for each row execute function public.guard_attachment_file();

create function public.guard_cleanup_path() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='study-files' and
   (tg_op='INSERT' or new.name is distinct from old.name or new.bucket_id is distinct from old.bucket_id) and
   exists(select 1 from public.upload_cleanup where path=new.name) then
  raise exception 'This upload path was retired. Choose a new file name';
 end if;
 return new;
end $$;
create trigger study_file_cleanup_guard before insert or update on storage.objects
 for each row execute function public.guard_cleanup_path();

create function public.claim_unused_uploads(owner_ref bigint)
returns table(path text) language plpgsql security definer set search_path='' as $$
begin
 -- This lock serializes cleanup selection with attachment registration and AI reservation.
 perform 1 from public.users where id=owner_ref for update;
 perform public.require_writable_account(owner_ref);
 if exists(select 1 from public.ai_jobs where user_id=owner_ref and status='pending' and created_at>now()-interval '10 minutes') then
  raise exception 'Wait for your AI generation to finish before cleaning up uploads';
 end if;
 insert into public.upload_cleanup(path,user_id)
 select o.name,owner_ref from storage.objects o
 where o.bucket_id='study-files' and split_part(o.name,'/',1)=owner_ref::text
 and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.note_attachments a where a.filename=o.name)
 order by o.created_at,o.name limit 50
 on conflict do nothing;
 -- Tombstones remain after removal: concurrent retries can never delete a new
 -- object uploaded to an old path. Only account deletion removes these receipts.
 return query select c.path from public.upload_cleanup c join storage.objects o
 on o.bucket_id='study-files' and o.name=c.path
 where c.user_id=owner_ref order by c.marked_at,c.path limit 50;
end $$;
revoke all on function public.claim_unused_uploads(bigint) from public,anon,authenticated;
grant execute on function public.claim_unused_uploads(bigint) to service_role;
revoke all on function public.guard_attachment_file() from public,anon,authenticated;
revoke all on function public.guard_cleanup_path() from public,anon,authenticated;
commit;
