-- Stop new AI generations after the development acceptance test.
-- Existing study materials and Pro entitlement are retained.
update public.pro_config set monthly_generations = 0 where id
returning monthly_generations;
