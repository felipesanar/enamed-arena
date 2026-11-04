\set ON_ERROR_STOP on
-- Execute before any fixture, including the local backup-table double below.
SELECT 1 / (COALESCE(inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
  AND session_user='postgres' AND current_database() ~ '^enamed_test_answer_freshness_[a-z0-9_]+$',false)::int);
-- LOCAL disposable clone only. All fixtures and helpers are rolled back.
BEGIN;
SET LOCAL statement_timeout = '8s';
SET LOCAL lock_timeout = '3s';
CREATE FUNCTION pg_temp.f3id(label text) RETURNS uuid LANGUAGE sql IMMUTABLE
AS $$ SELECT md5('f3-freshness:' || label)::uuid $$;
CREATE FUNCTION pg_temp.assert_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %', label; END IF;
RAISE NOTICE 'PASS: %', label; END $$;
CREATE FUNCTION pg_temp.reject(sql text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE message text;
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF position(expected IN message) > 0 THEN RAISE NOTICE 'PASS: %', label; RETURN; END IF;
    RAISE EXCEPTION 'wrong rejection for %: %', label, message;
  END;
  RAISE EXCEPTION 'missing rejection: %', label;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT pg_temp.f3id(u), 'f3-'||u||'@example.invalid', '{}' FROM unnest(ARRAY['student','other','admin']) u;
INSERT INTO public.user_roles(user_id,role) SELECT pg_temp.f3id('admin'),role FROM public.role_capabilities WHERE capability='content.manage' LIMIT 1;
SELECT set_config('request.jwt.claim.sub',pg_temp.f3id('admin')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f3id('admin'),'role','authenticated')::text,true);
INSERT INTO public.exam_editions(id,code,year,term,label,blueprint_id,format)
SELECT pg_temp.f3id('edition'),'2099.1',2099,1,'F3 fixture',id,'{"questions":1,"options":2,"duration_minutes":60,"scoring":"raw"}'
FROM public.exam_blueprints ORDER BY code LIMIT 1;
INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,edition_id,
 execution_window_start,execution_window_end,results_release_at)
SELECT pg_temp.f3id('s'||n),'F3 fixture','f3-freshness-'||n,997000+n,'draft',1,60,pg_temp.f3id('edition'),
 now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours' FROM generate_series(1,5) n;
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme,area_id)
SELECT pg_temp.f3id('q'||n),pg_temp.f3id('s'||n),1,'Fixture',a.label,'Fixture',a.id FROM generate_series(1,5) n
CROSS JOIN LATERAL (SELECT * FROM public.exam_areas WHERE blueprint_id=(SELECT blueprint_id FROM public.exam_editions WHERE id=pg_temp.f3id('edition')) ORDER BY sort_order LIMIT 1) a;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
SELECT pg_temp.f3id('o'||n),pg_temp.f3id('q'||n),'A','Fixture',true FROM generate_series(1,5) n;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
SELECT pg_temp.f3id('ob'||n),pg_temp.f3id('q'||n),'B','Fixture',false FROM generate_series(1,5) n;
UPDATE public.simulados SET status='published' WHERE edition_id=pg_temp.f3id('edition');
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,started_at,effective_deadline,is_within_window)
SELECT pg_temp.f3id('a'||n),pg_temp.f3id(CASE WHEN n=5 THEN 'other' ELSE 'student' END),pg_temp.f3id('s'||n),
 'in_progress','online',now(),CASE WHEN n=3 THEN now()-interval '1 minute' ELSE now()+interval '1 hour' END,true
FROM generate_series(1,5) n;
INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
VALUES(pg_temp.f3id('a4'),pg_temp.f3id('q4'),pg_temp.f3id('o4'));
UPDATE public.attempts SET status='submitted' WHERE id=pg_temp.f3id('a4');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f3id('student')::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f3id('student'),'role','authenticated')::text,true);
INSERT INTO public.answers(attempt_id,question_id,marked_for_review) VALUES(pg_temp.f3id('a1'),pg_temp.f3id('q1'),false);
UPDATE public.answers SET marked_for_review=true WHERE attempt_id=pg_temp.f3id('a1');
SELECT pg_temp.assert_true((SELECT marked_for_review AND client_updated_at IS NULL FROM public.answers WHERE attempt_id=pg_temp.f3id('a1')), 'legacy null to null remains compatible');
UPDATE public.answers SET client_updated_at='2020-01-01Z',selected_option_id=pg_temp.f3id('o1') WHERE attempt_id=pg_temp.f3id('a1');
-- POSTgREST-shaped bulk upsert; newer then stale, equal and null replay.
INSERT INTO public.answers(attempt_id,question_id,marked_for_review,client_updated_at) VALUES
 (pg_temp.f3id('a1'),pg_temp.f3id('q1'),false,'2020-01-02Z'),
 (pg_temp.f3id('a2'),pg_temp.f3id('q2'),false,NULL)
ON CONFLICT(attempt_id,question_id) DO UPDATE SET marked_for_review=EXCLUDED.marked_for_review,client_updated_at=EXCLUDED.client_updated_at;
UPDATE public.answers SET marked_for_review=true,client_updated_at='2020-01-01Z' WHERE attempt_id=pg_temp.f3id('a1');
UPDATE public.answers SET marked_for_review=true,client_updated_at='2020-01-02Z' WHERE attempt_id=pg_temp.f3id('a1');
UPDATE public.answers SET marked_for_review=true,client_updated_at=NULL WHERE attempt_id=pg_temp.f3id('a1');
SELECT pg_temp.assert_true((SELECT NOT marked_for_review AND client_updated_at='2020-01-02Z' FROM public.answers WHERE attempt_id=pg_temp.f3id('a1')), 'newer wins older equal null; past offline version valid');
SELECT set_config('request.jwt.claim.role','postgres',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f3id('student'),'role','service_role')::text,true);
SELECT set_config('app.trusted_writer','true',true);
UPDATE public.answers SET marked_for_review=true,client_updated_at=NULL WHERE attempt_id=pg_temp.f3id('a1');
UPDATE public.answers SET marked_for_review=true,client_updated_at='2020-01-02Z' WHERE attempt_id=pg_temp.f3id('a1');
UPDATE public.answers SET marked_for_review=true,client_updated_at='2020-01-01Z' WHERE attempt_id=pg_temp.f3id('a1');
SELECT pg_temp.assert_true(current_user='authenticated' AND (SELECT NOT marked_for_review AND client_updated_at='2020-01-02Z' FROM public.answers WHERE attempt_id=pg_temp.f3id('a1')), 'forged claims and GUC never authorize stale authenticated writes');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.f3id('student'),'role','authenticated')::text,true);
SELECT pg_temp.reject($s$INSERT INTO public.answers(attempt_id,question_id,client_updated_at) VALUES(pg_temp.f3id('a2'),pg_temp.f3id('q2'),clock_timestamp()+interval '3 minutes') ON CONFLICT(attempt_id,question_id) DO UPDATE SET client_updated_at=EXCLUDED.client_updated_at$s$, 'invalid answer client_updated_at', 'absurd future denied on upsert insert path');
SELECT pg_temp.reject($s$UPDATE public.answers SET client_updated_at='infinity' WHERE attempt_id=pg_temp.f3id('a2')$s$, 'invalid answer client_updated_at', 'infinite timestamp denied');
SELECT pg_temp.reject($s$UPDATE public.answers SET selected_option_id=pg_temp.f3id('o2'),client_updated_at=NULL WHERE attempt_id=pg_temp.f3id('a1')$s$, 'option does not belong', 'stale write does not bypass option guard');
SELECT pg_temp.reject($s$UPDATE public.answers SET question_id=pg_temp.f3id('q2'),client_updated_at=NULL WHERE attempt_id=pg_temp.f3id('a1')$s$, 'immutable', 'stale write does not bypass identity guard');
SELECT pg_temp.reject($s$INSERT INTO public.answers(attempt_id,question_id) VALUES(pg_temp.f3id('a1'),pg_temp.f3id('q2'))$s$, 'question does not belong', 'foreign question denied');
SELECT pg_temp.reject($s$INSERT INTO public.answers(attempt_id,question_id) VALUES(pg_temp.f3id('a5'),pg_temp.f3id('q5'))$s$, 'not found', 'foreign owner hidden by real attempt RLS');
SELECT pg_temp.reject($s$INSERT INTO public.answers(attempt_id,question_id,client_updated_at) VALUES(pg_temp.f3id('a3'),pg_temp.f3id('q3'),'2020-01-01Z')$s$, 'deadline exceeded', 'old version is not deadline authorization');
SELECT pg_temp.reject($s$UPDATE public.answers SET client_updated_at=NULL WHERE attempt_id=pg_temp.f3id('a4')$s$, 'not in progress', 'submitted guard still runs before freshness');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.answers'::regclass), 'RLS remains enabled');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM pg_trigger WHERE tgrelid='public.answers'::regclass AND tgname='trg_enforce_answer_integrity' AND tgenabled='O'), 'F0 trigger intact');
-- Some local templates omit backup. Exact column double from 20260812100000,
-- transactional and local only; the RPC functions themselves are NOT doubles.
DO $$ BEGIN
  IF to_regclass('backup.presencial_superseded_answers') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS backup;
    CREATE TABLE backup.presencial_superseded_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL,
      user_id uuid NOT NULL, simulado_id uuid NOT NULL, answers jsonb NOT NULL,
      previous_status text, previous_score numeric(5,2),
      superseded_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.create_presencial_attempt_guarded(pg_temp.f3id('s1'));
SELECT public.submit_offline_answers_guarded(pg_temp.f3id('a1'),jsonb_build_array(
  jsonb_build_object('question_id',pg_temp.f3id('q1'),'selected_option_id',pg_temp.f3id('ob1'))));
RESET ROLE;
SELECT pg_temp.assert_true((SELECT selected_option_id=pg_temp.f3id('ob1') AND client_updated_at='2020-01-02Z'
  FROM public.answers WHERE attempt_id=pg_temp.f3id('a1')), 'real presencial RPC applies paper answer and preserves version');
SELECT pg_temp.assert_true((SELECT score_percentage=0 FROM public.attempts WHERE id=pg_temp.f3id('a1')), 'paper grade replaces online answer: zero not 100');
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM backup.presencial_superseded_answers
  WHERE attempt_id=pg_temp.f3id('a1') AND answers @> jsonb_build_array(jsonb_build_object('selected_option_id',pg_temp.f3id('o1')))), 'online answer remains backed up');
ROLLBACK;
