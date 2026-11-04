-- LOCAL disposable database only, after both T4 migrations. No remote execution.
-- Plain PostgreSQL assertions (no test extension required); all fixtures roll back.
BEGIN;
\ir local/fixture-publication-setup.sql
DO $test$
DECLARE
  u uuid := gen_random_uuid(); s uuid := gen_random_uuid(); q uuid; opt uuid;
  expired uuid := gen_random_uuid(); early uuid := gen_random_uuid();
  legacy uuid := gen_random_uuid(); queued uuid := gen_random_uuid();
  legacy_queue uuid := gen_random_uuid(); offline uuid := gen_random_uuid();
  legacy_item uuid := gen_random_uuid(); bad uuid := gen_random_uuid();
  fresh_expired uuid := gen_random_uuid(); presencial uuid := gen_random_uuid();
  cutoff timestamptz; r record; i integer;
BEGIN
  SELECT deployed_at INTO STRICT cutoff FROM fase0_private.attempt_jobs_config WHERE singleton;
  -- Keep fixtures independent of wall clock and of a previous local deployment.
  UPDATE fase0_private.attempt_jobs_config SET deployed_at = now() - interval '1 hour' WHERE singleton;
  cutoff := now() - interval '1 hour';
  INSERT INTO auth.users(id, email) VALUES (u, u::text || '@example.invalid');
  PERFORM pg_temp.fixture_publication_begin();
  INSERT INTO public.simulados(id, title, slug, sequence_number, questions_count,
    execution_window_start, execution_window_end, results_release_at)
  VALUES(s, 'T4 fixture', s::text, 999999, 100, now()-interval '1 day', now()+interval '1 day', now()+interval '2 days');
  PERFORM pg_temp.fixture_publication_end();
  INSERT INTO public.attempts(id, simulado_id, user_id, attempt_type, status, effective_deadline, created_at)
  VALUES(expired,s,u,'online','in_progress',now()+interval '1 hour',now());
  FOR i IN 1..100 LOOP
    q := gen_random_uuid(); opt := gen_random_uuid();
    INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
      VALUES(q,s,i,'T4 question','clinica_medica','T4');
    INSERT INTO public.question_options(id,question_id,label,text,is_correct) VALUES(opt,q,'A','Correct',true);
    IF i <= 10 THEN
      INSERT INTO public.answers(attempt_id,question_id,selected_option_id) VALUES(expired,q,opt);
    END IF;
  END LOOP;
  UPDATE public.attempts SET effective_deadline = now()-interval '5 minutes' WHERE id=expired;
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  SELECT * INTO r FROM public.finalize_attempt_with_results(expired);
  ASSERT r.score_percentage = 10 AND r.total_answered = 10 AND r.total_correct = 10 AND r.total_questions = 100, '10/100 expired score';
  ASSERT (SELECT status='submitted' FROM public.attempts WHERE id=expired), 'expired submitted';
  ASSERT (SELECT count(*)=90 FROM public.attempt_question_results WHERE attempt_id=expired AND NOT was_answered AND NOT is_correct), 'blanks wrong';
  PERFORM public.finalize_attempt_with_results(expired, true);
  ASSERT (SELECT count(*)=100 FROM public.attempt_question_results WHERE attempt_id=expired), 'idempotent';
  ASSERT (SELECT count(*)=1 FROM public.user_performance_history WHERE attempt_id=expired), 'history idempotent';

  -- Distinct users avoid the existing unique (simulado,user,type) index.
  FOR i IN 1..9 LOOP
    u := gen_random_uuid(); INSERT INTO auth.users(id,email) VALUES(u,u::text||'@example.invalid');
    INSERT INTO public.attempts(id,simulado_id,user_id,attempt_type,status,effective_deadline,created_at)
    VALUES(CASE i WHEN 1 THEN early WHEN 2 THEN legacy WHEN 3 THEN queued WHEN 4 THEN offline
      WHEN 5 THEN legacy_queue WHEN 6 THEN legacy_item WHEN 7 THEN bad WHEN 8 THEN fresh_expired ELSE presencial END,
      s,u,CASE WHEN i=4 THEN 'offline' WHEN i=9 THEN 'presencial' ELSE 'online' END,
      (CASE WHEN i=4 THEN 'offline_pending' WHEN i=9 THEN 'presencial_pending' ELSE 'in_progress' END)::public.attempt_status,
      CASE WHEN i IN (1,4,5,7,9) THEN now()+interval '1 hour' ELSE now()-interval '5 minutes' END,
      CASE WHEN i IN (2,5) THEN cutoff-interval '1 day' ELSE now() END);
  END LOOP;
  SELECT user_id INTO u FROM public.attempts WHERE id=early;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  BEGIN
    PERFORM public.finalize_attempt_with_results(early);
    RAISE EXCEPTION 'manual incomplete unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Cannot submit:%unanswered' THEN RAISE; END IF;
  END;
  PERFORM public.finalize_attempt_with_results(early,true);
  ASSERT (SELECT score_percentage=0 AND status='submitted' FROM public.attempts WHERE id=early), 'explicit auto accepts blanks';

  -- Old offline/presencial callers omit the new default argument.
  INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
    SELECT offline, qo.question_id, qo.id FROM public.question_options qo JOIN public.questions q ON q.id=qo.question_id WHERE q.simulado_id=s;
  SELECT user_id INTO u FROM public.attempts WHERE id=offline;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  SELECT * INTO r FROM public.finalize_attempt_with_results(offline);
  ASSERT r.score_percentage=100, 'old offline wrapper';
  SELECT * INTO r FROM public.finalize_attempt_with_results_for_user(offline,u);
  ASSERT r.score_percentage=100, 'old explicit user caller';
  INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
    SELECT presencial,qo.question_id,qo.id FROM public.question_options qo JOIN public.questions q ON q.id=qo.question_id WHERE q.simulado_id=s;
  SELECT user_id INTO u FROM public.attempts WHERE id=presencial;
  PERFORM set_config('request.jwt.claim.sub','',true);
  SELECT * INTO r FROM public.finalize_attempt_with_results_for_user(presencial,u);
  ASSERT r.score_percentage=100, 'presencial helper without session, omitted default';

  INSERT INTO public.attempt_processing_queue(attempt_id,user_id,created_at)
    SELECT id,user_id,CASE WHEN id=legacy_item THEN cutoff-interval '1 day' ELSE now() END
    FROM public.attempts WHERE id IN (queued,legacy_queue,legacy_item);
  -- Mismatched queue owner exercises isolated failure (not auth.uid()).
  INSERT INTO public.attempt_processing_queue(attempt_id,user_id) VALUES(bad,u);
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM public.run_fase0_attempt_maintenance(20);
  ASSERT (SELECT status='submitted' FROM public.attempts WHERE id=queued), 'worker without auth.uid';
  ASSERT (SELECT status='completed' AND processed_at IS NOT NULL AND last_error IS NULL FROM public.attempt_processing_queue WHERE attempt_id=queued), 'queue retained';
  ASSERT (SELECT status='failed' AND last_error IS NOT NULL AND attempt_count=1 FROM public.attempt_processing_queue WHERE attempt_id=bad), 'isolated failure';
  ASSERT NOT EXISTS(SELECT 1 FROM public.attempt_processing_queue WHERE status='processing' AND attempt_id=bad), 'no orphan processing';
  ASSERT (SELECT status='in_progress' AND is_within_window=true FROM public.attempts WHERE id=legacy), 'expired legacy untouched';
  ASSERT (SELECT status='submitted' AND score_percentage=0 FROM public.attempts WHERE id=fresh_expired), 'new expiry processed independently of queue';
  ASSERT (SELECT status='pending' FROM public.attempt_processing_queue WHERE attempt_id=legacy_queue), 'old attempt new queue untouched';
  ASSERT (SELECT status='pending' FROM public.attempt_processing_queue WHERE attempt_id=legacy_item), 'new attempt old queue untouched';
  ASSERT (SELECT status='in_progress' FROM public.attempts WHERE id=legacy_item), 'expired attempt with old queue untouched';
  INSERT INTO fase0_private.attempt_jobs_config(singleton) VALUES(true) ON CONFLICT (singleton) DO NOTHING;
  ASSERT (SELECT deployed_at=cutoff FROM fase0_private.attempt_jobs_config WHERE singleton), 'cutoff unchanged on rerun';
  ASSERT NOT has_function_privilege('authenticated','public.finalize_attempt_with_results_for_user(uuid,uuid,boolean)','EXECUTE'), 'helper ACL';
  ASSERT NOT has_function_privilege('anon','public.finalize_attempt_with_results(uuid,boolean)','EXECUTE'), 'wrapper ACL';
  ASSERT NOT has_function_privilege('authenticated','public.run_fase0_attempt_maintenance(integer)','EXECUTE'), 'maintenance ACL';
  ASSERT has_function_privilege('service_role','public.run_fase0_attempt_maintenance(integer)','EXECUTE'), 'service ACL';
  ASSERT NOT has_schema_privilege('authenticated','fase0_private','USAGE'), 'cutoff not exposed';
  ASSERT (SELECT count(*)=1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='finalize_attempt_with_results'), 'no ambiguous overload';
  ASSERT (SELECT count(*)=1 FROM cron.job WHERE jobname='fase0-attempt-maintenance' AND schedule='*/5 * * * *'), 'single five-minute cron';
END;
$test$;
ROLLBACK;
