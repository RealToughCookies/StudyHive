-- Run once in the connected DEVELOPMENT project's SQL editor.
-- Six successful generations per Pro account; this is NOT a dollar cap.
begin;
do $$
begin
  if (select count(*) from public.users
      where subscription_tier = 'premium' and subscription_expires_at > now()) <> 1 then
    raise exception 'Expected exactly one active Pro test account. Review before enabling AI.';
  end if;
  if exists (select 1 from public.ai_jobs
      where created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC') then
    raise exception 'AI attempts already exist this month. Review usage before enabling this test allowance.';
  end if;
  update public.pro_config set monthly_generations = 6
    where id and monthly_generations in (0, 6);
  if not found then
    raise exception 'Unexpected AI configuration. No allowance changed.';
  end if;
end $$;
select monthly_generations as test_allowance from public.pro_config where id;
commit;
