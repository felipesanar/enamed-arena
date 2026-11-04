-- ONLY the disposable localhost analytics clone. No production/service calls.
\set ON_ERROR_STOP on
SELECT 1 / ((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
 AND (current_database() LIKE 'enamed_test_analytics_%' OR current_database() ~ '^enamed_test_fixtures_integrated_[a-z0-9_]+$')
 AND session_user='postgres' AND current_user='postgres')::int);
BEGIN;
\ir local/fixture-publication-setup.sql
DO $$ BEGIN
 ASSERT to_regprocedure('public.get_area_score_history(uuid,uuid)') IS NOT NULL,
   'RED: edition-aware analytics signature is missing';
END $$;
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT
 ('f2200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'analytics-'||n||'@example.invalid' FROM generate_series(1,3) n;
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f2200000-0000-0000-0000-000000000011','2196.1',2196,1,'Analytics A','closed'),
 ('f2200000-0000-0000-0000-000000000012','2196.2',2196,2,'Analytics B','active');
INSERT INTO public.enamed_specialties(id,name,slug) VALUES
 ('f2200000-0000-0000-0000-000000000021','Snapshot specialty','analytics-old'),
 ('f2200000-0000-0000-0000-000000000022','Current specialty','analytics-new');
INSERT INTO public.enamed_institutions(id,name,uf,slug) VALUES
 ('f2200000-0000-0000-0000-000000000023','Snapshot I','SP','analytics-i'),
 ('f2200000-0000-0000-0000-000000000024','Snapshot II','SP','analytics-ii');
INSERT INTO public.onboarding_profiles(user_id,specialty_id,target_institution_ids)
 SELECT id,'f2200000-0000-0000-0000-000000000021',
 ARRAY['f2200000-0000-0000-0000-000000000024','f2200000-0000-0000-0000-000000000023']::uuid[]
 FROM auth.users WHERE id::text LIKE 'f2200000-%';
SELECT pg_temp.fixture_publication_begin();
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at,status)
 SELECT ('f2210000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'Analytics '||n,'analytics-fixture-'||n,CASE WHEN n=2 THEN 1 ELSE n END,
 CASE WHEN n=2 THEN 'f2200000-0000-0000-0000-000000000012'::uuid
 ELSE 'f2200000-0000-0000-0000-000000000011'::uuid END,
 now()-interval '10 days',now()-interval '9 days',
 CASE WHEN n=4 THEN now()+interval '1 day' ELSE now()-interval '8 days' END,'published'
  FROM generate_series(1,4) n;
SELECT pg_temp.fixture_publication_end();
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
 SELECT ('f2220000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2210000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,1,
 'Question '||n,'Analytics area','Theme '||n FROM generate_series(1,4) n;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
 SELECT ('f2230000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2220000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'A','Synthetic option',true
 FROM generate_series(1,4) n;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,
 effective_deadline,finished_at,score_percentage,total_correct,total_answered,is_within_window)
 SELECT ('f2240000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'f2200000-0000-0000-0000-000000000001',
 ('f2210000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'submitted','offline',now(),now()-interval '9 days'+n*interval '1 hour',
 50,1,1,n<>3 FROM generate_series(1,4) n;
-- Same exam, online/presencial: score, finish, immutable ID all exercised.
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,
 effective_deadline,finished_at,score_percentage,total_correct,total_answered,is_within_window)
 VALUES
 ('f2240000-0000-0000-0000-000000000005','f2200000-0000-0000-0000-000000000001','f2210000-0000-0000-0000-000000000001','expired','online',now(),now()-interval '9 days',80,1,1,true),
 ('f2240000-0000-0000-0000-000000000006','f2200000-0000-0000-0000-000000000001','f2210000-0000-0000-0000-000000000001','submitted','presencial',now(),now()-interval '8 days',80,1,1,true),
 ('f2240000-0000-0000-0000-000000000007','f2200000-0000-0000-0000-000000000002','f2210000-0000-0000-0000-000000000001','submitted','presencial',now(),now()-interval '9 days',80,1,1,true),
 ('f2240000-0000-0000-0000-000000000008','f2200000-0000-0000-0000-000000000003','f2210000-0000-0000-0000-000000000001','submitted','presencial',now(),now()-interval '9 days',70,1,1,true);
-- Historical fixtures only, not finalization/reprocessing. Insert online answers
-- would normally require an in-progress attempt; bypass only in this rollback.
ALTER TABLE public.answers DISABLE TRIGGER trg_enforce_answer_integrity;
INSERT INTO public.answers(attempt_id,question_id,selected_option_id,confidence,high_confidence)
 SELECT a.id,q.id,o.id,'alta',true FROM public.attempts a
 JOIN public.questions q ON q.simulado_id=a.simulado_id
 JOIN public.question_options o ON o.question_id=q.id
 WHERE a.id::text LIKE 'f2240000-%';
ALTER TABLE public.answers ENABLE TRIGGER trg_enforce_answer_integrity;
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered)
 SELECT a.id,q.id,a.simulado_id<>'f2210000-0000-0000-0000-000000000002'::uuid,true
 FROM public.attempts a JOIN public.questions q ON q.simulado_id=a.simulado_id
 WHERE a.id::text LIKE 'f2240000-%';
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,theme,
 reason,question_text,mastered_at)
 SELECT 'f2200000-0000-0000-0000-000000000001',simulado_id,id,'Analytics area',
 'Theme '||question_number,'confused_alternatives',text,now()-interval '9 days'+interval '90 minutes'
 FROM public.questions WHERE id::text LIKE 'f2220000-%';
-- Manual entries are cumulative only, including recurring confusion/samples.
INSERT INTO public.error_notebook(user_id,area,theme,reason,question_text)
 SELECT 'f2200000-0000-0000-0000-000000000001','Manual area','Manual theme',
 'confused_alternatives','Manual question' FROM generate_series(1,3);
-- Null/approximate old snapshots must not borrow today's profile. No backlog.
ALTER TABLE public.attempts DISABLE TRIGGER trg_attempt_edition_snapshot;
UPDATE public.attempts SET specialty_id_at_finish=NULL,target_institution_ids_at_finish=NULL,
 snapshot_backfilled=false WHERE id='f2240000-0000-0000-0000-000000000007';
UPDATE public.attempts SET snapshot_backfilled=true,target_institution_ids_at_finish=
 ARRAY['f2200000-0000-0000-0000-000000000024','f2200000-0000-0000-0000-000000000099',
 'f2200000-0000-0000-0000-000000000023']::uuid[]
 WHERE id='f2240000-0000-0000-0000-000000000008';
ALTER TABLE public.attempts ENABLE TRIGGER trg_attempt_edition_snapshot;
UPDATE public.onboarding_profiles SET specialty_id='f2200000-0000-0000-0000-000000000022',
 specialty='Not a snapshot',target_institution_ids=ARRAY['f2200000-0000-0000-0000-000000000023']::uuid[],
 target_institutions=ARRAY['Not a snapshot'] WHERE user_id::text LIKE 'f2200000-%';

SELECT set_config('request.jwt.claims','{"sub":"f2200000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE u uuid:=auth.uid(); e uuid:='f2200000-0000-0000-0000-000000000011';
 b uuid:='f2200000-0000-0000-0000-000000000012'; j jsonb; r record;
BEGIN
 j:=public.get_area_score_history(u,e);
 ASSERT jsonb_array_length(j->'global')=1,'edition series must select one best eligible exam';
 ASSERT j#>>'{global,0,attempt_id}'='f2240000-0000-0000-0000-000000000005','best attempt/ID tie';
 ASSERT j#>>'{by_area,Analytics area,0,attempt_id}'='f2240000-0000-0000-0000-000000000005';
 ASSERT jsonb_array_length(public.get_area_score_history(u,b)->'global')=1;
 ASSERT jsonb_array_length(public.get_area_score_history(u)->'global')=4,'legacy submitted-only cumulative history';
 ASSERT (SELECT count(*) FROM public.get_user_attempt_behavior_stats(u,e))=4;
 ASSERT (SELECT count(*) FROM public.get_user_attempt_behavior_stats(u,b))=1;
 ASSERT (SELECT count(*) FROM public.get_user_attempt_behavior_stats())=5;
 ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats(u,e)
  WHERE simulado_id IN ('f2210000-0000-0000-0000-000000000002','f2210000-0000-0000-0000-000000000004'));
 ASSERT public.get_confidence_calibration(u,e)#>>'{overall,total_answered_with_confidence}'='3',
  'calibration keeps original submitted policy, includes released training';
 ASSERT public.get_confidence_calibration(u,b)#>>'{overall,alta_but_wrong}'='1';
 ASSERT public.get_confidence_calibration(u)#>>'{overall,total_answered_with_confidence}'='4';
 j:=public.get_confidence_calibration(u,e);
 ASSERT jsonb_array_length(j->'buckets')=3;
 ASSERT j#>>'{buckets,0,total}'='0' AND j#>>'{buckets,1,total}'='0';
 ASSERT j#>>'{buckets,2,total}'='3' AND j#>>'{buckets,2,correct}'='3';
 ASSERT j#>>'{overall,alta_but_wrong}'='0' AND j#>>'{overall,baixa_but_correct}'='0';
 j:=public.get_caderno_pattern_data(u,e);
 ASSERT (j->>'total_entries')::int=2;
 ASSERT (j->>'total_mastered')::int=2;
 ASSERT j#>>'{area_cause_dist,0,cnt}'='2';
 ASSERT jsonb_array_length(j->'question_samples')=2;
 ASSERT j#>>'{overconf,0,high_conf_wrong}'='0';
 ASSERT jsonb_array_length(j->'recurring_confusion_candidates')=0;
 ASSERT jsonb_array_length(j->'roi_data')=1;
 ASSERT j#>>'{roi_data,0,score_before}'='1.00000000000000000000';
 ASSERT j#>>'{roi_data,0,score_after}'='1.00000000000000000000';
 j:=public.get_caderno_pattern_data(u,b);
 ASSERT (j->>'total_entries')::int=1;
 ASSERT j#>>'{overconf,0,high_conf_wrong}'='1';
 ASSERT jsonb_array_length(j->'roi_data')=0,'ROI cannot borrow before/after from A';
 ASSERT jsonb_array_length(j->'question_samples')=1;
 j:=public.get_caderno_pattern_data(u);
 ASSERT (j->>'total_entries')::int=6,'manual cumulative; unreleased excluded';
 ASSERT jsonb_array_length(j->'recurring_confusion_candidates')=2;
 ASSERT jsonb_array_length(j->'question_samples')=6;
 ASSERT (SELECT count(*) FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001'))=3;
 SELECT * INTO r FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001') WHERE user_id=u;
 ASSERT r.especialidade='Snapshot specialty' AND r.instituicoes_alvo=ARRAY['Snapshot II','Snapshot I'];
 ASSERT r.nota_final=80 AND r.finished_at=now()-interval '9 days' AND r.posicao=1 AND r.total_candidatos=3;
 SELECT * INTO r FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001')
 WHERE user_id='f2200000-0000-0000-0000-000000000002';
 ASSERT r.especialidade IS NULL AND r.instituicoes_alvo IS NULL AND r.posicao=2,'null must not fall back';
 SELECT * INTO r FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001')
 WHERE user_id='f2200000-0000-0000-0000-000000000003';
 ASSERT r.especialidade='Snapshot specialty' AND r.instituicoes_alvo=ARRAY['Snapshot II',NULL,'Snapshot I'],
  'backfill uses approximate frozen IDs; missing labels must keep array positions';
 ASSERT (SELECT especialidade='Current specialty' AND instituicoes_alvo=ARRAY['Snapshot I']
 FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000002'));
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000004'));
 FOR r IN SELECT unnest(ARRAY['get_area_score_history','get_confidence_calibration','get_caderno_pattern_data']) AS name LOOP
  BEGIN
   EXECUTE format('SELECT public.%I($1,$2)',r.name) USING 'f2200000-0000-0000-0000-000000000002'::uuid,e;
   RAISE EXCEPTION 'owner mismatch accepted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'forbidden%' THEN RAISE; END IF;
  END;
 END LOOP;
 ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats('f2200000-0000-0000-0000-000000000002',e));
 ASSERT public.get_area_score_history(u,'f2200000-0000-0000-0000-000000000099')
  ='{"by_area":{},"global":[]}'::jsonb;
 ASSERT public.get_caderno_pattern_data(u,'f2200000-0000-0000-0000-000000000099')->>'total_entries'='0';
 ASSERT public.get_confidence_calibration(u,'f2200000-0000-0000-0000-000000000099')
  #>>'{overall,total_answered_with_confidence}'='0';
 ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats(u,'f2200000-0000-0000-0000-000000000099'));
END $$;
RESET ROLE;
-- More than the 30-row sample cap, all newer and from the other edition.
INSERT INTO public.error_notebook(user_id,simulado_id,area,theme,reason,question_text,created_at)
 SELECT 'f2200000-0000-0000-0000-000000000001','f2210000-0000-0000-0000-000000000002',
 'B sample area','B sample theme','confused_alternatives','B-only sample',now()+n*interval '1 second'
 FROM generate_series(1,35) n;
UPDATE public.exam_editions SET status='archived' WHERE id='f2200000-0000-0000-0000-000000000011';
UPDATE public.attempts SET finished_at=now()-interval '9 days'
 WHERE id='f2240000-0000-0000-0000-000000000006';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.get_area_score_history(auth.uid(),'f2200000-0000-0000-0000-000000000011')
  #>>'{global,0,attempt_id}'='f2240000-0000-0000-0000-000000000005','immutable ID tie';
 ASSERT jsonb_array_length(public.get_caderno_pattern_data(auth.uid(),'f2200000-0000-0000-0000-000000000011')
  ->'question_samples')=2,'edition filter must precede LIMIT 30';
 ASSERT jsonb_array_length(public.get_caderno_pattern_data(auth.uid())->'question_samples')=30;
 ASSERT (SELECT especialidade='Snapshot specialty' AND instituicoes_alvo=ARRAY['Snapshot II','Snapshot I']
  FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001') WHERE user_id=auth.uid()),'archived snapshot';
END $$;
RESET ROLE;
-- Publication gate, independently from the result-release date.
UPDATE public.simulados SET status='draft' WHERE id='f2210000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000002'));
 ASSERT public.get_confidence_calibration(auth.uid(),'f2200000-0000-0000-0000-000000000012')#>>'{overall,total_answered_with_confidence}'='0';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT unnest(ARRAY['get_area_score_history','get_confidence_calibration','get_caderno_pattern_data']) AS name LOOP
  BEGIN
   EXECUTE format('SELECT public.%I($1)',r.name) USING 'f2200000-0000-0000-0000-000000000001'::uuid;
   RAISE EXCEPTION 'anonymous accepted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'not_authenticated' THEN RAISE; END IF;
  END;
 END LOOP;
 ASSERT NOT EXISTS(SELECT FROM public.get_user_attempt_behavior_stats());
 ASSERT NOT EXISTS(SELECT FROM public.get_ranking_for_simulado('f2210000-0000-0000-0000-000000000001'));
 FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
 ('get_area_score_history','get_caderno_pattern_data','get_confidence_calibration','get_user_attempt_behavior_stats','get_ranking_for_simulado') LOOP
  ASSERT NOT has_function_privilege('anon',r.oid,'EXECUTE');
 END LOOP;
 ASSERT NOT has_schema_privilege('authenticated','analytics_scope_private','USAGE');
 ASSERT NOT has_table_privilege('authenticated','analytics_scope_private.original_functions','SELECT');
 ASSERT NOT has_function_privilege('authenticated','analytics_scope_private.rollback_analytics_scope()','EXECUTE');
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT unnest(ARRAY['get_area_score_history','get_confidence_calibration','get_caderno_pattern_data',
  'get_user_attempt_behavior_stats','get_ranking_for_simulado']) AS name LOOP
  BEGIN
   EXECUTE format('SELECT public.%I($1)',r.name) USING 'f2200000-0000-0000-0000-000000000001'::uuid;
   RAISE EXCEPTION 'anon EXECUTE unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
 END LOOP;
END $$;
RESET ROLE;
-- Reapply with populated synthetic records: no attempts, scores, notebook or
-- preferences are rewritten. Only hashes/counts stay in these private temps.
CREATE TEMP TABLE analytics_data_before AS
 SELECT 'attempts' AS source,md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]')::text) AS digest
 FROM public.attempts a WHERE a.id::text LIKE 'f2240000-%'
 UNION ALL SELECT 'notebook',md5(coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]')::text)
 FROM public.error_notebook n WHERE n.user_id::text LIKE 'f2200000-%'
 UNION ALL SELECT 'onboarding',md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.user_id),'[]')::text)
 FROM public.onboarding_profiles o WHERE o.user_id::text LIKE 'f2200000-%';
\ir ../migrations/20261104092049_fase2_analytics_scope.sql
DO $$ BEGIN
 ASSERT (SELECT digest FROM analytics_data_before WHERE source='attempts')=
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]')::text)
   FROM public.attempts a WHERE a.id::text LIKE 'f2240000-%');
 ASSERT (SELECT digest FROM analytics_data_before WHERE source='notebook')=
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]')::text)
   FROM public.error_notebook n WHERE n.user_id::text LIKE 'f2200000-%');
 ASSERT (SELECT digest FROM analytics_data_before WHERE source='onboarding')=
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.user_id),'[]')::text)
   FROM public.onboarding_profiles o WHERE o.user_id::text LIKE 'f2200000-%');
END $$;
ROLLBACK;
-- Reapply and rollback inside a transaction: even test DDL leaves no changes.
BEGIN;
CREATE TEMP TABLE analytics_checkpoint AS TABLE analytics_scope_private.original_functions;
-- An intentional post-apply source edit must survive a repeated migration.
DO $$ DECLARE ddl text; BEGIN
 ddl:=pg_get_functiondef('public.get_user_attempt_behavior_stats(uuid,uuid)'::regprocedure);
 ASSERT position('ORDER BY s.started_at;' IN ddl)>0;
 EXECUTE replace(ddl,'ORDER BY s.started_at;','ORDER BY s.started_at /* post-apply edit */;');
END $$;
CREATE TEMP TABLE analytics_definitions AS
 SELECT p.proname,pg_get_functiondef(p.oid) AS definition,pg_get_userbyid(p.proowner) AS owner_name,p.proacl
 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN
 ('get_area_score_history','get_caderno_pattern_data','get_confidence_calibration','get_user_attempt_behavior_stats','get_ranking_for_simulado');
\ir ../migrations/20261104092049_fase2_analytics_scope.sql
DO $$ BEGIN
 ASSERT NOT EXISTS((TABLE analytics_checkpoint EXCEPT TABLE analytics_scope_private.original_functions)
 UNION ALL (TABLE analytics_scope_private.original_functions EXCEPT TABLE analytics_checkpoint));
 ASSERT NOT EXISTS(SELECT FROM analytics_definitions d JOIN pg_proc p ON p.proname=d.proname
  AND p.pronamespace='public'::regnamespace WHERE pg_get_functiondef(p.oid)<>d.definition
  OR pg_get_userbyid(p.proowner)<>d.owner_name OR p.proacl IS DISTINCT FROM d.proacl),
  'reapply must not overwrite source edits, owners or ACL';
END $$;
SELECT analytics_scope_private.rollback_analytics_scope();
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM analytics_scope_private.original_functions LOOP
  ASSERT pg_get_functiondef(to_regprocedure('public.'||r.name||'(uuid)'))=r.definition,'definition restored';
  ASSERT (SELECT pg_get_userbyid(proowner)=r.owner_name FROM pg_proc
   WHERE oid=to_regprocedure('public.'||r.name||'(uuid)')),'owner restored';
  ASSERT NOT EXISTS(
   (SELECT x->>'grantee',(x->>'grantable')::boolean FROM jsonb_array_elements(r.acl) x
    EXCEPT SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.is_grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=to_regprocedure('public.'||r.name||'(uuid)'))
   UNION ALL
   (SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.is_grantable
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=to_regprocedure('public.'||r.name||'(uuid)')
    EXCEPT SELECT x->>'grantee',(x->>'grantable')::boolean FROM jsonb_array_elements(r.acl) x)
  ),'ACL restored exactly';
 END LOOP;
 ASSERT to_regprocedure('public.get_area_score_history(uuid,uuid)') IS NULL;
END $$;
\ir ../migrations/20261104092049_fase2_analytics_scope.sql
DO $$ BEGIN
 ASSERT to_regprocedure('public.get_area_score_history(uuid)') IS NULL;
 ASSERT to_regprocedure('public.get_area_score_history(uuid,uuid)') IS NOT NULL;
END $$;
ROLLBACK;
\echo 'PASS: analytics scope, ownership, release, snapshots, ACL, rollback/reapply'
