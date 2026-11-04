-- Local disposable database only. Transactional fixtures; managed Auth/REST are not exercised.
\set ON_ERROR_STOP on
BEGIN;
\ir local/fixture-publication-setup.sql
DO $local_only$
BEGIN
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 54737
    OR session_user <> 'postgres' OR current_database() !~ '^enamed_test_(attempt|fixtures_integrated)_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Attempt fixture requires its exclusive local allowlisted database';
  END IF;
END;
$local_only$;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='3s';
\ir local/assertions.sql
SET LOCAL search_path = public, extensions;
SELECT no_plan();
CREATE FUNCTION pg_temp.f1_id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE
AS $$ SELECT md5('f1-reliability:' || label)::uuid $$;
INSERT INTO auth.users(id, email, raw_user_meta_data)
SELECT pg_temp.f1_id(u), u || '-f1-reliability@example.invalid', '{}'::jsonb
FROM unnest(ARRAY['student','other']) u;
SELECT pg_temp.fixture_publication_begin();
INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,
 execution_window_start,execution_window_end,results_release_at)
SELECT pg_temp.f1_id('sim' || n), 'Reliability fixture', 'f1-reliability-' || n, 990100+n,
 'published',1,60,now()-interval '2 hours',now()+interval '1 hour',now()+interval '3 hours'
FROM generate_series(1,6) n;
SELECT pg_temp.fixture_publication_end();
UPDATE public.simulados SET execution_window_start=now()+interval '1 hour', execution_window_end=now()+interval '2 hours'
WHERE id=pg_temp.f1_id('sim1');
UPDATE public.simulados SET execution_window_end=now()-interval '1 hour' WHERE id=pg_temp.f1_id('sim3');
INSERT INTO public.attempts(user_id,simulado_id,status,attempt_type,started_at,effective_deadline)
VALUES (pg_temp.f1_id('student'),pg_temp.f1_id('sim4'),'offline_pending','offline',now(),now()),
 (pg_temp.f1_id('student'),pg_temp.f1_id('sim5'),'presencial_pending','presencial',now(),now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('student')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('student'),'role','authenticated')::text,true);
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim1')) $$,'P0001',NULL,'before opening rejected');
SELECT is((SELECT count(*)::int FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim1')),0,'early create writes nothing');
SELECT lives_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim2')) $$,'official online creation');
SELECT is((public.create_attempt_guarded(pg_temp.f1_id('sim2'))).id,
 (SELECT id FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim2')),'idempotent ID');
SELECT ok((public.create_attempt_guarded(pg_temp.f1_id('sim2'))).is_within_window,'official ranking flag');
SELECT is((public.create_attempt_guarded(pg_temp.f1_id('sim2'))).effective_deadline,
 now()+interval '1 hour','official deadline is bounded by window');
SELECT ok(NOT (public.create_attempt_guarded(pg_temp.f1_id('sim3'))).is_within_window,'late training excluded from ranking');
SELECT is((public.create_attempt_guarded(pg_temp.f1_id('sim3'))).effective_deadline,now()+interval '60 minutes','late deadline is personal');
SELECT lives_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim4')) $$,'offline does not block online');
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim5')) $$,'P0001','PRESENCIAL_ATTEMPT_EXISTS','presencial precedence retained');
SELECT public.update_attempt_progress_guarded((public.create_attempt_guarded(pg_temp.f1_id('sim2'))).id,0,20,12);
SELECT public.update_attempt_progress_guarded((public.create_attempt_guarded(pg_temp.f1_id('sim2'))).id,0,n,n)
FROM generate_series(10,0,-1) n;
SELECT is((SELECT tab_exit_count FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim2')),20,'old burst cannot lower tab count');
SELECT is((SELECT fullscreen_exit_count FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim2')),12,'old burst cannot lower fullscreen count');
SELECT id AS protected_attempt FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim2') \gset
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('other')::text,true);
SELECT throws_ok(format('SELECT public.update_attempt_progress_guarded(%L,0,99,99)', :'protected_attempt'),'P0001',NULL,'foreign attempt ID rejected');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim6')) $$,'42501',NULL,'missing authentication rejected');
RESET ROLE;
UPDATE public.attempts SET status='submitted' WHERE simulado_id=pg_temp.f1_id('sim2');
UPDATE public.attempts SET status='expired' WHERE simulado_id=pg_temp.f1_id('sim3');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('student')::text,true);
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim2')) $$,'P0001','Attempt already submitted for this simulado','no new retry policy');
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('sim3')) $$,'P0001','Attempt already submitted for this simulado','expired cannot restart');
SELECT throws_ok($$ SELECT public.create_attempt_guarded(pg_temp.f1_id('missing')) $$,'P0001','Simulado not found or not published','missing simulado rejected');
SELECT throws_ok($$ SELECT public.update_attempt_progress_guarded((SELECT id FROM public.attempts WHERE simulado_id=pg_temp.f1_id('sim2')),0,99,99) $$,'P0001',NULL,'finalized progress rejected');
SELECT throws_ok($$ UPDATE public.attempts SET score_percentage=100 WHERE simulado_id=pg_temp.f1_id('sim3') $$,'P0001',NULL,'protected fields retained');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.create_attempt_guarded(uuid)','EXECUTE'),'anonymous create denied');
SELECT ok(NOT has_function_privilege('anon','public.update_attempt_progress_guarded(uuid,integer,integer,integer)','EXECUTE'),'anonymous progress denied');
SELECT ok(NOT has_table_privilege('authenticated','public._fase1_attempt_reliability_rollback','SELECT'),'rollback checkpoint private');
SELECT * FROM finish();
ROLLBACK;
