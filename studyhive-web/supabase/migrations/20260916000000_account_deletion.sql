-- Account deletion is opt-in through the authenticated Edge Function. No accounts are deleted here.
begin;
alter table public.users add column deletion_requested_at timestamptz;
create table public.account_deletions (
 user_id bigint primary key references public.users(id) on delete cascade,
 lease_token uuid, lease_until timestamptz
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;
grant select, update on public.account_deletions to service_role;

-- Serialize writes with the deletion marker, including writes from service-role AI jobs.
-- Reads remain available so the user can sign in and retry a partially completed deletion.
create function public.require_writable_account(owner_ref bigint) returns void
language plpgsql security definer set search_path='' as $$
declare marked timestamptz;
begin
 select deletion_requested_at into marked from public.users where id=owner_ref for share;
 if not found or marked is not null then raise exception 'Account deletion is in progress. Return to Settings to finish deleting your account.'; end if;
end $$;
create function public.guard_account_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is null then return new; end if; -- Preserve NOT NULL/RLS rejection.
 -- FK cascades may clear cross-links after the owning profile has been removed.
 if tg_op='UPDATE' and pg_trigger_depth()>1 and not exists(select 1 from public.users where id=new.user_id) then return new; end if;
 perform public.require_writable_account(new.user_id);
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['classes','notes','flashcard_decks','flashcards','quizzes','quiz_attempts','pomodoro_sessions','settings','note_attachments','sticky_notes','reminders','card_reviews','ai_jobs','billing_customers'] loop
  -- Billing lease release and failed job cleanup must still work during deletion.
  execute format('create trigger account_write_guard before insert %s on public.%I for each row execute function public.guard_account_write()',
    case when t in ('billing_customers','ai_jobs') then '' else 'or update' end,t);
 end loop;
end $$;
create function public.guard_study_file_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare prefix text;
begin
 if new.bucket_id='study-files' then
  prefix:=split_part(new.name,'/',1);
  if prefix !~ '^[0-9]+$' then raise exception 'Invalid study file owner'; end if;
  perform public.require_writable_account(prefix::bigint);
 end if;
 return new;
end $$;
create trigger study_file_account_guard before insert or update on storage.objects for each row execute function public.guard_study_file_write();

create or replace function public.claim_billing_sync(customer_ref text,token_ref uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare owner_ref bigint;
begin
 select user_id into owner_ref from public.billing_customers where customer_id=customer_ref;
 perform public.require_writable_account(owner_ref);
 update public.billing_customers set sync_token=token_ref,sync_until=now()+interval '90 seconds'
 where customer_id=customer_ref and (sync_until is null or sync_until<now());
 return found;
end $$;

create function public.begin_account_deletion(owner_ref bigint,token_ref uuid) returns text
language plpgsql security definer set search_path='' as $$
declare customer text;
begin
 perform 1 from public.users where id=owner_ref for update;
 if not found then raise exception 'Account unavailable'; end if;
 if exists(select 1 from public.billing_customers where user_id=owner_ref and sync_until>now())
 or exists(select 1 from public.ai_jobs where user_id=owner_ref and status='pending' and created_at>now()-interval '10 minutes') then
  raise exception 'An AI generation or billing update is still processing. Wait a few minutes and retry.';
 end if;
 insert into public.account_deletions(user_id) values(owner_ref) on conflict do nothing;
 update public.account_deletions set lease_token=token_ref,lease_until=now()+interval '2 minutes'
 where user_id=owner_ref and (lease_until is null or lease_until<now());
 if not found then raise exception 'Deletion is already processing. Wait two minutes before retrying.'; end if;
 update public.users set deletion_requested_at=coalesce(deletion_requested_at,now()) where id=owner_ref;
 select customer_id into customer from public.billing_customers where user_id=owner_ref;
 return customer;
end $$;

-- Flat, bounded inventory includes orphaned attachments and retained AI input files.
-- Remove their bytes using the Storage API, never by deleting storage.objects rows.
create function public.deletion_file_batch(owner_ref bigint,token_ref uuid) returns table(name text)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.account_deletions where user_id=owner_ref and lease_token=token_ref and lease_until>now()) then
  raise exception 'Deletion lease expired. Please retry.';
 end if;
 return query select o.name from storage.objects o where o.bucket_id='study-files' and split_part(o.name,'/',1)=owner_ref::text order by o.name limit 100;
end $$;
revoke all on function public.require_writable_account(bigint),public.guard_account_write(),public.guard_study_file_write(),public.begin_account_deletion(bigint,uuid),public.deletion_file_batch(bigint,uuid) from public;
grant execute on function public.begin_account_deletion(bigint,uuid),public.deletion_file_batch(bigint,uuid) to service_role;
commit;
