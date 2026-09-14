-- Additive Pro services. Provider secrets are never stored in browser-readable tables.
begin;
create table public.card_reviews (
 card_id bigint primary key, user_id bigint not null references public.users(id) on delete cascade,
 due_at timestamptz not null default now(), interval_days integer not null default 0 check(interval_days between 0 and 365),
 repetitions integer not null default 0, revision bigint not null default 0,
 foreign key(card_id,user_id) references public.flashcards(id,user_id) on delete cascade
);
alter table public.card_reviews enable row level security;
revoke all on public.card_reviews from anon,authenticated;
grant select on public.card_reviews to authenticated;
create policy own_read on public.card_reviews for select to authenticated using(user_id=public.current_profile_id());
create function public.review_flashcard(card_ref bigint, rating text, expected_revision bigint)
returns public.card_reviews language plpgsql security definer set search_path='' as $$
declare uid bigint:=public.current_profile_id(); r public.card_reviews; days integer;
begin
 if not public.has_pro() then raise exception 'Pro is required for scheduled review'; end if;
 if rating is null or rating not in ('again','hard','good','easy') then raise exception 'Invalid rating'; end if;
 if not exists(select 1 from public.flashcards c join public.flashcard_decks d on d.id=c.deck_id and d.user_id=c.user_id where c.id=card_ref and c.user_id=uid and d.spaced_repetition_enabled) then raise exception 'Enable spaced repetition on your deck first'; end if;
 insert into public.card_reviews(card_id,user_id) values(card_ref,uid) on conflict do nothing;
 select * into r from public.card_reviews where card_id=card_ref and user_id=uid for update;
 if expected_revision is null or r.revision<>expected_revision then raise exception 'This card was reviewed on another device. Reopen the review.'; end if;
 if r.due_at>now() then raise exception 'This card is not due yet'; end if;
 days:=case rating when 'again' then 0 when 'hard' then greatest(1,ceil(r.interval_days*1.2)::integer) when 'good' then case when r.interval_days=0 then 1 else r.interval_days*2 end else case when r.interval_days=0 then 4 else r.interval_days*3 end end;
 update public.card_reviews set interval_days=least(365,days),due_at=now()+case when rating='again' then interval '10 minutes' else make_interval(days=>least(365,days)) end,repetitions=case when rating='again' then 0 else repetitions+1 end,revision=revision+1 where card_id=card_ref returning * into r;
 return r;
end $$;
revoke all on function public.review_flashcard(bigint,text,bigint) from public;
grant execute on function public.review_flashcard(bigint,text,bigint) to authenticated;
create function public.due_flashcards(deck_ref bigint)
returns table(id bigint,front text,back text,review_revision bigint) language plpgsql security invoker set search_path='' as $$
begin
 if not public.has_pro() then raise exception 'Pro is required for scheduled review'; end if;
 if not exists(select 1 from public.flashcard_decks where flashcard_decks.id=deck_ref and spaced_repetition_enabled) then raise exception 'Enable spaced repetition on your deck first'; end if;
 return query select c.id,c.front,c.back,coalesce(r.revision,0) from public.flashcards c left join public.card_reviews r on r.card_id=c.id where c.deck_id=deck_ref and (r.due_at is null or r.due_at<=now()) order by r.due_at nulls first,c.id limit 500;
end $$;
revoke all on function public.due_flashcards(bigint) from public;
grant execute on function public.due_flashcards(bigint) to authenticated;

create table public.pro_config(id boolean primary key default true check(id),monthly_generations integer not null default 0 check(monthly_generations between 0 and 1000));
insert into public.pro_config values(true,0);
alter table public.pro_config enable row level security;
revoke all on public.pro_config from anon,authenticated;
create table public.ai_jobs (
 id uuid primary key, user_id bigint not null references public.users(id) on delete cascade,
 fingerprint text not null, kind text not null check(kind in ('notes','guide','flashcards','quiz')),
 status text not null default 'pending' check(status in ('pending','failed','completed')),
 created_at timestamptz not null default now(), artifact_id bigint, artifact_type text
);
create index on public.ai_jobs(user_id,created_at);
alter table public.ai_jobs enable row level security;
revoke all on public.ai_jobs from anon,authenticated;
grant select on public.ai_jobs to authenticated;
create policy own_read on public.ai_jobs for select to authenticated using(user_id=public.current_profile_id());
create function public.reserve_ai_job(owner_ref bigint, request_ref uuid, request_hash text, request_kind text)
returns public.ai_jobs language plpgsql security definer set search_path='' as $$
declare j public.ai_jobs; allowance integer; used integer; attempts integer;
begin
 perform 1 from public.users where id=owner_ref and subscription_tier='premium' and subscription_expires_at>now() for update;
 if not found then raise exception 'Pro is required for AI'; end if;
 select * into j from public.ai_jobs where id=request_ref;
 if found then
  if j.user_id<>owner_ref or j.fingerprint<>request_hash or j.kind<>request_kind then raise exception 'Request identifier already used'; end if;
  if j.status='pending' then raise exception 'This generation is still processing'; end if;
  if j.status='failed' then raise exception 'Previous attempt failed. Start a new generation.'; end if;
  return j;
 end if;
 select monthly_generations into allowance from public.pro_config where id;
 if allowance is null or allowance<1 then raise exception 'AI service is not enabled yet'; end if;
 update public.ai_jobs set status='failed' where user_id=owner_ref and status='pending' and created_at<now()-interval '10 minutes';
 select count(*) filter(where status in ('pending','completed')),count(*) into used,attempts from public.ai_jobs where user_id=owner_ref and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if used>=allowance then raise exception 'Monthly AI allowance reached'; end if;
 if attempts>=allowance*3+10 or exists(select 1 from public.ai_jobs where user_id=owner_ref and status='pending') then raise exception 'Please wait before trying another generation'; end if;
 insert into public.ai_jobs(id,user_id,fingerprint,kind) values(request_ref,owner_ref,request_hash,request_kind) returning * into j;
 return j;
end $$;
create function public.finish_ai_job(owner_ref bigint,request_ref uuid,result_title text,result_body text,result_items jsonb,class_ref bigint default null,note_ref bigint default null)
returns public.ai_jobs language plpgsql security definer set search_path='' as $$
declare j public.ai_jobs; artifact bigint; item jsonb;
begin
 select * into strict j from public.ai_jobs where id=request_ref and user_id=owner_ref for update;
 if j.status='completed' then return j; end if;
 if j.status<>'pending' then raise exception 'Generation has expired'; end if;
 if class_ref is not null and not exists(select 1 from public.classes where id=class_ref and user_id=owner_ref) then raise exception 'Class not found'; end if;
 if note_ref is not null and not exists(select 1 from public.notes where id=note_ref and user_id=owner_ref) then raise exception 'Note not found'; end if;
 if j.kind in ('notes','guide') then
  insert into public.notes(user_id,title,content,class_id) values(owner_ref,result_title,result_body,class_ref) returning id into artifact;
  j.artifact_type:='note';
 elsif j.kind='flashcards' then
  if jsonb_typeof(result_items) is distinct from 'array' or jsonb_array_length(result_items) not between 1 and 30 then raise exception 'Invalid cards'; end if;
  insert into public.flashcard_decks(user_id,name,class_id,note_id) values(owner_ref,result_title,class_ref,note_ref) returning id into artifact;
  for item in select * from jsonb_array_elements(result_items) loop
   insert into public.flashcards(user_id,deck_id,note_id,class_id,front,back) values(owner_ref,artifact,note_ref,class_ref,item->>'front',item->>'back');
  end loop;
  j.artifact_type:='deck';
 else
  if jsonb_typeof(result_items) is distinct from 'array' or jsonb_array_length(result_items) not between 1 and 20 then raise exception 'Invalid quiz'; end if;
  insert into public.quizzes(user_id,title,questions,class_id,note_id) values(owner_ref,result_title,result_items::text,class_ref,note_ref) returning id into artifact;
  j.artifact_type:='quiz';
 end if;
 update public.ai_jobs set status='completed',artifact_id=artifact,artifact_type=j.artifact_type where id=request_ref returning * into j;
 return j;
end $$;
create function public.ai_allowance() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('limit',(select monthly_generations from public.pro_config where id),'used',(select count(*) from public.ai_jobs where user_id=public.current_profile_id() and status in ('pending','completed') and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'))
$$;
revoke all on function public.reserve_ai_job(bigint,uuid,text,text),public.finish_ai_job(bigint,uuid,text,text,jsonb,bigint,bigint),public.ai_allowance() from public;
grant execute on function public.reserve_ai_job(bigint,uuid,text,text),public.finish_ai_job(bigint,uuid,text,text,jsonb,bigint,bigint) to service_role;
grant execute on function public.ai_allowance() to authenticated;

create table public.billing_customers (
 user_id bigint primary key references public.users(id) on delete cascade, customer_id text not null unique,
 sync_token uuid, sync_until timestamptz
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon,authenticated;
create function public.claim_billing_sync(customer_ref text,token_ref uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.billing_customers set sync_token=token_ref,sync_until=now()+interval '90 seconds' where customer_id=customer_ref and (sync_until is null or sync_until<now());
 return found;
end $$;
create function public.apply_billing_sync(customer_ref text,token_ref uuid,pro_until timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare uid bigint;
begin
 select user_id into uid from public.billing_customers where customer_id=customer_ref and sync_token=token_ref and sync_until>now() for update;
 if uid is null then raise exception 'Subscription refresh lock expired'; end if;
 update public.users set subscription_tier=case when pro_until>now() then 'premium' else 'free' end,subscription_expires_at=pro_until where id=uid;
 update public.billing_customers set sync_token=null,sync_until=null where user_id=uid;
end $$;
revoke all on function public.claim_billing_sync(text,uuid),public.apply_billing_sync(text,uuid,timestamptz) from public;
grant execute on function public.claim_billing_sync(text,uuid),public.apply_billing_sync(text,uuid,timestamptz) to service_role;
grant select,insert,update on public.billing_customers,public.ai_jobs,public.pro_config to service_role;
grant select on public.users,public.notes,public.classes to service_role;
commit;
