\set ON_ERROR_STOP on
-- LOCAL disposable harness with production definitions + F0, then F1 migration.
-- No pgTAP/extension installation required. Every test rolls back its fixtures.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT LIKE 'enamed_test_%' THEN
    RAISE EXCEPTION 'Only enamed_test_* databases are allowed';
  END IF;
END $$;
CREATE FUNCTION pg_temp.f1_assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END $$;
CREATE FUNCTION pg_temp.f1_throws(statement text, expected text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %: %', expected, statement;
END $$;
CREATE FUNCTION pg_temp.f1_id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE
AS $$ SELECT md5('fase1-model:' || label)::uuid $$;

SELECT pg_temp.f1_assert((SELECT count(*) = 7 AND min(weight) = max(weight)
  FROM public.exam_areas a JOIN public.exam_blueprints b ON b.id = a.blueprint_id
  WHERE b.code = 'inep-478-2025' AND b.weights_provisional), 'seven uniform provisional areas');
SELECT pg_temp.f1_assert(NOT EXISTS (SELECT 1 FROM public.simulados WHERE edition_id IS NULL), 'simulado edition backfill');
SELECT pg_temp.f1_assert(NOT EXISTS (SELECT 1 FROM public.attempts a
  LEFT JOIN public.simulados s ON s.id = a.simulado_id
  WHERE a.edition_id IS DISTINCT FROM s.edition_id OR a.edition_id IS NULL), 'attempt backfill and parent relation');
SELECT pg_temp.f1_assert(NOT EXISTS (SELECT 1 FROM public.attempts
  WHERE status IN ('submitted','expired') AND target_institution_ids_at_finish IS NULL), 'all historical final statuses have captured snapshots');
SELECT pg_temp.f1_assert((SELECT NOT convalidated FROM pg_constraint
  WHERE conrelid = 'public.simulados'::regclass AND conname = 'simulados_edition_windows_check'), 'historical dates not validated or rewritten');
SELECT pg_temp.f1_assert((SELECT value = 'false'::jsonb FROM public.app_config WHERE key = 'editions_ui'), 'flag initially disabled (run before rollout)');

INSERT INTO auth.users(id, email, raw_user_meta_data)
SELECT pg_temp.f1_id(u), 'f1-model-' || u || '@example.invalid', '{}'::jsonb
FROM unnest(ARRAY['student','other','admin']) u;
INSERT INTO public.profiles(id, full_name)
SELECT pg_temp.f1_id(u), 'F1 ' || u FROM unnest(ARRAY['student','other','admin']) u
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles(user_id, role) VALUES (pg_temp.f1_id('admin'), 'admin') ON CONFLICT DO NOTHING;
INSERT INTO public.onboarding_profiles(user_id, target_institution_ids)
VALUES (pg_temp.f1_id('student'), ARRAY[pg_temp.f1_id('institution-before')])
ON CONFLICT (user_id) DO UPDATE SET target_institution_ids = EXCLUDED.target_institution_ids;

INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,status,
  execution_window_start,execution_window_end,results_release_at)
SELECT pg_temp.f1_id('sim' || n), 'F1 model', 'f1-model-' || n, 981001,
  (SELECT id FROM public.exam_editions WHERE code = CASE WHEN n = 1 THEN '2026' ELSE '2027.1' END),
  'published', now() - interval '1 hour', now() + interval '1 hour', now() + interval '2 hours'
FROM generate_series(1,2) n;
INSERT INTO public.simulados(id,title,slug,sequence_number,
  execution_window_start,execution_window_end,results_release_at)
VALUES (pg_temp.f1_id('legacy-client'),'F1 legacy insert','f1-model-legacy',981002,
  now(),now() + interval '1 hour',now() + interval '2 hours');
SELECT pg_temp.f1_assert((SELECT e.code = '2026' FROM public.simulados s
 JOIN public.exam_editions e ON e.id = s.edition_id WHERE s.id = pg_temp.f1_id('legacy-client')), 'old inserts without edition retain fixed 2026 default');
SELECT pg_temp.f1_assert((SELECT count(*) = 2 FROM public.simulados WHERE sequence_number = 981001), 'same sequence in distinct editions');
SELECT pg_temp.f1_throws($s$INSERT INTO public.simulados(title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at)
 SELECT 'duplicate','f1-duplicate',981001,edition_id,execution_window_start,execution_window_end,results_release_at
 FROM public.simulados WHERE id = pg_temp.f1_id('sim1')$s$, '23505');
SELECT pg_temp.f1_throws($s$UPDATE public.simulados SET results_release_at = execution_window_end - interval '1 second'
 WHERE id = pg_temp.f1_id('sim1')$s$, '23514');
SELECT pg_temp.f1_throws($s$UPDATE public.simulados SET slug = 'f1-model-1'
 WHERE id = pg_temp.f1_id('sim2')$s$, '23505');

INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
SELECT pg_temp.f1_id('q' || n), pg_temp.f1_id('sim1'), n, 'F1 question', area, 'fixture'
FROM unnest(ARRAY['  CLÍNICA   MÉDICA  ','Cirurgia','Ginecologia','Obstetrícia',
 'Medicina de Família e Comunidade','Saúde Coletiva','Preventiva ','Saúde Coletiva / Preventiva',
 'Clínica Médica / Preventiva','MFC / Saúde Coletiva']) WITH ORDINALITY v(area,n);
SELECT pg_temp.f1_assert((SELECT count(*) FILTER (WHERE area_id IS NOT NULL) = 6
 AND count(*) FILTER (WHERE area_id IS NULL) = 4 FROM public.questions
 WHERE simulado_id = pg_temp.f1_id('sim1')), 'obvious aliases mapped, ambiguous compounds remain null');
SELECT pg_temp.f1_assert((SELECT count(DISTINCT area_id) = 2 FROM public.questions
 WHERE id IN (pg_temp.f1_id('q5'),pg_temp.f1_id('q6'))), 'MFC and collective health distinct');
INSERT INTO public.exam_blueprints(id,code,label) VALUES (pg_temp.f1_id('foreign-blueprint'),'f1-foreign','F1');
INSERT INTO public.exam_areas(id,blueprint_id,code,label,weight,sort_order)
VALUES (pg_temp.f1_id('foreign-area'),pg_temp.f1_id('foreign-blueprint'),'foreign','Foreign',1,1);
SELECT pg_temp.f1_throws($s$UPDATE public.questions SET area_id = pg_temp.f1_id('foreign-area')
 WHERE id = pg_temp.f1_id('q1')$s$, '23514');
SELECT pg_temp.f1_throws($s$UPDATE public.exam_editions SET blueprint_id = pg_temp.f1_id('foreign-blueprint')
 WHERE code = '2026'$s$, '23514');
-- Legacy text-only edits must not retain a stale association.
UPDATE public.questions SET area = 'Preventiva' WHERE id = pg_temp.f1_id('q1');
SELECT pg_temp.f1_assert((SELECT area_id IS NULL FROM public.questions WHERE id = pg_temp.f1_id('q1')), 'ambiguous text edit clears old mapping');

INSERT INTO public.attempts(id,user_id,simulado_id,effective_deadline)
VALUES (pg_temp.f1_id('attempt'),pg_temp.f1_id('student'),pg_temp.f1_id('sim1'),now() + interval '1 hour');
SELECT pg_temp.f1_assert((SELECT a.edition_id = s.edition_id FROM public.attempts a
 JOIN public.simulados s ON s.id = a.simulado_id WHERE a.id = pg_temp.f1_id('attempt')), 'guarded insert derives edition');
SELECT pg_temp.f1_throws($s$INSERT INTO public.attempts(user_id,simulado_id,effective_deadline,edition_id)
 VALUES(pg_temp.f1_id('other'),pg_temp.f1_id('sim1'),now(),
 (SELECT id FROM public.exam_editions WHERE code = '2027.1'))$s$, '23514');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('student')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('student'),'role','authenticated')::text,true);
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET edition_id =
 (SELECT id FROM public.exam_editions WHERE code = '2027.1') WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET specialty_id_at_finish = pg_temp.f1_id('spoof')
 WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET target_institution_ids_at_finish = ARRAY[pg_temp.f1_id('spoof')]
 WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET snapshot_backfilled = true
 WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('student'),'role','service_role')::text,true);
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET snapshot_backfilled = true
 WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('student'),'role','authenticated')::text,true);
SELECT pg_temp.f1_throws($s$UPDATE public.app_config SET value = 'true' WHERE key = 'editions_ui'$s$, '42501');
SELECT pg_temp.f1_throws($s$SELECT public.admin_set_app_config('editions_ui','true')$s$, 'P0003');
RESET ROLE;
UPDATE public.attempts SET status = 'submitted',finished_at = now() WHERE id = pg_temp.f1_id('attempt');
SELECT pg_temp.f1_assert((SELECT target_institution_ids_at_finish = ARRAY[pg_temp.f1_id('institution-before')]
 AND NOT snapshot_backfilled FROM public.attempts WHERE id = pg_temp.f1_id('attempt')), 'snapshot captured on finalization');
UPDATE public.onboarding_profiles SET target_institution_ids = ARRAY[pg_temp.f1_id('institution-after')]
WHERE user_id = pg_temp.f1_id('student');
UPDATE public.attempts SET total_correct = total_correct WHERE id = pg_temp.f1_id('attempt');
SELECT pg_temp.f1_assert((SELECT target_institution_ids_at_finish = ARRAY[pg_temp.f1_id('institution-before')]
 FROM public.attempts WHERE id = pg_temp.f1_id('attempt')), 'profile changes and reprocessing do not change snapshot');
SELECT pg_temp.f1_throws($s$UPDATE public.attempts SET target_institution_ids_at_finish = '{}'
 WHERE id = pg_temp.f1_id('attempt')$s$, 'P0001');
UPDATE public.attempts SET status = 'in_progress',finished_at = NULL WHERE id = pg_temp.f1_id('attempt');
UPDATE public.attempts SET status = 'submitted',finished_at = now() WHERE id = pg_temp.f1_id('attempt');
SELECT pg_temp.f1_assert((SELECT target_institution_ids_at_finish = ARRAY[pg_temp.f1_id('institution-before')]
 FROM public.attempts WHERE id = pg_temp.f1_id('attempt')), 'trusted reopen and refinalize preserve original snapshot');
SELECT pg_temp.f1_throws($s$UPDATE public.simulados SET edition_id =
 (SELECT id FROM public.exam_editions WHERE code = '2027.1') WHERE id = pg_temp.f1_id('sim1')$s$, '23514');
UPDATE public.simulados SET status = 'archived' WHERE id = pg_temp.f1_id('sim1');

SET LOCAL ROLE authenticated;
SELECT pg_temp.f1_assert((SELECT count(*) = 1 FROM public.simulados WHERE id = pg_temp.f1_id('sim1')), 'owner reads archived simulado');
SELECT pg_temp.f1_assert((SELECT count(*) = 0 FROM public.questions WHERE simulado_id = pg_temp.f1_id('sim1')), 'archive does not bypass F0 question release');
SELECT pg_temp.f1_assert((SELECT count(*) = 0 FROM public.get_question_explanations(pg_temp.f1_id('sim1'))), 'no early answer key for archived owner');
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('other')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('other'),'role','authenticated')::text,true);
SELECT pg_temp.f1_assert((SELECT count(*) = 0 FROM public.simulados WHERE id = pg_temp.f1_id('sim1')), 'non-owner cannot read archive');
SELECT set_config('request.jwt.claim.sub',pg_temp.f1_id('admin')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f1_id('admin'),'role','authenticated')::text,true);
SELECT pg_temp.f1_assert((SELECT count(*) = 1 FROM public.simulados WHERE id = pg_temp.f1_id('sim1')), 'content admin reads archive');
SELECT public.admin_set_app_config('editions_ui','true');
SELECT pg_temp.f1_assert((SELECT value = 'true'::jsonb FROM public.app_config WHERE key = 'editions_ui'), 'content admin can change config through audited RPC');
SELECT pg_temp.f1_throws($s$SELECT public.admin_set_app_config('editions_ui','"not a boolean"')$s$, '22023');
RESET ROLE;
ROLLBACK;
