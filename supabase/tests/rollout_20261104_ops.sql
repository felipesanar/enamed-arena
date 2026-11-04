\set ON_ERROR_STOP on
\pset pager off
-- Only a NEW disposable clone of the integrated pre-F1 template, never production.
-- psql -X -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_rollout_ops_<suffix> -f <this file>
-- Optional -v negative=missing_snapshot|wrong_edition|active|score|occupied|academic|ambiguous_alias|empty_snapshot_addition
DO $$ BEGIN
  IF current_database() !~ '^enamed_test_rollout_ops_[a-zA-Z0-9_]+$'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() IS DISTINCT FROM 54737 OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Requires local disposable enamed_test_rollout_ops_* on 127.0.0.1:54737 as postgres';
  END IF;
  IF to_regclass('public.exam_blueprints') IS NOT NULL
     OR EXISTS (SELECT FROM public.simulados) OR EXISTS (SELECT FROM auth.users) THEN
    RAISE EXCEPTION 'Requires empty pre-F1 clone';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='net' AND p.proname='http_post' AND p.prosrc=' SELECT 1::bigint ') THEN
    RAISE EXCEPTION 'Requires existing local no-network HTTP stub';
  END IF;
END $$;
\if :{?negative}
\else
  \set negative none
\endif
\if :{?recovery}
\else
  \set recovery false
\endif
SELECT set_config('rollout_test.negative', :'negative', false);
CREATE TEMP TABLE ops_checks(label text);
CREATE FUNCTION pg_temp.ops_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
  INSERT INTO ops_checks VALUES(label);
  RAISE NOTICE 'PASS: %',label;
END $$;
CREATE TEMP TABLE ops_ids(label text PRIMARY KEY,id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO ops_ids(label) SELECT 's'||n FROM generate_series(1,8) n;
INSERT INTO ops_ids(label) VALUES ('u1'),('u2'),('a1'),('a2'),('legacy'),('live');
CREATE FUNCTION pg_temp.ops_id(k text) RETURNS uuid LANGUAGE sql AS $$
 SELECT id FROM pg_temp.ops_ids WHERE label=k
$$;
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT pg_temp.ops_id('u'||n),'rollout-'||n||'@example.invalid','{"full_name":"Local rollout"}'::jsonb
FROM generate_series(1,2) n;
INSERT INTO public.simulados(id,title,slug,sequence_number,questions_count,
 execution_window_start,execution_window_end,results_release_at,status)
SELECT pg_temp.ops_id('s'||n),CASE WHEN n=8 THEN 'Simulado 1 · ENAMED 2027' ELSE 'Legacy '||n END,
 CASE WHEN n=8 THEN 'enamed-2027-simulado-1' ELSE 'simulado-'||n END,n,100,
 '2026-11-04 00:00Z','2026-11-12 23:59Z',
 CASE WHEN n=7 THEN '2026-11-12 23:58Z' ELSE '2026-11-13 00:00Z' END::timestamptz,'published'
FROM generate_series(1,8) n;
INSERT INTO public.questions(simulado_id,question_number,text,area,theme)
SELECT pg_temp.ops_id('s'||s),q,'Synthetic '||s||'/'||q,
 CASE q WHEN 1 THEN U&'Medicina de Fam\00EDlia e Comunidade (MFC)'
 WHEN 2 THEN '  MEDICINA DE FAMILIA E COMUNIDADE (MFC)  '
 WHEN 3 THEN 'Preventiva' WHEN 4 THEN U&'Cl\00EDnica M\00E9dica/Preventiva'
 WHEN 5 THEN U&'Sa\00FAde Coletiva/Preventiva' ELSE 'Pediatria' END,'Synthetic'
FROM generate_series(1,8) s CROSS JOIN generate_series(1,100) q;
INSERT INTO public.question_options(question_id,label,text,is_correct)
SELECT id,label,'Option '||label,label='A' FROM public.questions CROSS JOIN unnest(ARRAY['A','B']) label;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,started_at,effective_deadline,created_at)
SELECT pg_temp.ops_id('a'||n),pg_temp.ops_id('u'||n),pg_temp.ops_id('s8'),
 'offline_pending','offline','2026-11-01 00:00Z','2026-11-01 05:00Z','2026-11-01 00:00Z'
FROM generate_series(1,2) n;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,started_at,effective_deadline,
 created_at,finished_at,score_percentage,total_correct,total_answered)
VALUES(pg_temp.ops_id('legacy'),pg_temp.ops_id('u1'),pg_temp.ops_id('s1'),'submitted','offline',
 '2026-01-01 00:00Z','2026-01-01 05:00Z','2026-01-01 00:00Z','2026-01-01 01:00Z',50,1,2);
INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
SELECT pg_temp.ops_id('legacy'),q.id,o.id FROM public.questions q
JOIN public.question_options o ON o.question_id=q.id AND o.label='A'
WHERE q.simulado_id=pg_temp.ops_id('s1') AND q.question_number<=2;
INSERT INTO public.attempt_question_results(attempt_id,question_id,selected_option_id,correct_option_id,is_correct,was_answered)
SELECT attempt_id,question_id,selected_option_id,selected_option_id,true,true FROM public.answers;
INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,score_percentage,total_correct,
 total_answered,total_questions,finished_at)
SELECT user_id,id,simulado_id,score_percentage,total_correct,total_answered,100,finished_at
FROM public.attempts WHERE id=pg_temp.ops_id('legacy');
INSERT INTO public.user_performance_summary(user_id,total_attempts,avg_score,best_score,last_score,last_simulado_id)
VALUES(pg_temp.ops_id('u1'),1,50,50,50,pg_temp.ops_id('s1'));
\if :recovery
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,started_at,effective_deadline,created_at)
VALUES(pg_temp.ops_id('live'),pg_temp.ops_id('u2'),pg_temp.ops_id('s2'),'offline_pending','offline',
 '2026-01-01 00:00Z','2026-01-01 05:00Z','2026-01-01 00:00Z');
\endif
-- All snapshots are real heap copies made together, including the synthetic score.
BEGIN;
CREATE SCHEMA backup AUTHORIZATION postgres;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['simulados','attempts','answers','attempt_question_results','user_performance_history',
  'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
  EXECUTE format('CREATE TABLE backup.rollout_20261104_%I AS TABLE public.%I',t,t);
  EXECUTE format('ALTER TABLE backup.rollout_20261104_%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON backup.rollout_20261104_%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
CREATE TABLE backup.rollout_20261104_actions(action text PRIMARY KEY,details jsonb NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE backup.rollout_20261104_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup.rollout_20261104_actions FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
\if :recovery
 -- Reproduce the incident: F1 ran after the pre-F1 checkpoint rolled back.
 \ir ../migrations/20261104065001_fase1_edition_model.sql
 CREATE SCHEMA IF NOT EXISTS supabase_migrations;
 CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY);
 INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20261104065001');
 -- Synthetic legitimate offline submission after the original backup. These
 -- fixture writes represent the operator-verified event, not score calculation.
 UPDATE public.attempts SET status='submitted',finished_at='2026-01-01 06:00Z',
   score_percentage=65,total_correct=65,total_answered=100 WHERE id=pg_temp.ops_id('live');
 INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,score_percentage,total_correct,
   total_answered,total_questions,finished_at)
 SELECT user_id,id,simulado_id,score_percentage,total_correct,total_answered,100,finished_at
 FROM public.attempts WHERE id=pg_temp.ops_id('live');
 INSERT INTO public.user_performance_summary(user_id,total_attempts,avg_score,best_score,last_score,last_simulado_id)
 VALUES(pg_temp.ops_id('u2'),1,65,65,65,pg_temp.ops_id('s2'));
 CREATE FUNCTION pg_temp.ops_fingerprints(p_prefix text)
 RETURNS TABLE(table_name text,row_count bigint,fingerprint text) LANGUAGE plpgsql AS $$
 DECLARE t text;
 BEGIN
  IF p_prefix NOT IN ('rollout_20261104_','rollout_20261104_stage_') THEN RAISE EXCEPTION 'Unexpected fingerprint prefix'; END IF;
  FOREACH t IN ARRAY ARRAY['simulados','attempts','answers','attempt_question_results','user_performance_history',
    'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
   IF p_prefix='rollout_20261104_stage_' AND t='simulados' THEN CONTINUE; END IF;
   RETURN QUERY EXECUTE format('SELECT %L::text,count(*)::bigint,md5(coalesce(string_agg(to_jsonb(b)::text,'''' ORDER BY to_jsonb(b)::text),'''')) FROM backup.%I b',t,p_prefix||t);
  END LOOP;
 END $$;
 CREATE TEMP TABLE ops_original_fingerprints AS SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_');
 SELECT pg_temp.ops_assert((SELECT score_percentage IS NULL AND status='offline_pending'
   FROM backup.rollout_20261104_attempts WHERE id=pg_temp.ops_id('live')),'original snapshot retains pending attempt');
 \ir ../ops/20261104_repair_initial_assignment.sql
 SELECT pg_temp.ops_assert((SELECT count(*)=2 FROM public.attempts a JOIN public.exam_editions e ON e.id=a.edition_id
   WHERE a.simulado_id=pg_temp.ops_id('s8') AND e.code='2027.1' AND a.score_percentage IS NULL),'recovery preserves two original target attempts in 2027.1');
 SELECT pg_temp.ops_assert((SELECT score_percentage=65 AND status='submitted' FROM public.attempts
   WHERE id=pg_temp.ops_id('live')),'recovery preserves legitimate offline score 65');
 SELECT pg_temp.ops_assert((SELECT score_percentage=65 AND status='submitted'
   FROM backup.rollout_20261104_stage_attempts WHERE id=pg_temp.ops_id('live')),'fresh stage captures legitimate score 65');
 CREATE TEMP TABLE ops_stage_fingerprints AS SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_stage_');
 CREATE TEMP TABLE ops_recovery_ledger AS TABLE backup.rollout_20261104_actions;
 DO $$ BEGIN
  CASE current_setting('rollout_test.negative')
   WHEN 'stage_missing' THEN DROP TABLE backup.rollout_20261104_stage_answers;
   WHEN 'stage_mapping' THEN UPDATE backup.rollout_20261104_actions
     SET details=jsonb_set(details,'{table_mapping,answers}','"backup.wrong_answers"') WHERE action='live_activity_checkpoint';
   WHEN 'stage_grant' THEN GRANT SELECT ON backup.rollout_20261104_stage_answers TO authenticated;
   WHEN 'stage_types' THEN ALTER TABLE backup.rollout_20261104_stage_answers ADD COLUMN unexpected integer;
   WHEN 'stage_drift' THEN UPDATE public.attempts SET score_percentage=66 WHERE id=pg_temp.ops_id('live');
   WHEN 'stage_business' THEN UPDATE public.attempts SET total_answered=99 WHERE id=pg_temp.ops_id('a1');
   ELSE NULL;
  END CASE;
 END $$;
 SELECT :'negative' IN ('stage_missing','stage_mapping','stage_grant','stage_types','stage_drift','stage_business') AS stage_negative \gset
 \if :stage_negative
  \set ON_ERROR_STOP off
  \ir ../ops/20261104_after_f1.sql
  \set ON_ERROR_STOP on
  SELECT pg_temp.ops_assert(:'LAST_ERROR_SQLSTATE'='P0001','after-F1 refuses '||:'negative');
  SELECT pg_temp.ops_assert((SELECT sequence_number=8 FROM public.simulados WHERE id=pg_temp.ops_id('s8')),'stage rejection leaves target sequence unchanged');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM backup.rollout_20261104_actions WHERE action='after_f1'),'stage rejection records no success');
 \else
  \ir ../ops/20261104_after_f1.sql
  SELECT pg_temp.ops_assert((SELECT sequence_number=1 FROM public.simulados WHERE id=pg_temp.ops_id('s8')),'recovery after-F1 sequence is one');
  SELECT pg_temp.ops_assert((SELECT score_percentage=65 AND status='submitted' FROM public.attempts
    WHERE id=pg_temp.ops_id('live')),'after-F1 preserves legitimate offline score 65');
  SELECT pg_temp.ops_assert((SELECT score_percentage=65 FROM public.user_performance_history
    WHERE attempt_id=pg_temp.ops_id('live')),'after-F1 preserves live performance history');
  SELECT pg_temp.ops_assert((SELECT last_score=65 FROM public.user_performance_summary
    WHERE user_id=pg_temp.ops_id('u2')),'after-F1 preserves live performance summary');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM public.questions WHERE question_number IN (3,4,5)
    AND area_id IS NOT NULL),'recovery leaves ambiguous areas unresolved');
  \ir ../ops/20261104_after_f1.sql
  SELECT pg_temp.ops_assert(NOT EXISTS((SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_stage_')
    EXCEPT TABLE ops_stage_fingerprints) UNION ALL (TABLE ops_stage_fingerprints
    EXCEPT SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_stage_'))),'fresh stage remains immutable through repeated after-F1');
  SELECT pg_temp.ops_assert(NOT EXISTS((TABLE ops_recovery_ledger EXCEPT SELECT * FROM backup.rollout_20261104_actions)
    UNION ALL (SELECT * FROM backup.rollout_20261104_actions WHERE action<>'after_f1' EXCEPT TABLE ops_recovery_ledger)),'recovery ledger remains immutable');
 \endif
 SELECT pg_temp.ops_assert(NOT EXISTS((SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_')
   EXCEPT TABLE ops_original_fingerprints) UNION ALL (TABLE ops_original_fingerprints
   EXCEPT SELECT * FROM pg_temp.ops_fingerprints('rollout_20261104_'))),'all original snapshots remain immutable');
 SELECT count(*) AS passed_assertions FROM ops_checks;
 \quit
\endif
DO $$ BEGIN
 CASE current_setting('rollout_test.negative')
 WHEN 'missing_snapshot' THEN DROP TABLE backup.rollout_20261104_answers;
 WHEN 'wrong_edition' THEN
  ALTER TABLE public.simulados ADD COLUMN edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT;
  UPDATE public.simulados SET edition_id=(SELECT id FROM public.exam_editions WHERE code='2027.2') WHERE id=pg_temp.ops_id('s8');
 WHEN 'active' THEN UPDATE public.attempts SET effective_deadline=now()+interval '1 hour' WHERE id=pg_temp.ops_id('a1');
 WHEN 'score' THEN UPDATE public.attempts SET score_percentage=1 WHERE id=pg_temp.ops_id('a1');
 ELSE NULL;
 END CASE;
END $$;
SELECT :'negative' IN ('missing_snapshot','wrong_edition','active','score') AS before_negative \gset
\if :before_negative
 \set ON_ERROR_STOP off
 \ir ../ops/20261104_before_f1.sql
 \set ON_ERROR_STOP on
 SELECT pg_temp.ops_assert(:'LAST_ERROR_SQLSTATE'='P0001','before-F1 refuses '||:'negative');
 SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM backup.rollout_20261104_actions),'failed before-F1 is atomic');
 SELECT pg_temp.ops_assert((SELECT results_release_at<execution_window_end FROM public.simulados WHERE id=pg_temp.ops_id('s7')),'failed before-F1 did not correct S7');
\else
 \ir ../ops/20261104_before_f1.sql
 SELECT pg_temp.ops_assert((SELECT s.edition_id=e.id AND s.sequence_number=8 FROM public.simulados s
 JOIN public.exam_editions e ON e.code='2027.1' WHERE s.id=pg_temp.ops_id('s8')),'before-F1 assigns generated 2027.1 UUID, not sequence');
 SELECT pg_temp.ops_assert((SELECT count(*)=7 FROM public.simulados WHERE edition_id IS NULL),'legacy left for original F1 backfill');
 SELECT pg_temp.ops_assert((SELECT results_release_at=execution_window_end FROM public.simulados WHERE id=pg_temp.ops_id('s7')),'S7 release corrected to end');
 CREATE TEMP TABLE ledger_before AS TABLE backup.rollout_20261104_actions;
 \ir ../ops/20261104_before_f1.sql
 SELECT pg_temp.ops_assert(NOT EXISTS((TABLE ledger_before EXCEPT TABLE backup.rollout_20261104_actions)
 UNION ALL (TABLE backup.rollout_20261104_actions EXCEPT TABLE ledger_before)),'before-F1 idempotence preserves ledger');
 \ir ../migrations/20261104065001_fase1_edition_model.sql
 DO $$ BEGIN
 CASE current_setting('rollout_test.negative')
 WHEN 'occupied' THEN
  INSERT INTO public.simulados(title,slug,sequence_number,questions_count,execution_window_start,execution_window_end,results_release_at,edition_id)
  SELECT 'Collision','collision',1,0,'2026-11-01Z','2026-11-02Z','2026-11-03Z',id FROM public.exam_editions WHERE code='2027.1';
 WHEN 'academic' THEN UPDATE public.answers SET selected_option_id=NULL;
 WHEN 'empty_snapshot_addition' THEN INSERT INTO public.onboarding_profiles(user_id) VALUES(pg_temp.ops_id('u2'));
 WHEN 'ambiguous_alias' THEN UPDATE public.exam_areas SET aliases=array_append(aliases,U&'Medicina de Fam\00EDlia e Comunidade (MFC)') WHERE code='saude_coletiva';
 ELSE NULL;
 END CASE;
 END $$;
 SELECT :'negative' IN ('occupied','academic','ambiguous_alias','empty_snapshot_addition') AS after_negative \gset
 \if :after_negative
  \set ON_ERROR_STOP off
  \ir ../ops/20261104_after_f1.sql
  \set ON_ERROR_STOP on
  SELECT pg_temp.ops_assert(:'LAST_ERROR_SQLSTATE'='P0001','after-F1 refuses '||:'negative');
  SELECT pg_temp.ops_assert((SELECT sequence_number=8 FROM public.simulados WHERE id=pg_temp.ops_id('s8')),'failed after-F1 is atomic');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM backup.rollout_20261104_actions WHERE action='after_f1'),'failed after-F1 has no success ledger');
 \else
  \ir ../ops/20261104_after_f1.sql
  SELECT pg_temp.ops_assert((SELECT sequence_number=1 FROM public.simulados WHERE id=pg_temp.ops_id('s8')),'after-F1 sequence is one');
  SELECT pg_temp.ops_assert((SELECT count(*)=2 FROM public.attempts a JOIN public.exam_editions e ON e.id=a.edition_id
   WHERE a.simulado_id=pg_temp.ops_id('s8') AND e.code='2027.1' AND a.score_percentage IS NULL),'two original unscored attempts assigned by original F1');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM public.questions WHERE question_number IN (1,2) AND area_id IS NULL),'exact normalized MFC alias backfilled');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM public.questions WHERE question_number IN (3,4,5) AND area_id IS NOT NULL),'ambiguous aliases remain NULL');
  SELECT pg_temp.ops_assert((SELECT convalidated FROM pg_constraint WHERE conrelid='public.simulados'::regclass AND conname='simulados_edition_windows_check'),'window constraint validated');
  SELECT pg_temp.ops_assert(NOT EXISTS(SELECT FROM public.exam_editions WHERE year=2027 AND
   (exam_date IS NOT NULL OR official_results_at IS NOT NULL OR exam_date_confirmed)),'official dates remain unknown');
  SELECT pg_temp.ops_assert((SELECT value='false'::jsonb FROM public.app_config WHERE key='editions_ui'),'UI still off');
  CREATE TEMP TABLE ledger_after AS TABLE backup.rollout_20261104_actions;
  CREATE TEMP TABLE questions_after AS TABLE public.questions;
  \ir ../ops/20261104_after_f1.sql
  SELECT pg_temp.ops_assert(NOT EXISTS((TABLE ledger_after EXCEPT TABLE backup.rollout_20261104_actions)
   UNION ALL (TABLE backup.rollout_20261104_actions EXCEPT TABLE ledger_after)),'after-F1 idempotence preserves ledger');
  SELECT pg_temp.ops_assert(NOT EXISTS((TABLE questions_after EXCEPT TABLE public.questions)
   UNION ALL (TABLE public.questions EXCEPT TABLE questions_after)),'after-F1 idempotence preserves questions');
  DO $$ DECLARE t text; bad boolean; added_columns text[]; BEGIN
   FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','questions','question_options',
    'user_performance_history','user_performance_summary','error_notebook','onboarding_profiles','profiles'] LOOP
    SELECT coalesce(array_agg(a.attname::text),'{}'::text[]) INTO added_columns
    FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||t) AND a.attnum>0 AND NOT a.attisdropped
      AND NOT EXISTS(SELECT 1 FROM pg_attribute b WHERE b.attrelid=to_regclass('backup.rollout_20261104_'||t)
        AND b.attnum>0 AND NOT b.attisdropped AND b.attname=a.attname);
    EXECUTE format('SELECT EXISTS ((SELECT to_jsonb(c)-$1 FROM public.%1$I c EXCEPT ALL SELECT to_jsonb(b) FROM backup.rollout_20261104_%1$I b) UNION ALL (SELECT to_jsonb(b) FROM backup.rollout_20261104_%1$I b EXCEPT ALL SELECT to_jsonb(c)-$1 FROM public.%1$I c))',t)
      INTO bad USING added_columns;
    PERFORM pg_temp.ops_assert(NOT bad,'snapshot academic preservation: '||t);
   END LOOP;
  END $$;
 \endif
\endif
SELECT count(*) AS passed_assertions FROM ops_checks;
