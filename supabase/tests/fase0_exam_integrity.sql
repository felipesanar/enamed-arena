-- Disposable LOCAL database only, with production schema restored (including
-- 20260906215529). Run before/after the migration, never against production.
-- supabase test db supabase/tests/fase0_exam_integrity.sql --local
BEGIN;
\ir local/fixture-publication-setup.sql
\if :{?sql_local}
\else
\set sql_local false
\endif
\if :sql_local
\ir local/assertions.sql
\else
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
\endif
SET LOCAL search_path = public, extensions;
SELECT no_plan();

CREATE FUNCTION pg_temp.t2_id(label text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT md5('fase0-t2:' || label)::uuid $$;

INSERT INTO auth.users(id, email, raw_user_meta_data)
SELECT pg_temp.t2_id(u), 'fase0-t2-' || u || '@example.invalid',
       jsonb_build_object('full_name', 'T2 ' || u)
FROM unnest(ARRAY['student', 'other', 'admin']) AS u;
INSERT INTO public.profiles(id, full_name)
SELECT pg_temp.t2_id(u), 'T2 ' || u
FROM unnest(ARRAY['student', 'other', 'admin']) AS u
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
INSERT INTO public.user_roles(user_id, role) VALUES (pg_temp.t2_id('admin'), 'admin')
ON CONFLICT DO NOTHING;
SELECT ok(EXISTS (SELECT 1 FROM public.role_capabilities
                 WHERE role = 'admin' AND capability = 'results.view'),
          'fixture admin has the existing results.view capability');

SELECT pg_temp.fixture_publication_begin();
INSERT INTO public.simulados(id, title, slug, sequence_number, status,
  questions_count, duration_minutes, execution_window_start,
  execution_window_end, results_release_at)
SELECT pg_temp.t2_id('sim' || n), 'T2 fixture ' || n, 'fase0-t2-' || n,
       900000 + n, 'published', 1, 60, now() - interval '1 hour',
       now() + interval '1 hour', now() + interval '2 hours'
FROM generate_series(1, 11) AS n;
SELECT pg_temp.fixture_publication_end();
INSERT INTO public.questions(id, simulado_id, question_number, text, area, theme)
SELECT pg_temp.t2_id('q' || n), pg_temp.t2_id('sim' || n), 1,
       'T2 question', 'Clinica Medica', 'T2' FROM generate_series(1, 11) AS n;
INSERT INTO public.question_options(id, question_id, label, text, is_correct)
SELECT pg_temp.t2_id('opt' || n), pg_temp.t2_id('q' || n), 'A', 'T2 correct', true
FROM generate_series(1, 11) AS n;
-- Isolated RPC fixtures only: map activation is outside this regression scope.
INSERT INTO public.presencial_cadernos(id, simulado_id, code, label, color, is_active)
VALUES
  (pg_temp.t2_id('caderno5'), pg_temp.t2_id('sim5'), 't2-active', 'T2 active', 'vermelho', true),
  (pg_temp.t2_id('caderno5-inactive'), pg_temp.t2_id('sim5'), 't2-inactive', 'T2 inactive', 'azul', false),
  (pg_temp.t2_id('caderno6'), pg_temp.t2_id('sim6'), 't2-foreign', 'T2 foreign', 'azul', true);
UPDATE public.simulados SET execution_window_end = now() - interval '1 minute'
WHERE id = pg_temp.t2_id('sim5');

INSERT INTO public.attempts(id, user_id, simulado_id, status, attempt_type,
  started_at, effective_deadline, is_within_window)
SELECT pg_temp.t2_id('a' || n), pg_temp.t2_id('student'), pg_temp.t2_id('sim' || n),
       (CASE n WHEN 5 THEN 'offline_pending' WHEN 6 THEN 'presencial_pending'
               ELSE 'in_progress' END)::public.attempt_status,
       CASE n WHEN 5 THEN 'offline' WHEN 6 THEN 'presencial' ELSE 'online' END,
       now() - interval '1 hour',
       CASE WHEN n IN (3, 5, 6) THEN now() - interval '31 seconds'
            WHEN n = 4 THEN now() - interval '30 seconds'
             ELSE now() + interval '1 hour' END, n <> 5
FROM generate_series(1, 7) AS n;
INSERT INTO public.attempts(id, user_id, simulado_id, status, attempt_type,
  started_at, effective_deadline, is_within_window)
VALUES (pg_temp.t2_id('a11'), pg_temp.t2_id('student'), pg_temp.t2_id('sim11'),
        'expired', 'online', now(), now() + interval '1 hour', true);
-- Seed before closing, since the new answers trigger also applies to owners.
INSERT INTO public.answers(attempt_id, question_id, selected_option_id)
SELECT pg_temp.t2_id('a' || n), pg_temp.t2_id('q' || n), pg_temp.t2_id('opt' || n)
FROM generate_series(1, 2) AS n;
UPDATE public.attempts SET status = 'submitted', score_percentage = 100,
  total_correct = 1, total_answered = 1, finished_at = now()
WHERE id = pg_temp.t2_id('a2');
INSERT INTO public.attempt_question_results(attempt_id, question_id,
  selected_option_id, correct_option_id, is_correct, was_answered)
VALUES (pg_temp.t2_id('a2'), pg_temp.t2_id('q2'), pg_temp.t2_id('opt2'),
        pg_temp.t2_id('opt2'), true, true);

-- Real production uniqueness is (simulado_id,user_id,attempt_type).
UPDATE public.attempts SET status = 'submitted', score_percentage = 70,
  total_correct = 7, total_answered = 10, finished_at = now() - interval '1 hour'
WHERE id = pg_temp.t2_id('a7');
INSERT INTO public.attempts(id, user_id, simulado_id, status, attempt_type,
  started_at, effective_deadline, finished_at, score_percentage,
  total_correct, total_answered, is_within_window)
VALUES
  (pg_temp.t2_id('rank-best'), pg_temp.t2_id('student'), pg_temp.t2_id('sim7'),
   'submitted', 'offline', now(), now(), now(), 90, 9, 10, true),
  (pg_temp.t2_id('rank-train'), pg_temp.t2_id('student'), pg_temp.t2_id('sim7'),
   'submitted', 'presencial', now(), now(), now(), 100, 10, 10, false),
  (pg_temp.t2_id('rank-other'), pg_temp.t2_id('other'), pg_temp.t2_id('sim7'),
   'expired', 'online', now(), now(), now(), 80, 8, 10, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.t2_id('student')::text, true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.t2_id('student'), 'role', 'authenticated')::text, true);

SELECT throws_ok($sql$SELECT grant_statements FROM public._fase0_exam_integrity_rollback_acl$sql$,
  '42501', NULL, 'rollback privilege checkpoint is not readable by clients');
SELECT throws_ok($sql$INSERT INTO public.attempts(user_id, simulado_id, effective_deadline)
  VALUES (auth.uid(), pg_temp.t2_id('sim11'), now())$sql$,
  '42501', NULL, 'direct INSERT attempts denied by privilege');
SELECT throws_ok(format('UPDATE public.attempts SET %s WHERE id = %L', assignment,
                         pg_temp.t2_id('a1')), 'P0001', NULL,
                 'direct protected field rejected: ' || assignment)
FROM unnest(ARRAY[
  'score_percentage = 99', 'total_correct = 99', 'total_answered = 99',
  'finished_at = now()', 'is_within_window = false', 'status = ''submitted''',
  'user_id = ''' || pg_temp.t2_id('other') || '''',
  'simulado_id = ''' || pg_temp.t2_id('sim11') || '''',
  'started_at = now()', 'effective_deadline = now() + interval ''1 day''',
  'attempt_type = ''offline''',
  'id = ''' || pg_temp.t2_id('a1-forged') || '''',
  'caderno_id = ''' || pg_temp.t2_id('caderno5') || '''',
  'created_at = ''2000-01-01T00:00:00Z''::timestamptz'
]) AS assignment;
SELECT throws_ok($sql$UPDATE public.attempts SET caderno_id = pg_temp.t2_id('caderno5')
  WHERE id = pg_temp.t2_id('a5')$sql$, 'P0001', NULL,
  'client cannot forge a same-simulado caderno to enter ranking outside the window');
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT throws_ok($sql$UPDATE public.attempts SET effective_deadline = now() + interval '1 day'
  WHERE id = pg_temp.t2_id('a1')$sql$, 'P0001', NULL,
  'a JWT setting cannot elevate the authenticated SQL role');
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok($sql$UPDATE public.attempts SET current_question_index = 1
  WHERE id = pg_temp.t2_id('a1')$sql$, 'unprotected progress UPDATE still works');
SELECT lives_ok($sql$INSERT INTO public.answers(attempt_id, question_id, selected_option_id)
  VALUES (pg_temp.t2_id('a1'), pg_temp.t2_id('q1'), pg_temp.t2_id('opt1'))
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id$sql$,
  'active online upsert works');
SELECT throws_ok($sql$INSERT INTO public.answers(attempt_id, question_id, selected_option_id)
  VALUES (pg_temp.t2_id('a2'), pg_temp.t2_id('q2'), pg_temp.t2_id('opt2'))
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id$sql$,
  'P0001', NULL, 'submitted online upsert rejected');
SELECT throws_ok($sql$UPDATE public.answers SET marked_for_review = true
  WHERE attempt_id = pg_temp.t2_id('a2')$sql$,
  'P0001', NULL, 'submitted online UPDATE rejected');
SELECT throws_ok($sql$INSERT INTO public.answers(attempt_id, question_id)
  VALUES (pg_temp.t2_id('a3'), pg_temp.t2_id('q3'))$sql$,
  'P0001', NULL, 'deadline plus 31 seconds rejected');
SELECT throws_ok($sql$INSERT INTO public.answers(attempt_id, question_id)
  VALUES (pg_temp.t2_id('a11'), pg_temp.t2_id('q11'))$sql$,
  'P0001', NULL, 'expired status rejected even with future deadline');
SELECT lives_ok($sql$INSERT INTO public.answers(attempt_id, question_id)
  VALUES (pg_temp.t2_id('a4'), pg_temp.t2_id('q4'))$sql$,
  'deadline plus exactly 30 seconds accepted');
SELECT throws_ok($sql$INSERT INTO public.answers(attempt_id, question_id)
  VALUES (pg_temp.t2_id('a1'), pg_temp.t2_id('q11'))$sql$,
  'P0001', NULL, 'question from another exam rejected');
SELECT throws_ok($sql$UPDATE public.answers SET selected_option_id = pg_temp.t2_id('opt11')
  WHERE attempt_id = pg_temp.t2_id('a1')$sql$,
  'P0001', NULL, 'option from another question rejected');
SELECT throws_ok($sql$UPDATE public.answers SET attempt_id = pg_temp.t2_id('a4')
  WHERE attempt_id = pg_temp.t2_id('a1')$sql$,
  'P0001', NULL, 'answer cannot move between attempts');
SELECT throws_ok($sql$INSERT INTO public.answers(attempt_id, question_id)
  VALUES (pg_temp.t2_id('a5'), pg_temp.t2_id('q5'))$sql$,
  'P0001', NULL, 'offline direct REST write rejected (RPC required)');
SELECT throws_ok($sql$SELECT public.submit_offline_answers_guarded(pg_temp.t2_id('a5'),
  jsonb_build_array(jsonb_build_object('question_id', pg_temp.t2_id('q5'),
                                     'selected_option_id', pg_temp.t2_id('opt11'))))$sql$,
  'P0001', NULL, 'offline DEFINER RPC cannot bypass option relationship validation');

SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          0::bigint, 'RPC hides unreleased results');
SELECT is((SELECT count(*) FROM public.attempt_question_results
           WHERE attempt_id = pg_temp.t2_id('a2')), 0::bigint, 'RLS hides unreleased results');
SELECT is((SELECT count(*) FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))),
          0::bigint, 'ranking hidden before release');

-- These actual SECURITY DEFINER RPCs nest the INVOKER attempts trigger.
SELECT lives_ok($sql$SELECT public.create_attempt_guarded(pg_temp.t2_id('sim8'))$sql$,
                'online guarded creation survives INSERT revoke');
SELECT lives_ok($sql$SELECT public.create_offline_attempt_guarded(pg_temp.t2_id('sim9'))$sql$,
                'offline guarded creation survives INSERT revoke');
SELECT lives_ok($sql$SELECT public.create_presencial_attempt_guarded(pg_temp.t2_id('sim10'))$sql$,
                'presencial guarded creation survives INSERT revoke');
SELECT throws_ok($sql$SELECT public.set_attempt_caderno_guarded(pg_temp.t2_id('a5'), 't2-inactive')$sql$,
  'P0001', 'CADERNO_UNAVAILABLE', 'guarded caderno RPC still rejects inactive caderno');
SELECT throws_ok($sql$SELECT public.set_attempt_caderno_guarded(pg_temp.t2_id('a5'), 't2-foreign')$sql$,
  'P0001', 'CADERNO_UNAVAILABLE', 'guarded caderno RPC still rejects another simulado');
SELECT throws_ok($sql$SELECT public.set_attempt_caderno_guarded(pg_temp.t2_id('rank-other'), 't2-active')$sql$,
  'P0001', 'ATTEMPT_NOT_FOUND', 'guarded caderno RPC still requires ownership');
SELECT lives_ok($sql$SELECT public.set_attempt_caderno_guarded(pg_temp.t2_id('a5'), 't2-active')$sql$,
  'legitimate DEFINER caderno assignment survives INVOKER trigger');
SELECT is((SELECT caderno_id FROM public.attempts WHERE id = pg_temp.t2_id('a5')),
          pg_temp.t2_id('caderno5'), 'guarded RPC persisted selected caderno');
SELECT throws_ok($sql$UPDATE public.attempts SET caderno_id = NULL
  WHERE id = pg_temp.t2_id('a5')$sql$, 'P0001', NULL,
  'client cannot clear a legitimately assigned caderno');
SELECT ok((SELECT created_at = now() FROM public.attempts WHERE id = pg_temp.t2_id('a1')),
          'rejected direct UPDATE preserves created_at used by legacy cutoff');
SELECT lives_ok($sql$SELECT public.submit_offline_answers_guarded(pg_temp.t2_id('a5'),
  jsonb_build_array(jsonb_build_object('question_id', pg_temp.t2_id('q5'),
                                     'selected_option_id', pg_temp.t2_id('opt5'))))$sql$,
  'offline RPC writes after deadline and finalizes through invoker trigger');
SELECT is((SELECT status::text FROM public.attempts WHERE id = pg_temp.t2_id('a5')),
          'submitted', 'nested offline finalize persisted protected status');
SELECT ok((SELECT is_within_window FROM public.attempts WHERE id = pg_temp.t2_id('a5')),
          'legitimately assigned caderno retains production ranking rule outside window');
SELECT throws_ok($sql$SELECT public.set_attempt_caderno_guarded(pg_temp.t2_id('a5'), 't2-active')$sql$,
  'P0001', 'ATTEMPT_NOT_PENDING', 'guarded RPC still refuses caderno assignment after submission');
SELECT lives_ok($sql$INSERT INTO public.answers(attempt_id, question_id, selected_option_id)
  SELECT id, pg_temp.t2_id('q8'), pg_temp.t2_id('opt8') FROM public.attempts
  WHERE simulado_id = pg_temp.t2_id('sim8') AND user_id = auth.uid()$sql$,
  'online RPC-created attempt accepts valid answers');
SELECT lives_ok($sql$SELECT public.finalize_attempt_with_results(id) FROM public.attempts
  WHERE simulado_id = pg_temp.t2_id('sim8') AND user_id = auth.uid()$sql$,
  'online finalize nested RPC can update protected fields');
SELECT lives_ok($sql$UPDATE public.answers SET selected_option_id = pg_temp.t2_id('opt4')
  WHERE attempt_id = pg_temp.t2_id('a4')$sql$, 'answer can change inside grace period');
SELECT lives_ok($sql$SELECT public.finalize_attempt_with_results(pg_temp.t2_id('a4'))$sql$,
  'online grace-period finalize still works');
SELECT ok((SELECT finished_at = effective_deadline FROM public.attempts
           WHERE id = pg_temp.t2_id('a4')), 'online finish is capped to server deadline');

RESET ROLE;
-- Service-only presencial submit also goes through both new triggers.
SET LOCAL ROLE service_role;
SELECT lives_ok($sql$SELECT public.submit_presencial_answers(pg_temp.t2_id('a6'),
  pg_temp.t2_id('student'), jsonb_build_array(jsonb_build_object(
    'question_id', pg_temp.t2_id('q6'), 'selected_option_id', pg_temp.t2_id('opt6'))))$sql$,
  'service presencial RPC accepts pending attempt after deadline');
SELECT lives_ok($sql$SELECT public.finalize_attempt_with_results_for_user(
  pg_temp.t2_id('a4'), pg_temp.t2_id('student'))$sql$,
  'service finalizer can revisit a closed overdue online attempt without writing answers');
RESET ROLE;
-- Release boundary remains exactly now; the integrated edition window must end first.
UPDATE public.simulados SET execution_window_end = now(), results_release_at = now() WHERE id IN
  (pg_temp.t2_id('sim2'), pg_temp.t2_id('sim7'));
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          1::bigint, 'RPC releases result at release instant');
SELECT is((SELECT count(*) FROM public.attempt_question_results
           WHERE attempt_id = pg_temp.t2_id('a2')), 1::bigint, 'RLS releases result');
SELECT is((SELECT count(*) FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))),
          2::bigint, 'ranking counts distinct users, not attempts');
SELECT is((SELECT nota_final FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))
           WHERE user_id = auth.uid()), 90::numeric, 'best in-window score wins, training excluded');
SELECT ok((SELECT bool_and(total_candidatos = 2) AND max(posicao) = 2
           FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))),
          'deduplicated total and contiguous positions');
SELECT set_config('request.jwt.claim.sub', pg_temp.t2_id('other')::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.t2_id('other'), 'role', 'authenticated')::text, true);
SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          0::bigint, 'released result still requires ownership');
SELECT is((SELECT count(*) FROM public.attempt_question_results
           WHERE attempt_id = pg_temp.t2_id('a2')), 0::bigint, 'released RLS still requires ownership');

RESET ROLE;
UPDATE public.attempts SET score_percentage = 90 WHERE id = pg_temp.t2_id('a7');
SET LOCAL ROLE authenticated;
SELECT is((SELECT total_correct FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))
           WHERE user_id = pg_temp.t2_id('student')), 7, 'equal score chooses earliest finish');
RESET ROLE;
UPDATE public.attempts SET finished_at = now() WHERE id = pg_temp.t2_id('a7');
UPDATE public.attempts SET score_percentage = 90 WHERE id = pg_temp.t2_id('rank-other');
SET LOCAL ROLE authenticated;
SELECT is((SELECT total_correct FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))
           WHERE user_id = pg_temp.t2_id('student')),
          CASE WHEN pg_temp.t2_id('a7') < pg_temp.t2_id('rank-best') THEN 7 ELSE 9 END,
          'identical score and finish choose stable attempt ID');
SELECT is((SELECT array_agg(user_id ORDER BY posicao)
           FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))),
          (SELECT array_agg(u ORDER BY u) FROM unnest(ARRAY[
            pg_temp.t2_id('student'), pg_temp.t2_id('other')]) AS u),
          'identical scores and finish rank users in stable UUID order');

RESET ROLE;
-- Exercise NULL defensively even on schemas currently enforcing NOT NULL.
ALTER TABLE public.simulados ALTER COLUMN results_release_at DROP NOT NULL;
UPDATE public.simulados SET results_release_at = NULL WHERE id IN
  (pg_temp.t2_id('sim2'), pg_temp.t2_id('sim7'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.t2_id('student')::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.t2_id('student'), 'role', 'authenticated')::text, true);
SELECT is((SELECT count(*) FROM public.get_ranking_for_simulado(pg_temp.t2_id('sim7'))),
          0::bigint, 'NULL release denies ranking');
SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          0::bigint, 'NULL release denies result RPC');
SELECT is((SELECT count(*) FROM public.attempt_question_results
           WHERE attempt_id = pg_temp.t2_id('a2')), 0::bigint, 'NULL release denies RLS');
SELECT set_config('request.jwt.claim.sub', pg_temp.t2_id('other')::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.t2_id('other'), 'role', 'authenticated')::text, true);
SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          0::bigint, 'another student cannot see result');
SELECT set_config('request.jwt.claim.sub', pg_temp.t2_id('admin')::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.t2_id('admin'), 'role', 'authenticated')::text, true);
SELECT is((SELECT count(*) FROM public.get_attempt_question_results(pg_temp.t2_id('a2'))),
          1::bigint, 'results.view capability bypasses release in RPC');
SELECT is((SELECT count(*) FROM public.attempt_question_results
           WHERE attempt_id = pg_temp.t2_id('a2')), 1::bigint, 'results.view capability bypasses release in RLS');
RESET ROLE;
SELECT ok(NOT has_table_privilege('anon', 'public.attempts', 'INSERT'), 'anon cannot INSERT attempts');
SELECT ok(NOT has_table_privilege('authenticated', 'public.attempts', 'INSERT'), 'authenticated cannot INSERT attempts');
SELECT ok(NOT has_function_privilege('anon', 'public.get_ranking_for_simulado(uuid)', 'EXECUTE'),
          'anon cannot execute ranking');
SELECT ok(NOT has_function_privilege('anon', 'public.get_attempt_question_results(uuid)', 'EXECUTE'),
          'anon cannot execute results RPC');
SELECT * FROM finish();
ROLLBACK;

-- External two-session rehearsal (not executable inside a single pgTAP tx):
-- A: BEGIN; SELECT id FROM attempts WHERE id = :active_attempt FOR UPDATE;
-- B: authenticated valid answer upsert for :active_attempt must WAIT.
-- A: finalize_attempt_with_results(:active_attempt); COMMIT;
-- B: must reject P0001 after acquiring the parent lock, with no answer change.
-- Reverse: A upserts valid answer, B finalizes and waits, A commits;
-- B must grade that committed answer. Repeat under READ COMMITTED.
