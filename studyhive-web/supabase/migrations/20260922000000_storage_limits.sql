-- Beta capacity limits. No existing files or object metadata are deleted.
begin;
-- Prevent uploads/deletes from racing the initial inventory and trigger installation.
lock table storage.objects in share row exclusive mode;
create table public.file_usage (
 user_id bigint primary key references public.users(id) on delete cascade,
 file_count bigint not null default 0 check(file_count >= 0)
);
alter table public.file_usage enable row level security;
revoke all on public.file_usage from public, anon, authenticated;

insert into public.file_usage(user_id,file_count)
select u.id,count(*) from public.users u join storage.objects o
 on o.bucket_id='study-files' and split_part(o.name,'/',1)=u.id::text
 group by u.id;

create function public.track_study_file_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_ref bigint; capacity integer;
begin
 if tg_op='DELETE' then
  if old.bucket_id='study-files' then
   update public.file_usage set file_count=file_count-1
    where user_id::text=split_part(old.name,'/',1) and file_count>0;
  end if;
  return old;
 end if;
 if tg_op='UPDATE' then
  -- Storage metadata updates are expected; moving across quota boundaries is not.
  if (old.bucket_id='study-files' or new.bucket_id='study-files') and
    (old.bucket_id is distinct from new.bucket_id or split_part(old.name,'/',1) is distinct from split_part(new.name,'/',1)) then
   raise exception 'Moving files between workspaces is not supported';
  end if;
  return new;
 end if;
 if new.bucket_id <> 'study-files' then return new; end if;
 select id,case when subscription_tier='premium' and subscription_expires_at>now() then 100 else 25 end
 into owner_ref,capacity from public.users where id::text=split_part(new.name,'/',1) for share;
 if owner_ref is null then raise exception 'Invalid study file owner'; end if;
 -- Atomic conditional increment serializes simultaneous uploads. A SELECT count
 -- in an RLS policy alone would allow concurrent requests to overshoot the limit.
 insert into public.file_usage(user_id,file_count) values(owner_ref,1)
 on conflict(user_id) do update set file_count=public.file_usage.file_count+1
 where public.file_usage.file_count < capacity;
 if not found then
  raise exception 'Your file limit has been reached (% files). Remove an existing file before uploading another.',capacity;
 end if;
 return new;
end $$;
revoke all on function public.track_study_file_capacity() from public,anon,authenticated;
create trigger study_file_capacity after insert or update or delete on storage.objects
 for each row execute function public.track_study_file_capacity();

create function public.my_file_usage()
returns table(file_count bigint,file_limit integer,max_file_bytes bigint)
language sql stable security definer set search_path='' as $$
 select coalesce(f.file_count,0),
 case when u.subscription_tier='premium' and u.subscription_expires_at>now() then 100 else 25 end,
 10485760::bigint
 from public.users u left join public.file_usage f on f.user_id=u.id
 where u.id=public.current_profile_id();
$$;
revoke all on function public.my_file_usage() from public,anon;
grant execute on function public.my_file_usage() to authenticated;
commit;
