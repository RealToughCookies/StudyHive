-- Restore-test acceptance only. Read-only, no row contents or identities returned.
-- Run ONLY in llhttvndnusoalbcvfzr. Claims simulate API roles; this does not
-- replace browser login, signed-JWT API tests or a comprehensive security audit.
BEGIN READ ONLY;
DO $$
DECLARE actor record; tab text; expected_count bigint; actual_count bigint;
 foreign_count bigint; expected_files bigint; checked_accounts integer := 0;
BEGIN
 FOR actor IN SELECT u.id, u.auth_user_id FROM public.users u
 JOIN auth.users a ON a.id=u.auth_user_id WHERE a.email_confirmed_at IS NOT NULL LOOP
  checked_accounts := checked_accounts+1;
  PERFORM set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',actor.auth_user_id,'role','authenticated')::text,true);
  FOREACH tab IN ARRAY ARRAY['classes','notes','flashcard_decks','flashcards','quizzes','quiz_attempts','pomodoro_sessions','settings','note_attachments','sticky_notes','reminders','card_reviews','ai_jobs'] LOOP
   EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id=$1',tab) INTO expected_count USING actor.id;
   SET LOCAL ROLE authenticated;
   EXECUTE format('SELECT count(*),count(*) FILTER (WHERE user_id<>$1) FROM public.%I',tab) INTO actual_count,foreign_count USING actor.id;
   RESET ROLE;
   IF actual_count<>expected_count OR foreign_count<>0 THEN RAISE EXCEPTION 'Account isolation check failed'; END IF;
  END LOOP;
  SELECT count(*) INTO expected_files FROM storage.objects WHERE bucket_id='study-files' AND split_part(name,'/',1)=actor.id::text;
  SET LOCAL ROLE authenticated;
  SELECT count(*), count(*) FILTER (WHERE auth_user_id<>auth.uid()) INTO actual_count,foreign_count FROM public.users;
  IF actual_count<>1 OR foreign_count<>0 THEN RAISE EXCEPTION 'Profile isolation check failed'; END IF;
  SELECT count(*), count(*) FILTER (WHERE split_part(name,'/',1)<>actor.id::text) INTO actual_count,foreign_count FROM storage.objects WHERE bucket_id='study-files';
  RESET ROLE;
  IF actual_count<>expected_files OR foreign_count<>0 THEN RAISE EXCEPTION 'File metadata isolation check failed'; END IF;
 END LOOP;
 IF checked_accounts<2 THEN RAISE EXCEPTION 'Need at least two confirmed accounts for isolation checks'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
 SET LOCAL ROLE anon;
 BEGIN
  SELECT count(*) INTO actual_count FROM public.notes;
  IF actual_count<>0 THEN RAISE EXCEPTION 'Anonymous note access detected'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  SELECT count(*) INTO actual_count FROM storage.objects;
  IF actual_count<>0 THEN RAISE EXCEPTION 'Anonymous file metadata access detected'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RESET ROLE;
END $$;
SELECT 'PASS: account/profile/file read isolation and anonymous denial' AS result;
ROLLBACK;
