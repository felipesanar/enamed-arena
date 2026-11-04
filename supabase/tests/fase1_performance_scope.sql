-- Disposable local target clone only. All fixture changes roll back.
\set ON_ERROR_STOP on
BEGIN;
-- Explicit offline fixture isolation: preserve auth/profile creation, but do
-- not invoke the outbound HubSpot trigger. DDL is restored by ROLLBACK.
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;

INSERT INTO auth.users(id,email) VALUES
 ('f1700000-0000-0000-0000-000000000001','performance-one@example.invalid'),
 ('f1700000-0000-0000-0000-000000000002','performance-other@example.invalid'),
 ('f1700000-0000-0000-0000-000000000003','performance-empty@example.invalid');
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f1700000-0000-0000-0000-000000000011','2197.1',2197,1,'Performance A','active'),
 ('f1700000-0000-0000-0000-000000000012','2197.2',2197,2,'Performance B','preparing');
-- 25 released A exams, one B and two unreleased A exams.
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at,status)
SELECT ('f1710000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 'Performance fixture '||n,'performance-f17-'||n,n,
 CASE WHEN n=26 THEN 'f1700000-0000-0000-0000-000000000012'::uuid
 ELSE 'f1700000-0000-0000-0000-000000000011'::uuid END,
 now()-interval '10 days',now()-interval '9 days',
 CASE WHEN n>=27 THEN now()+interval '1 day'
 ELSE now()-interval '8 days' END,'published'
FROM generate_series(1,28) n;

INSERT INTO public.attempts(id,simulado_id,user_id,status,effective_deadline,
 finished_at,score_percentage,total_correct,total_answered,is_within_window,attempt_type)
SELECT ('f1720000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f1710000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'f1700000-0000-0000-0000-000000000001','submitted',now()-interval '9 days',
 now()-interval '9 days'+n*interval '1 minute',50,5,10,n<>25,'online'
FROM generate_series(1,28) n;
-- Same simulado: larger score wins; equal scores prefer earlier finish,
-- then immutable ID. Training must never win the no-training selection.
INSERT INTO public.attempts(id,simulado_id,user_id,status,effective_deadline,
 finished_at,score_percentage,total_correct,total_answered,is_within_window,attempt_type)
VALUES
 ('f1730000-0000-0000-0000-000000000001','f1710000-0000-0000-0000-000000000001','f1700000-0000-0000-0000-000000000001','expired',now(),now()-interval '9 days',80,8,10,true,'presencial'),
 ('f1730000-0000-0000-0000-000000000002','f1710000-0000-0000-0000-000000000002','f1700000-0000-0000-0000-000000000001','submitted',now(),now()-interval '9 days',50,5,10,true,'presencial'),
 ('f1710000-0000-0000-0000-000000000003','f1710000-0000-0000-0000-000000000003','f1700000-0000-0000-0000-000000000001','expired',now(),now()-interval '9 days'+interval '3 minutes',50,5,10,true,'presencial'),
 ('f1730000-0000-0000-0000-000000000004','f1710000-0000-0000-0000-000000000004','f1700000-0000-0000-0000-000000000001','submitted',now(),now(),100,10,10,false,'offline'),
 ('f1730000-0000-0000-0000-000000000005','f1710000-0000-0000-0000-000000000005','f1700000-0000-0000-0000-000000000001','in_progress',now(),now(),100,10,10,true,'offline'),
 ('f1730000-0000-0000-0000-000000000006','f1710000-0000-0000-0000-000000000006','f1700000-0000-0000-0000-000000000001','expired',now(),now(),NULL,0,0,true,'offline'),
 ('f1730000-0000-0000-0000-000000000007','f1710000-0000-0000-0000-000000000001','f1700000-0000-0000-0000-000000000002','submitted',now(),now(),100,10,10,true,'online');
-- Explicit historical fixtures, not finalizer calls or a backlog recomputation.
INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,
 score_percentage,total_correct,total_answered,total_questions,finished_at)
SELECT user_id,id,simulado_id,coalesce(score_percentage,0),total_correct,total_answered,10,finished_at
FROM public.attempts WHERE user_id IN
 ('f1700000-0000-0000-0000-000000000001','f1700000-0000-0000-0000-000000000002');

CREATE TEMP TABLE performance_before AS SELECT
 (SELECT count(*) FROM public.user_performance_history) AS history_count,
 (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]') FROM public.user_performance_history h) AS history,
 (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.attempts a) AS attempts,
 (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.user_id),'[]') FROM public.user_performance_summary s) AS summary;

SELECT set_config('request.jwt.claims','{"sub":"f1700000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE edition uuid := 'f1700000-0000-0000-0000-000000000011';
 ids uuid[]; paged uuid[];
BEGIN
 ASSERT (SELECT count(*) FROM public.get_user_performance_history())=32,
   'legacy default must return all 32 released history rows, not 20';
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_limit=>NULL))=32;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(auth.uid(),30))=30;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_user_id=>auth.uid(),p_limit=>2))=2;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_include_training=>NULL))=32;
 ASSERT NOT EXISTS (
   (SELECT attempt_id,simulado_id,score_percentage,total_correct,total_answered,total_questions,finished_at
    FROM public.user_performance_history WHERE user_id=auth.uid()
      AND simulado_id IN (SELECT id FROM public.simulados WHERE results_release_at<=now())
    EXCEPT SELECT * FROM public.get_user_performance_history())
   UNION ALL
   (SELECT * FROM public.get_user_performance_history()
    EXCEPT SELECT attempt_id,simulado_id,score_percentage,total_correct,total_answered,total_questions,finished_at
    FROM public.user_performance_history WHERE user_id=auth.uid()
      AND simulado_id IN (SELECT id FROM public.simulados WHERE results_release_at<=now())));
 ASSERT (SELECT total_attempts FROM public.get_user_performance_summary(p_user_id=>auth.uid()))=32;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false))=24;
 ASSERT (SELECT total_attempts=24 AND avg_score=51.25 AND best_score=80 AND last_score=50
   AND last_simulado_id='f1710000-0000-0000-0000-000000000024'::uuid
   FROM public.get_user_performance_summary(p_edition_id=>edition,p_include_training=>false));
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_edition_id=>edition))=25;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_include_training=>false))=25;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_edition_id=>'f1700000-0000-0000-0000-000000000012',p_include_training=>false))=1;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_edition_id=>'f1700000-0000-0000-0000-000000000099'))=0;
 ASSERT NOT EXISTS(SELECT FROM public.get_user_performance_summary(p_edition_id=>'f1700000-0000-0000-0000-000000000099'));
 ASSERT (SELECT attempt_id='f1730000-0000-0000-0000-000000000001'::uuid FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false) WHERE simulado_id='f1710000-0000-0000-0000-000000000001');
 ASSERT (SELECT attempt_id='f1730000-0000-0000-0000-000000000002'::uuid FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false) WHERE simulado_id='f1710000-0000-0000-0000-000000000002');
 ASSERT (SELECT attempt_id='f1710000-0000-0000-0000-000000000003'::uuid FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false) WHERE simulado_id='f1710000-0000-0000-0000-000000000003');
 ASSERT NOT EXISTS (
   SELECT FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false) h
   CROSS JOIN LATERAL public.get_ranking_for_simulado(h.simulado_id) r
   WHERE r.user_id=auth.uid() AND (r.nota_final<>h.score_percentage OR r.finished_at<>h.finished_at));
 SELECT array_agg(attempt_id ORDER BY finished_at DESC,simulado_id DESC,attempt_id DESC)
 INTO ids FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false);
 SELECT array_agg(attempt_id ORDER BY finished_at DESC,simulado_id DESC,attempt_id DESC)
 INTO paged FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false,p_limit=>3,p_offset=>2);
 ASSERT paged=ids[3:5], 'pagination must follow selection and deterministic ordering';
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_edition_id=>edition,p_include_training=>false,p_offset=>24))=0;
 ASSERT (SELECT count(*) FROM public.get_user_performance_history(p_limit=>0,p_offset=>-1))=1;
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_history(p_user_id=>'f1700000-0000-0000-0000-000000000002'));
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_summary(p_user_id=>'f1700000-0000-0000-0000-000000000002'));
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_summary(p_user_id=>'f1700000-0000-0000-0000-000000000002',p_edition_id=>edition,p_include_training=>false));
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_history(p_user_id=>'f1700000-0000-0000-0000-000000000002',p_edition_id=>edition,p_include_training=>false));
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f1700000-0000-0000-0000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_history());
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_summary());
 ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_summary(p_edition_id=>'f1700000-0000-0000-0000-000000000011',p_include_training=>false));
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 -- The production execute ACL includes anon; either empty or table ACL denial
 -- is safe. Do not add a definer bypass merely to make anonymous reads work.
 BEGIN
   ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_history(p_user_id=>'f1700000-0000-0000-0000-000000000001',p_edition_id=>'f1700000-0000-0000-0000-000000000011',p_include_training=>false));
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   ASSERT NOT EXISTS (SELECT FROM public.get_user_performance_summary(p_user_id=>'f1700000-0000-0000-0000-000000000001'));
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.user_performance_history)=(SELECT history_count FROM performance_before);
 ASSERT (SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.user_performance_history h)=(SELECT history FROM performance_before);
 ASSERT (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attempts a)=(SELECT attempts FROM performance_before);
 ASSERT (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.user_id),'[]') FROM public.user_performance_summary s)=(SELECT summary FROM performance_before);
 ASSERT (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_user_performance_history')=1;
 ASSERT (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_user_performance_summary')=1;
 ASSERT (SELECT bool_and(NOT prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=public'])
   FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('get_user_performance_history','get_user_performance_summary'));
 ASSERT has_function_privilege('authenticated','public.get_user_performance_history(uuid,integer,uuid,boolean,integer)','EXECUTE');
 ASSERT has_function_privilege('anon','public.get_user_performance_history(uuid,integer,uuid,boolean,integer)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.get_user_performance_summary(uuid,uuid,boolean)','EXECUTE');
 ASSERT (SELECT bool_and(proowner='postgres'::regrole) FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname IN ('get_user_performance_history','get_user_performance_summary'));
 ASSERT (SELECT bool_and(EXISTS (SELECT FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))
   FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN ('get_user_performance_history','get_user_performance_summary'));
END $$;
SELECT 'F1-7 performance scope assertions passed; fixture rolled back' AS result;
ROLLBACK;
