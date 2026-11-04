-- Run only on a fresh F1 clone with the current F2 analytics migration applied.
\set ON_ERROR_STOP on
SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
 AND (current_database() LIKE 'enamed_test_archived_%' OR current_database() ~ '^enamed_test_fixtures_integrated_[a-z0-9_]+$')
 AND session_user='postgres' AND current_user='postgres')::int);
BEGIN;
\ir local/fixture-publication-setup.sql
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT
 ('fa180000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'archived-'||n||'@example.invalid' FROM generate_series(1,6) n;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('fa180000-0000-0000-0000-000000000006','content_editor');
INSERT INTO public.role_capabilities(role,capability) VALUES ('content_editor','content.manage')
 ON CONFLICT DO NOTHING;
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('fa180000-0000-0000-0000-000000000011','2195.1',2195,1,'Archived A','closed'),
 ('fa180000-0000-0000-0000-000000000012','2195.2',2195,2,'Archived B','archived');
INSERT INTO public.enamed_specialties(id,name,slug) VALUES
 ('fa180000-0000-0000-0000-000000000021','Frozen specialty','archived-frozen'),
 ('fa180000-0000-0000-0000-000000000022','Current specialty','archived-current');
INSERT INTO public.enamed_institutions(id,name,uf,slug) VALUES
 ('fa180000-0000-0000-0000-000000000023','Frozen institution','SP','archived-institution');
INSERT INTO public.onboarding_profiles(user_id,specialty_id,target_institution_ids)
 SELECT id,'fa180000-0000-0000-0000-000000000021',
 ARRAY['fa180000-0000-0000-0000-000000000023']::uuid[] FROM auth.users
 WHERE id IN ('fa180000-0000-0000-0000-000000000001','fa180000-0000-0000-0000-000000000002');
SELECT pg_temp.fixture_publication_begin();
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,status,
 execution_window_start,execution_window_end,results_release_at)
 SELECT ('fa181000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'Archive '||n,'archive-fixture-'||n,n,
 CASE WHEN n=2 THEN 'fa180000-0000-0000-0000-000000000012'::uuid
 ELSE 'fa180000-0000-0000-0000-000000000011'::uuid END,'published',
 now()-interval '10 days',now()-interval '9 days',now()-interval '8 days'
  FROM generate_series(1,2) n;
SELECT pg_temp.fixture_publication_end();
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme,explanation)
 SELECT ('fa182000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('fa181000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,1,'Question '||n,'CM','Theme','Comment'
 FROM generate_series(1,2) n;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
 SELECT ('fa183000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('fa182000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'A','Answer',true
 FROM generate_series(1,2) n;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,effective_deadline,
 finished_at,score_percentage,total_correct,total_answered,is_within_window)
 SELECT ('fa184000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<=2 THEN 'fa180000-0000-0000-0000-000000000001'::uuid
 ELSE ('fa180000-0000-0000-0000-'||lpad((n-1)::text,12,'0'))::uuid END,
 CASE WHEN n=2 THEN 'fa181000-0000-0000-0000-000000000002'::uuid
 ELSE 'fa181000-0000-0000-0000-000000000001'::uuid END,
 CASE n WHEN 3 THEN 'expired'::public.attempt_status WHEN 4 THEN 'in_progress'::public.attempt_status
 WHEN 5 THEN 'offline_pending'::public.attempt_status ELSE 'submitted'::public.attempt_status END,
 CASE WHEN n=5 THEN 'offline' ELSE 'online' END,now(),
 CASE WHEN n<=3 THEN now()-interval '9 days' ELSE NULL END,
 CASE WHEN n<=3 THEN 80 ELSE NULL END,1,1,true
 FROM generate_series(1,6) n;
-- A second modality exercises best-attempt dedup without changing finalizers.
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,effective_deadline,
 finished_at,score_percentage,total_correct,total_answered,is_within_window)
 VALUES ('fa184000-0000-0000-0000-000000000007','fa180000-0000-0000-0000-000000000001',
 'fa181000-0000-0000-0000-000000000001','expired','presencial',now(),now()-interval '8 days',80,1,1,true);
UPDATE public.onboarding_profiles SET specialty_id='fa180000-0000-0000-0000-000000000022',
 target_institution_ids=ARRAY[]::uuid[] WHERE user_id::text LIKE 'fa180000-%';
ALTER TABLE public.answers DISABLE TRIGGER trg_enforce_answer_integrity;
INSERT INTO public.answers(attempt_id,question_id,selected_option_id,confidence,high_confidence)
 SELECT a.id,q.id,o.id,'alta',true FROM public.attempts a
 JOIN public.questions q ON q.simulado_id=a.simulado_id
 JOIN public.question_options o ON o.question_id=q.id WHERE a.id::text LIKE 'fa184000-%';
ALTER TABLE public.answers ENABLE TRIGGER trg_enforce_answer_integrity;
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered)
 SELECT a.id,q.id,true,true FROM public.attempts a
 JOIN public.questions q ON q.simulado_id=a.simulado_id WHERE a.id::text LIKE 'fa184000-%';
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,theme,reason,question_text)
 SELECT 'fa180000-0000-0000-0000-000000000001',simulado_id,id,'CM','Theme',
 'confused_alternatives',text FROM public.questions WHERE id::text LIKE 'fa182000-%';
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,theme,reason,question_text)
 SELECT ('fa180000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'fa181000-0000-0000-0000-000000000001','fa182000-0000-0000-0000-000000000001',
 'CM','Theme','confused_alternatives','Cached content cannot authorize archived history'
 FROM generate_series(3,5) n;

CREATE FUNCTION pg_temp.read_history() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
 'questions',(SELECT jsonb_agg(id ORDER BY id) FROM public.questions WHERE simulado_id='fa181000-0000-0000-0000-000000000001'),
 'options',(SELECT jsonb_agg(id ORDER BY id) FROM public.question_options WHERE question_id='fa182000-0000-0000-0000-000000000001'),
 'explanations',(SELECT jsonb_agg(to_jsonb(x)) FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001') x),
 'aqr',(SELECT jsonb_agg(to_jsonb(x) ORDER BY attempt_id,question_id) FROM public.attempt_question_results x WHERE attempt_id::text LIKE 'fa184000-%'),
 'history',public.get_area_score_history(auth.uid(),'fa180000-0000-0000-0000-000000000011'),
 'behavior',(SELECT jsonb_agg(to_jsonb(x) ORDER BY attempt_id) FROM public.get_user_attempt_behavior_stats(auth.uid(),'fa180000-0000-0000-0000-000000000011') x),
 'calibration',public.get_confidence_calibration(auth.uid(),'fa180000-0000-0000-0000-000000000011'),
 'patterns',public.get_caderno_pattern_data(auth.uid(),'fa180000-0000-0000-0000-000000000011'),
 'ranking',(SELECT jsonb_agg(to_jsonb(x) ORDER BY posicao) FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001') x))
$$;
CREATE TEMP TABLE baseline(payload jsonb);
GRANT ALL ON baseline TO authenticated;
CREATE TEMP TABLE immutable AS SELECT
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE id::text LIKE 'fa184000-%') attempts,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.answers a WHERE attempt_id::text LIKE 'fa184000-%') answers,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY attempt_id,question_id) FROM public.attempt_question_results a WHERE attempt_id::text LIKE 'fa184000-%') results;
SELECT set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO baseline SELECT pg_temp.read_history();
DO $$ BEGIN
 ASSERT (SELECT jsonb_array_length(payload->'questions') FROM baseline)=1,'published baseline questions';
 ASSERT (SELECT jsonb_array_length(payload->'history'->'global') FROM baseline)=1,'published best attempt';
 ASSERT (SELECT jsonb_array_length(payload->'ranking') FROM baseline)=2,'published dedup population';
 ASSERT (SELECT payload#>>'{history,global,0,attempt_id}' FROM baseline)='fa184000-0000-0000-0000-000000000001','best score tie chooses earlier finish';
 ASSERT (SELECT payload#>>'{ranking,0,user_id}' FROM baseline)='fa180000-0000-0000-0000-000000000001','ranking tie chooses user ID';
 ASSERT (SELECT payload#>>'{ranking,0,especialidade}' FROM baseline)='Frozen specialty','closed edition uses snapshot';
 ASSERT (SELECT payload#>>'{ranking,0,instituicoes_alvo,0}' FROM baseline)='Frozen institution','closed institution snapshot';
END $$;
RESET ROLE;
UPDATE public.simulados SET status='archived' WHERE id::text LIKE 'fa181000-%';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT pg_temp.read_history()=(SELECT payload FROM baseline),
 'RED: published -> archived must preserve questions/correction/AQR/analytics/ranking';
 ASSERT public.get_area_score_history(auth.uid(),'fa180000-0000-0000-0000-000000000012')
  #>>'{global,0,attempt_id}'='fa184000-0000-0000-0000-000000000002','other edition stays isolated';
 ASSERT (SELECT count(*) FROM public.get_user_attempt_behavior_stats(auth.uid(),'fa180000-0000-0000-0000-000000000012'))=1;
 ASSERT (SELECT especialidade FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000002'))='Frozen specialty','archived edition snapshot';
 ASSERT jsonb_array_length(public.get_area_score_history(auth.uid())->'global')=2,'cumulative submitted semantics';
 ASSERT (SELECT count(*) FROM public.get_user_attempt_behavior_stats())=3,'cumulative partitions';
 ASSERT public.get_confidence_calibration(auth.uid())#>>'{overall,total_answered_with_confidence}'='2';
 ASSERT public.get_caderno_pattern_data(auth.uid())->>'total_entries'='2';
 BEGIN PERFORM explanation FROM public.questions; RAISE EXCEPTION 'owner direct explanation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM is_correct FROM public.question_options; RAISE EXCEPTION 'owner direct key'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 ASSERT NOT EXISTS(SELECT FROM public.attempt_question_results WHERE attempt_id='fa184000-0000-0000-0000-000000000003'),'other user AQR';
 BEGIN
  PERFORM public.get_area_score_history('fa180000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'cross-owner history succeeded';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='forbidden'; END;
 BEGIN
  PERFORM public.create_attempt_guarded('fa181000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'archived create succeeded';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Simulado not found or not published'; END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN
 ASSERT (SELECT count(id) FROM public.questions WHERE simulado_id::text LIKE 'fa181000-%')=1,'expired owner sees only own exam';
 ASSERT NOT EXISTS(SELECT id FROM public.question_options WHERE question_id='fa182000-0000-0000-0000-000000000002'),'other exam options';
 ASSERT NOT EXISTS(SELECT FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000002')),'other exam correction';
 ASSERT (SELECT count(*) FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001'))=1,'expired owner correction';
 ASSERT (SELECT count(*) FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001'))=2,'expired owner sees original population';
 ASSERT jsonb_array_length(public.get_area_score_history(auth.uid(),'fa180000-0000-0000-0000-000000000011')->'global')=1,'expired edition history';
END $$;

-- Every unauthorized caller is exercised as authenticated, not postgres.
DO $$ DECLARE n integer; u text; BEGIN
 FOR n IN 3..5 LOOP
  u:='fa180000-0000-0000-0000-'||lpad(n::text,12,'0');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  ASSERT (SELECT count(id) FROM public.simulados WHERE id::text LIKE 'fa181000-%')=1,'F1 any-attempt metadata preserved';
  ASSERT NOT EXISTS(SELECT id FROM public.questions WHERE simulado_id::text LIKE 'fa181000-%'),'unfinished question leak';
  ASSERT NOT EXISTS(SELECT id FROM public.question_options WHERE question_id::text LIKE 'fa182000-%'),'unfinished options leak';
  ASSERT NOT EXISTS(SELECT FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001')),'unfinished correction leak';
  ASSERT NOT EXISTS(SELECT FROM public.attempt_question_results WHERE attempt_id::text LIKE 'fa184000-%'),'unfinished AQR leak';
  ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001')),'unfinished ranking leak';
  ASSERT jsonb_array_length(public.get_area_score_history(u::uuid)->'global')=0,'unfinished history leak';
  ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats(u::uuid)),'unfinished behavior leak';
  ASSERT public.get_confidence_calibration(u::uuid)#>>'{overall,total_answered_with_confidence}'='0';
  ASSERT public.get_caderno_pattern_data(u::uuid)->>'total_entries'='0','cached notebook cannot authorize archived analytics';
  BEGIN
   PERFORM public.create_attempt_guarded('fa181000-0000-0000-0000-000000000001');
   RAISE EXCEPTION 'archived resume succeeded';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Simulado not found or not published'; END;
 END LOOP;
 -- No attempt at all (admin role removed below only for this read).
 PERFORM set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000099","role":"authenticated"}',true);
 ASSERT NOT EXISTS(SELECT id FROM public.simulados WHERE id::text LIKE 'fa181000-%'),'metadata fence bypass';
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001')),'no-attempt ranking leak';
 ASSERT NOT EXISTS(SELECT id FROM public.questions WHERE simulado_id::text LIKE 'fa181000-%');
 -- Empty authenticated identity must also fail closed without an exception bypass.
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 ASSERT NOT EXISTS(SELECT id FROM public.questions WHERE simulado_id::text LIKE 'fa181000-%');
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001'));
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000001","role":"authenticated"}',true);
-- Fail closed for release/start/status, including NULL, even with an owner finish.
ALTER TABLE public.simulados ALTER COLUMN results_release_at DROP NOT NULL;
ALTER TABLE public.simulados ALTER COLUMN execution_window_start DROP NOT NULL;
-- Exercise fail-closed malformed legacy windows too; transaction rolls this back.
ALTER TABLE public.simulados DROP CONSTRAINT simulados_edition_windows_check;
DO $$ DECLARE mode integer; BEGIN
 FOR mode IN 1..5 LOOP
  UPDATE public.simulados SET
   results_release_at=CASE mode WHEN 1 THEN now()+interval '1 day' WHEN 2 THEN NULL ELSE now()-interval '8 days' END,
   execution_window_start=CASE mode WHEN 3 THEN now()+interval '1 day' WHEN 4 THEN NULL ELSE now()-interval '10 days' END,
   status=CASE WHEN mode=5 THEN 'draft'::public.simulado_status ELSE 'archived'::public.simulado_status END
   WHERE id='fa181000-0000-0000-0000-000000000001';
  SET LOCAL ROLE authenticated;
  ASSERT NOT EXISTS(SELECT id FROM public.questions WHERE simulado_id='fa181000-0000-0000-0000-000000000001'),'temporal question leak';
  ASSERT NOT EXISTS(SELECT FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001')),'temporal correction leak';
  ASSERT NOT EXISTS(SELECT FROM public.attempt_question_results WHERE attempt_id IN ('fa184000-0000-0000-0000-000000000001','fa184000-0000-0000-0000-000000000007')),'temporal AQR leak';
  ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001')),'temporal ranking leak';
  ASSERT jsonb_array_length(public.get_area_score_history(auth.uid(),'fa180000-0000-0000-0000-000000000011')->'global')=0;
  ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats(auth.uid(),'fa180000-0000-0000-0000-000000000011'));
  ASSERT public.get_confidence_calibration(auth.uid(),'fa180000-0000-0000-0000-000000000011')#>>'{overall,total_answered_with_confidence}'='0';
  ASSERT public.get_caderno_pattern_data(auth.uid(),'fa180000-0000-0000-0000-000000000011')->>'total_entries'='0';
  RESET ROLE;
 END LOOP;
END $$;
UPDATE public.simulados SET status='test',execution_window_start=now()-interval '10 days',
 results_release_at=now()-interval '8 days' WHERE id='fa181000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001'))=1,'F0 test RPC source preserved';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000006","role":"authenticated"}',true);
UPDATE public.simulados SET status='archived' WHERE id::text LIKE 'fa181000-%';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001')),'content admin cannot bypass archived ranking caller gate';
END $$;
RESET ROLE;
UPDATE public.simulados SET status='draft',results_release_at=now()+interval '1 day' WHERE id::text LIKE 'fa181000-%';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.has_capability('content.manage'),'content admin fixture';
 ASSERT (SELECT count(*) FROM public.admin_get_simulado_questions('fa181000-0000-0000-0000-000000000001') WHERE explanation='Comment' AND (options->0->>'is_correct')::boolean)=1,'admin RPC preserved';
 BEGIN PERFORM explanation FROM public.questions; RAISE EXCEPTION 'direct explanation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM explanation_image_url FROM public.questions; RAISE EXCEPTION 'direct image'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM is_correct FROM public.question_options; RAISE EXCEPTION 'direct key'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM id FROM public.questions; RAISE EXCEPTION 'anon questions'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_question_explanations('fa181000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'anon RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT attempts FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE id::text LIKE 'fa184000-%'),'attempt/score/status/finish/snapshot changed';
 ASSERT (SELECT answers FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.answers a WHERE attempt_id::text LIKE 'fa184000-%'),'answers changed';
 ASSERT (SELECT results FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY attempt_id,question_id) FROM public.attempt_question_results a WHERE attempt_id::text LIKE 'fa184000-%'),'results changed';
END $$;

-- Lifecycle checks run inside the same rollback-only fixture transaction.
CREATE TEMP TABLE checkpoint_before AS SELECT * FROM archived_read_private.checkpoints;
CREATE TEMP TABLE function_security AS SELECT p.oid,p.proowner,p.proacl,p.prosecdef
 FROM pg_proc p JOIN archived_read_private.checkpoints c ON c.kind='function'
 AND p.oid=to_regprocedure(c.object_key);
CREATE FUNCTION pg_temp.rollback_archived_read() RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record; current_ddl text; pol text;
BEGIN
 FOR r IN SELECT * FROM archived_read_private.checkpoints WHERE applied LOOP
  IF r.kind='function' THEN
   current_ddl:=pg_get_functiondef(to_regprocedure(r.object_key));
  ELSE
   pol:=CASE r.object_key WHEN 'questions' THEN 'fase0_questions_release'
    ELSE 'Users can read own attempt question results' END;
   SELECT format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',policyname,tablename,qual)
    INTO current_ddl FROM pg_policies WHERE schemaname='public' AND tablename=r.object_key AND policyname=pol
     AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[];
  END IF;
  IF current_ddl IS DISTINCT FROM r.applied_definition THEN
   RAISE EXCEPTION 'Later changes require manual merge: %',r.object_key;
  END IF;
 END LOOP;
 FOR r IN SELECT * FROM archived_read_private.checkpoints WHERE applied LOOP
  IF r.kind='policy' THEN
   pol:=CASE r.object_key WHEN 'questions' THEN 'fase0_questions_release'
    ELSE 'Users can read own attempt question results' END;
   EXECUTE format('DROP POLICY %I ON public.%I',pol,r.object_key);
  END IF;
  EXECUTE r.original_definition;
  UPDATE archived_read_private.checkpoints SET applied=false WHERE object_key=r.object_key;
 END LOOP;
END $$;
ALTER FUNCTION public.get_area_score_history(uuid,uuid) COST 777;
\ir ../migrations/20261104115401_fase1_archived_result_read.sql
DO $$ BEGIN
 ASSERT (SELECT procost FROM pg_proc WHERE oid='public.get_area_score_history(uuid,uuid)'::regprocedure)=777,'reapply erased later adjustment';
 ASSERT NOT EXISTS((SELECT * FROM checkpoint_before EXCEPT SELECT * FROM archived_read_private.checkpoints)
  UNION ALL (SELECT * FROM archived_read_private.checkpoints EXCEPT SELECT * FROM checkpoint_before)),'reapply rewrote checkpoint';
 BEGIN
  PERFORM pg_temp.rollback_archived_read();
  RAISE EXCEPTION 'rollback erased later adjustment';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Later changes require manual merge:%'; END;
 EXECUTE (SELECT applied_definition FROM archived_read_private.checkpoints WHERE object_key='public.get_area_score_history(uuid,uuid)');
END $$;
ALTER POLICY fase0_questions_release ON public.questions TO service_role;
\ir ../migrations/20261104115401_fase1_archived_result_read.sql
DO $$ BEGIN
 ASSERT (SELECT roles FROM pg_policies WHERE schemaname='public' AND tablename='questions'
  AND policyname='fase0_questions_release')=ARRAY['service_role']::name[],'reapply erased later policy metadata';
 BEGIN
  PERFORM pg_temp.rollback_archived_read();
  RAISE EXCEPTION 'rollback erased later policy metadata';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM LIKE 'Later changes require manual merge:%'; END;
END $$;
ALTER POLICY fase0_questions_release ON public.questions TO authenticated;
SELECT pg_temp.rollback_archived_read();
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM archived_read_private.checkpoints WHERE applied),'rollback checkpoints';
 ASSERT NOT EXISTS(SELECT FROM archived_read_private.checkpoints WHERE kind='function'
  AND original_definition IS DISTINCT FROM pg_get_functiondef(to_regprocedure(object_key))),'rollback exact original definitions';
 ASSERT NOT has_column_privilege('authenticated','public.questions','explanation','SELECT'),'rollback column gate';
 ASSERT NOT has_column_privilege('authenticated','public.question_options','is_correct','SELECT'),'rollback key gate';
 ASSERT NOT has_function_privilege('anon','public.get_question_explanations(uuid)','EXECUTE'),'rollback anon RPC gate';
END $$;
-- The rollback restores the old missing-archived behavior, not an insecure grant.
UPDATE public.simulados SET status='archived',execution_window_start=now()-interval '10 days',
 results_release_at=now()-interval '8 days' WHERE id::text LIKE 'fa181000-%';
SELECT set_config('request.jwt.claims','{"sub":"fa180000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT id FROM public.questions WHERE simulado_id::text LIKE 'fa181000-%'),'rollback archived question gate';
 ASSERT NOT EXISTS(SELECT FROM public.get_question_explanations('fa181000-0000-0000-0000-000000000001')),'rollback correction gate';
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('fa181000-0000-0000-0000-000000000001')),'rollback ranking gate';
END $$;
RESET ROLE;
\ir ../migrations/20261104115401_fase1_archived_result_read.sql
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT pg_temp.read_history()=(SELECT payload FROM baseline),'reapply after rollback restores historical result';
 BEGIN PERFORM * FROM archived_read_private.checkpoints; RAISE EXCEPTION 'private backup readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM function_security s JOIN pg_proc p ON p.oid=s.oid
  WHERE s.proowner<>p.proowner OR s.proacl IS DISTINCT FROM p.proacl OR s.prosecdef<>p.prosecdef),'owner/ACL/security mode changed';
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.get_user_attempt_behavior_stats(uuid,uuid)'::regprocedure),'behavior must remain invoker';
 ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='archived_read_private.checkpoints'::regclass),'checkpoint RLS';
 ASSERT NOT has_schema_privilege('authenticated','archived_read_private','USAGE'),'private schema exposure';
 ASSERT (SELECT attempts FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE id::text LIKE 'fa184000-%'),'lifecycle changed attempts';
 ASSERT (SELECT answers FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.answers a WHERE attempt_id::text LIKE 'fa184000-%'),'lifecycle changed answers';
 ASSERT (SELECT results FROM immutable)=(SELECT jsonb_agg(to_jsonb(a) ORDER BY attempt_id,question_id) FROM public.attempt_question_results a WHERE attempt_id::text LIKE 'fa184000-%'),'lifecycle changed AQR';
END $$;
ROLLBACK;
\echo 'PASS archived result read: all assertion groups completed; fixtures rolled back'
