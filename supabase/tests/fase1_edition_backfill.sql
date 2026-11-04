\set ON_ERROR_STOP on
\pset pager off
-- Driver for a FRESH clone of the Unicode F0 catalog, not a post-F1 database.
-- Pass -v migration_path=supabase/migrations/20261104065001_fase1_edition_model.sql
-- Optional -v skip_migration=1 is the negative control: it MUST exit nonzero.
-- Migration BEGIN/COMMIT is real; temp checkpoints survive those commits.
DO $$ BEGIN
  IF current_database() !~ '^enamed_test_f1_backfill_[a-zA-Z0-9_]+$'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() IS DISTINCT FROM 54737
     OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Requires postgres on 127.0.0.1:54737/enamed_test_f1_backfill_*';
  END IF;
  IF (SELECT datlocprovider <> 'i' OR datlocale <> 'en-US'
      FROM pg_database WHERE datname = current_database()) THEN
    RAISE EXCEPTION 'Requires QA Unicode ICU/en-US baseline';
  END IF;
  IF to_regclass('public.exam_blueprints') IS NOT NULL
     OR EXISTS (SELECT FROM public.attempts) OR EXISTS (SELECT FROM public.simulados)
     OR EXISTS (SELECT FROM auth.users) THEN
    RAISE EXCEPTION 'Requires empty pre-F1 disposable catalog; never reuse a populated database';
  END IF;
END $$;
\if :{?migration_path}
\else
  \echo 'Required psql variable: migration_path (real F1 migration)'
  \quit 3
\endif
SELECT current_database() AS test_database, inet_server_addr() AS server,
       inet_server_port() AS port, version();

BEGIN;
CREATE TEMP TABLE f1_checks(label text NOT NULL);
CREATE FUNCTION pg_temp.check_f1(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
  INSERT INTO pg_temp.f1_checks VALUES (label);
  RAISE NOTICE 'PASS: %',label;
END $$;
CREATE FUNCTION pg_temp.id_f1(label text) RETURNS uuid LANGUAGE sql IMMUTABLE
AS $$ SELECT md5('f1-backfill:' || label)::uuid $$;

-- Avoid even attempting the HubSpot dependency. No external integration runs.
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT pg_temp.id_f1(u),'f1-backfill-' || u || '@example.invalid',
       jsonb_build_object('full_name','Backfill ' || u)
FROM unnest(ARRAY['alice','bob','carol']) u;
INSERT INTO public.profiles(id,full_name)
SELECT pg_temp.id_f1(u),'Backfill ' || u FROM unnest(ARRAY['alice','bob','carol']) u
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_created_hubspot;
INSERT INTO public.enamed_specialties(id,name,slug) VALUES
 (pg_temp.id_f1('specialty-old'),'Backfill old specialty','f1-backfill-specialty-old'),
 (pg_temp.id_f1('specialty-new'),'Backfill new specialty','f1-backfill-specialty-new');
INSERT INTO public.enamed_institutions(id,name,slug,uf) VALUES
 (pg_temp.id_f1('institution-old'),'Backfill old institution','f1-backfill-institution-old','SP'),
 (pg_temp.id_f1('institution-new'),'Backfill new institution','f1-backfill-institution-new','BA');
INSERT INTO public.onboarding_profiles(user_id,specialty_id,target_institution_ids)
SELECT pg_temp.id_f1(u),pg_temp.id_f1('specialty-old'),ARRAY[pg_temp.id_f1('institution-old')]
FROM unnest(ARRAY['alice','carol']) u;
SELECT pg_temp.check_f1(NOT EXISTS (SELECT FROM public.onboarding_profiles
 WHERE user_id = pg_temp.id_f1('bob')),'historical student without onboarding really exists');

INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,
 execution_window_start,execution_window_end,results_release_at)
VALUES
 (pg_temp.id_f1('sim1'),'Backfill S1','f1-backfill-s1',1,'published',11,
  '2026-01-01 09:00Z','2026-01-01 10:00Z','2026-01-01 11:00Z'),
 (pg_temp.id_f1('sim7'),'Backfill inconsistent S7','f1-backfill-s7',7,'published',0,
  '2026-01-07 09:00Z','2026-01-07 10:00Z','2026-01-07 09:58Z');
-- Seven genuinely distinct official areas and four intentionally unresolved.
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
SELECT pg_temp.id_f1('q' || n),pg_temp.id_f1('sim1'),n,'Backfill question ' || n,area,'Backfill'
FROM unnest(ARRAY['  CLÍNICA   MÉDICA  ','Cirurgia','Ginecologia','Pediatria',
 'Medicina da Família e Comunidade','Saúde Mental','Saúde Coletiva','Preventiva ',
 'Saúde Coletiva / Preventiva','Clínica Médica / Preventiva','MFC / Saúde Coletiva'])
 WITH ORDINALITY q(area,n);
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
SELECT pg_temp.id_f1('o' || n || label),pg_temp.id_f1('q' || n),label,
       'Backfill option ' || label,label = 'A'
FROM generate_series(1,11) n CROSS JOIN unnest(ARRAY['A','B']) label;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,
 started_at,effective_deadline,is_within_window)
SELECT pg_temp.id_f1('a-' || u),pg_temp.id_f1(u),pg_temp.id_f1('sim1'),
 'offline_pending','offline','2026-01-01 09:00Z','2026-01-01 10:00Z',u <> 'carol'
FROM unnest(ARRAY['alice','bob','carol']) u;
-- Offline saves use the existing elevated F0 path; no expired online saves.
INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
SELECT pg_temp.id_f1('a-' || u),pg_temp.id_f1('q' || n),
 pg_temp.id_f1('o' || n || CASE WHEN u = 'alice' OR (u = 'bob' AND n <= 5)
                                OR (u = 'carol' AND n <= 3) THEN 'A' ELSE 'B' END)
FROM unnest(ARRAY['alice','bob','carol']) u CROSS JOIN generate_series(1,11) n;
INSERT INTO public.attempt_question_results(attempt_id,question_id,selected_option_id,
 correct_option_id,is_correct,was_answered)
SELECT a.attempt_id,a.question_id,a.selected_option_id,o.id,a.selected_option_id = o.id,true
FROM public.answers a JOIN public.question_options o ON o.question_id = a.question_id AND o.is_correct
WHERE a.attempt_id IN (pg_temp.id_f1('a-alice'),pg_temp.id_f1('a-bob'));
-- Historical fixture facts, not a replacement of the application's finalizer.
UPDATE public.attempts SET status = 'submitted',finished_at = '2026-01-01 09:30Z',
 score_percentage = 100,total_correct = 11,total_answered = 11 WHERE id = pg_temp.id_f1('a-alice');
UPDATE public.attempts SET status = 'expired',finished_at = '2026-01-01 09:40Z',
 score_percentage = 45.45,total_correct = 5,total_answered = 11 WHERE id = pg_temp.id_f1('a-bob');

-- Authenticated identity is needed by the REAL ranking RPC, even as SQL owner.
SELECT set_config('request.jwt.claim.sub',pg_temp.id_f1('alice')::text,false);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id_f1('alice'),'role','authenticated')::text,false);
CREATE TEMP TABLE f1_counts AS
SELECT (SELECT count(*) FROM public.attempts) AS attempts,
       (SELECT count(*) FROM public.answers) AS answers,
       (SELECT count(*) FROM public.attempt_question_results) AS results;
SELECT pg_temp.check_f1(attempts = 3 AND answers = 33 AND results = 22,
 'pre-F1 counts are genuinely nonzero: 3 attempts / 33 answers / 22 results') FROM f1_counts;
CREATE TEMP TABLE f1_ranking_before AS
SELECT jsonb_agg(to_jsonb(r) ORDER BY r.posicao) AS payload
FROM public.get_ranking_for_simulado(pg_temp.id_f1('sim1')) r;
SELECT pg_temp.check_f1(jsonb_array_length(payload) = 2
 AND (payload->0->>'nota_final')::numeric = 100 AND (payload->1->>'nota_final')::numeric = 45.45,
 'pre-F1 REAL ranking RPC contains two deterministically ordered students') FROM f1_ranking_before;
TABLE f1_counts;
TABLE f1_ranking_before;
CREATE TEMP TABLE f1_attempts_before AS SELECT id,to_jsonb(a) AS payload FROM public.attempts a;
CREATE TEMP TABLE f1_answers_before AS SELECT id,to_jsonb(a) AS payload FROM public.answers a;
CREATE TEMP TABLE f1_results_before AS SELECT attempt_id,question_id,to_jsonb(r) AS payload FROM public.attempt_question_results r;
CREATE TEMP TABLE f1_questions_before AS SELECT id,to_jsonb(q) AS payload FROM public.questions q;
CREATE TEMP TABLE f1_dates_before AS
SELECT id,execution_window_start,execution_window_end,results_release_at FROM public.simulados;
COMMIT;

\if :{?skip_migration}
  \echo 'RED control: intentionally skipping F1 migration'
\else
  \echo 'Applying real migration to nonzero historical fixtures'
  \i :migration_path
\endif
SELECT pg_temp.check_f1(to_regclass('public.app_config') IS NOT NULL,
 'real F1 migration must create app_config (negative control fails here)');

CREATE FUNCTION pg_temp.verify_f1_history() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM pg_temp.check_f1((SELECT count(*) FROM public.attempts) = c.attempts
    AND (SELECT count(*) FROM public.answers) = c.answers
    AND (SELECT count(*) FROM public.attempt_question_results) = c.results,
    'attempt/answer/result counts unchanged') FROM pg_temp.f1_counts c;
  PERFORM pg_temp.check_f1(NOT EXISTS (
    SELECT FROM public.attempts a JOIN pg_temp.f1_attempts_before b USING (id)
    WHERE to_jsonb(a) - ARRAY['edition_id','specialty_id_at_finish','target_institution_ids_at_finish','snapshot_backfilled'] IS DISTINCT FROM b.payload),
    'every original attempt field unchanged');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.answers a JOIN pg_temp.f1_answers_before b USING (id)
    WHERE to_jsonb(a) IS DISTINCT FROM b.payload),'every original answer unchanged');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.attempt_question_results r
    JOIN pg_temp.f1_results_before b USING (attempt_id,question_id)
    WHERE to_jsonb(r) IS DISTINCT FROM b.payload),'every original question result unchanged');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.questions q JOIN pg_temp.f1_questions_before b USING (id)
    WHERE to_jsonb(q) - 'area_id' IS DISTINCT FROM b.payload),'legacy question text/area unchanged');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.simulados s JOIN pg_temp.f1_dates_before b USING (id)
    WHERE ROW(s.execution_window_start,s.execution_window_end,s.results_release_at)
      IS DISTINCT FROM ROW(b.execution_window_start,b.execution_window_end,b.results_release_at)),
    'all historical window/release dates unchanged including inconsistent S7');
  PERFORM pg_temp.check_f1((SELECT results_release_at = execution_window_end - interval '2 minutes'
    FROM public.simulados WHERE id = pg_temp.id_f1('sim7')),'S7 inconsistency preserved, not silently repaired');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.simulados s JOIN public.exam_editions e ON e.id = s.edition_id
    WHERE e.code <> '2026') AND (SELECT count(*) = 2 FROM public.simulados),'only legacy 2026 receives simulados');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.attempts a JOIN public.simulados s ON s.id = a.simulado_id
    WHERE a.edition_id IS DISTINCT FROM s.edition_id OR a.edition_id IS NULL),'every attempt edition matches parent');
  PERFORM pg_temp.check_f1((SELECT specialty_id_at_finish = pg_temp.id_f1('specialty-old')
    AND target_institution_ids_at_finish = ARRAY[pg_temp.id_f1('institution-old')] AND snapshot_backfilled
    FROM public.attempts WHERE id = pg_temp.id_f1('a-alice')),'historical submitted snapshot uses old profile, marked backfilled');
  PERFORM pg_temp.check_f1((SELECT specialty_id_at_finish IS NULL
    AND target_institution_ids_at_finish = '{}'::uuid[] AND snapshot_backfilled
    FROM public.attempts WHERE id = pg_temp.id_f1('a-bob')),'historical expired without profile has unknown snapshot, marked backfilled');
  PERFORM pg_temp.check_f1((SELECT specialty_id_at_finish IS NULL
    AND target_institution_ids_at_finish IS NULL AND NOT snapshot_backfilled
    FROM public.attempts WHERE id = pg_temp.id_f1('a-carol')),'pending attempt is not prematurely snapshotted');
  PERFORM pg_temp.check_f1((SELECT count(DISTINCT area_id) = 7
    AND count(*) FILTER (WHERE area_id IS NOT NULL) = 7
    AND count(*) FILTER (WHERE area_id IS NULL) = 4 FROM public.questions),'seven populated distinct areas plus four unresolved aliases');
  PERFORM pg_temp.check_f1((SELECT area_id IS DISTINCT FROM
    (SELECT area_id FROM public.questions WHERE id = pg_temp.id_f1('q7'))
    FROM public.questions WHERE id = pg_temp.id_f1('q5')),'MFC and collective health remain distinct');
  PERFORM pg_temp.check_f1(NOT EXISTS (SELECT FROM public.questions WHERE question_number >= 8 AND area_id IS NOT NULL),
    'all Preventiva/ambiguous compounds stay unmapped');
END $$;
SELECT pg_temp.verify_f1_history();
SELECT pg_temp.check_f1((SELECT payload FROM f1_ranking_before) IS NOT DISTINCT FROM
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.posicao) FROM public.get_ranking_for_simulado(pg_temp.id_f1('sim1')) r),
 'full real ranking RPC identical before/after initial migration');
SELECT pg_temp.check_f1((SELECT value = 'false'::jsonb FROM public.app_config WHERE key = 'editions_ui'),
 'initial flag disabled');
-- This is an actionable unresolved report, not an assertion that backfill is complete.
SELECT s.slug,q.area AS unmapped_variant,count(*) AS unresolved
FROM public.questions q JOIN public.simulados s ON s.id = q.simulado_id
WHERE q.area_id IS NULL GROUP BY s.slug,q.area ORDER BY s.slug,q.area;
CREATE TEMP TABLE f1_snapshots_before AS SELECT id,specialty_id_at_finish,
 target_institution_ids_at_finish,snapshot_backfilled FROM public.attempts;

-- Change live preferences and rollout state between migration applications.
UPDATE public.onboarding_profiles SET specialty_id = pg_temp.id_f1('specialty-new'),
 target_institution_ids = ARRAY[pg_temp.id_f1('institution-new')]
WHERE user_id IN (pg_temp.id_f1('alice'),pg_temp.id_f1('carol'));
UPDATE public.app_config SET value = 'true'::jsonb WHERE key = 'editions_ui';
CREATE TEMP TABLE f1_ranking_replay_before AS
SELECT jsonb_agg(to_jsonb(r) ORDER BY r.posicao) AS payload
FROM public.get_ranking_for_simulado(pg_temp.id_f1('sim1')) r;
-- Ranking RPC currently uses LIVE preference labels. Compare full output on
-- either side of EACH migration, and immutable ranking metrics across profiles.
SELECT pg_temp.check_f1((SELECT jsonb_agg(item - ARRAY['especialidade','instituicoes_alvo'] ORDER BY ord)
 FROM f1_ranking_before CROSS JOIN LATERAL jsonb_array_elements(payload) WITH ORDINALITY x(item,ord))
 IS NOT DISTINCT FROM (SELECT jsonb_agg(item - ARRAY['especialidade','instituicoes_alvo'] ORDER BY ord)
 FROM f1_ranking_replay_before CROSS JOIN LATERAL jsonb_array_elements(payload) WITH ORDINALITY x(item,ord)),
 'profile edits do not change ranking positions/scores/participants');
\echo 'Reapplying SAME real migration after profile and flag changes'
\i :migration_path
SELECT pg_temp.verify_f1_history();
SELECT pg_temp.check_f1(NOT EXISTS (SELECT FROM public.attempts a JOIN f1_snapshots_before b USING (id)
 WHERE ROW(a.specialty_id_at_finish,a.target_institution_ids_at_finish,a.snapshot_backfilled)
 IS DISTINCT FROM ROW(b.specialty_id_at_finish,b.target_institution_ids_at_finish,b.snapshot_backfilled)),
 'reapplication never resnapshots any historical or pending attempt');
SELECT pg_temp.check_f1((SELECT value = 'true'::jsonb FROM public.app_config WHERE key = 'editions_ui'),
 'reapplication preserves enabled flag');
SELECT pg_temp.check_f1((SELECT payload FROM f1_ranking_replay_before) IS NOT DISTINCT FROM
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.posicao) FROM public.get_ranking_for_simulado(pg_temp.id_f1('sim1')) r),
 'full real ranking RPC identical immediately before/after reapplication');

-- Exercise actual user-facing F0 finalization RPC, not a hand-written UPDATE.
SELECT set_config('request.jwt.claim.sub',pg_temp.id_f1('carol')::text,false);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id_f1('carol'),'role','authenticated')::text,false);
SET ROLE authenticated;
SELECT * FROM public.finalize_attempt_with_results(pg_temp.id_f1('a-carol'),true);
RESET ROLE;
SELECT pg_temp.check_f1((SELECT status = 'submitted'
 AND specialty_id_at_finish = pg_temp.id_f1('specialty-new')
 AND target_institution_ids_at_finish = ARRAY[pg_temp.id_f1('institution-new')]
 AND NOT snapshot_backfilled AND score_percentage = 27.27
 FROM public.attempts WHERE id = pg_temp.id_f1('a-carol')),
 'new real finalization snapshots CURRENT profile with backfilled=false');
SELECT pg_temp.check_f1((SELECT count(*) = 11 FROM public.attempt_question_results
 WHERE attempt_id = pg_temp.id_f1('a-carol')),'new real finalization generates eleven persisted results');
SELECT pg_temp.check_f1(NOT EXISTS (SELECT FROM public.attempts a JOIN f1_snapshots_before b USING (id)
 WHERE a.id <> pg_temp.id_f1('a-carol') AND
 ROW(a.specialty_id_at_finish,a.target_institution_ids_at_finish,a.snapshot_backfilled)
 IS DISTINCT FROM ROW(b.specialty_id_at_finish,b.target_institution_ids_at_finish,b.snapshot_backfilled)),
 'new finalization does not affect historical snapshots');
SELECT count(*) AS passing_assertions FROM f1_checks;
\echo 'GREEN: nonzero historical backfill + real migration + reapplication + real finalization'
-- Intentionally retain synthetic data in THIS disposable clone for QA inspection.
-- Do not run this driver twice in the same database or drop any source baseline.
