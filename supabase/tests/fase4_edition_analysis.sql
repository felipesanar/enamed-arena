\set ON_ERROR_STOP on
SELECT 1/((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
 AND current_database() LIKE 'enamed_test_edition_analysis_%' AND session_user='postgres')::int);
BEGIN;
CREATE FUNCTION pg_temp.check_true(value boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION pg_temp.uid(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('fd100000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid $$;
SELECT pg_temp.check_true(to_regprocedure('public.get_my_percentile_history(uuid)') IS NOT NULL,'RPC exists (TDD)');
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT pg_temp.uid(n),'edition-analysis-'||n||'@example.invalid'
 FROM generate_series(1,1506) n;
UPDATE public.profiles SET full_name='Fictional student '||right(id::text,4);
INSERT INTO public.user_roles(user_id,role) VALUES (pg_temp.uid(1505),'content_editor'),(pg_temp.uid(1506),'admin');
INSERT INTO public.role_capabilities(role,capability) VALUES ('content_editor','content.manage') ON CONFLICT DO NOTHING;
DELETE FROM public.role_capabilities WHERE role='content_editor' AND capability='intel.view';
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1506),'role','authenticated')::text,true);
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 (pg_temp.uid(2001),'2194.1',2194,1,'Analysis A','closed'),
 (pg_temp.uid(2002),'2194.2',2194,2,'Analysis B','archived');
-- Analysis fixtures are not authoring fixtures; no question banks are created.
ALTER TABLE public.simulados DISABLE TRIGGER trg_admin_publication;
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,status,
 execution_window_start,execution_window_end,results_release_at)
 SELECT pg_temp.uid(2100+n),'Analysis '||n,'analysis-'||n,
 CASE WHEN n IN(3,4) THEN n-2 ELSE n END,
 CASE WHEN n IN(3,4) THEN pg_temp.uid(2002) ELSE pg_temp.uid(2001) END,
 CASE WHEN n=4 THEN 'archived'::public.simulado_status ELSE 'published'::public.simulado_status END,
 now()-interval '10 days',now()-interval '9 days',
 CASE WHEN n=5 THEN now()+interval '1 day' ELSE now()-interval '8 days'+n*interval '1 hour' END
 FROM generate_series(1,5) n;
ALTER TABLE public.simulados ENABLE TRIGGER trg_admin_publication;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,effective_deadline,
 finished_at,score_percentage,is_within_window)
 SELECT pg_temp.uid(10000+n),pg_temp.uid(n),pg_temp.uid(2101),'submitted','online',now(),
 now()-interval '9 days',80,true FROM generate_series(1,1501) n;
INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,effective_deadline,
 finished_at,score_percentage,is_within_window) VALUES
 (pg_temp.uid(12001),pg_temp.uid(1),pg_temp.uid(2101),'expired','presencial',now(),now()-interval '8 days',80,true),
 (pg_temp.uid(12002),pg_temp.uid(1),pg_temp.uid(2102),'submitted','online',now(),now()-interval '9 days',60,true),
 (pg_temp.uid(12003),pg_temp.uid(1),pg_temp.uid(2102),'submitted','offline',now(),now()-interval '8 days',90,true),
 (pg_temp.uid(12004),pg_temp.uid(2),pg_temp.uid(2102),'expired','online',now(),now()-interval '9 days',70,true),
 (pg_temp.uid(12005),pg_temp.uid(1),pg_temp.uid(2103),'submitted','online',now(),now()-interval '9 days',20,true),
 (pg_temp.uid(12006),pg_temp.uid(1),pg_temp.uid(2104),'submitted','online',now(),now()-interval '9 days',30,true),
 (pg_temp.uid(12007),pg_temp.uid(1),pg_temp.uid(2105),'submitted','online',now(),now()-interval '9 days',100,true),
 (pg_temp.uid(12008),pg_temp.uid(1502),pg_temp.uid(2101),'submitted','online',now(),now()-interval '9 days',100,false),
 (pg_temp.uid(12009),pg_temp.uid(1503),pg_temp.uid(2101),'offline_pending','offline',now(),NULL,NULL,true),
 (pg_temp.uid(12010),pg_temp.uid(1504),pg_temp.uid(2101),'in_progress','online',now(),NULL,NULL,true);
CREATE TEMP TABLE operational_before AS SELECT
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a) attempts,
 (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.simulados s) simulados,
 (SELECT pg_get_functiondef('public.get_ranking_for_simulado(uuid)'::regprocedure)) canonical_ranking;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(jsonb_array_length(public.get_my_percentile_history()->'items')=4,'all editions released own history, archived included');
SELECT pg_temp.check_true(jsonb_array_length(public.get_my_percentile_history(pg_temp.uid(2001))->'items')=2,'edition filtered before aggregate');
SELECT pg_temp.check_true((public.get_my_percentile_history(pg_temp.uid(2001))#>>'{items,0,position}')::bigint=
 (SELECT posicao FROM public.get_ranking_for_simulado(pg_temp.uid(2101)) WHERE user_id=auth.uid()),'ties match existing ranking position');
SELECT pg_temp.check_true((public.get_my_percentile_history(pg_temp.uid(2001))#>>'{items,0,population}')::bigint=1501,'population excludes training and pending, dedup modalities');
SELECT pg_temp.check_true((public.get_my_percentile_history(pg_temp.uid(2001))#>>'{items,0,top_percentile}')::int=1,'ceil clamped to one');
SELECT pg_temp.check_true((public.get_my_percentile_history()->'items'->2->>'sequence')::int=1
 AND (public.get_my_percentile_history()->'items'->2->>'edition_id')=pg_temp.uid(2002)::text,'release order does not mix edition sequences');
SELECT pg_temp.check_true((public.get_my_percentile_history(pg_temp.uid(2002))#>>'{items,0,metadata,small_sample}')::boolean,'small sample warning metadata');
SELECT pg_temp.check_true((public.get_my_percentile_history(pg_temp.uid(2002))#>>'{items,0,top_percentile}')::int=99,'one participant clamps to 99, not proficiency');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM jsonb_array_elements(public.get_my_percentile_history()->'items') x
 WHERE x ?| ARRAY['score_percentage','nota_final','average_score','user_id']),'longitudinal has no raw scores or other identities');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))->>'status')='unconfigured','missing policy closed');
DO $$ BEGIN
 PERFORM public.get_edition_ranking(pg_temp.uid(9999)); RAISE EXCEPTION 'unknown edition accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),2,1,true,'forbidden'); RAISE EXCEPTION 'student configured';
 EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1505),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),2,1,true,'only content'); RAISE EXCEPTION 'one capability accepted';
 EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END $$;
RESET ROLE;
DELETE FROM public.role_capabilities WHERE role='content_editor' AND capability='content.manage';
INSERT INTO public.role_capabilities(role,capability) VALUES('content_editor','intel.view');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),2,1,true,'only intel'); RAISE EXCEPTION 'intel-only capability accepted';
 EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END $$;
RESET ROLE;
DELETE FROM public.role_capabilities WHERE role='content_editor' AND capability='intel.view';
INSERT INTO public.role_capabilities(role,capability) VALUES('content_editor','content.manage');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1506),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),2,1,true,'  '); RAISE EXCEPTION 'empty reason accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),0,1,true,'invalid'); RAISE EXCEPTION 'zero N accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),1,2,true,'invalid'); RAISE EXCEPTION 'minimum above N accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(9999),1,1,true,'unknown'); RAISE EXCEPTION 'unknown configured';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),3,3,true,'future'); RAISE EXCEPTION 'unoffered minimum enabled';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2001),5000,3,false,'future N, no official policy');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))->>'status')='unconfigured','disabled future N no students');
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2001),1,1,true,'fixture best one');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001),2,0)->>'population')::int=1501,'rank all before page, no 1000 cap');
SELECT pg_temp.check_true(jsonb_array_length(public.get_edition_ranking(pg_temp.uid(2001),50,1500)->'items')=1,'1501st participant reachable');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001),50,1500)#>>'{items,0,position}')::int=1501,'pagination keeps global position');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001),2,0)#>>'{items,1,user_id}')=pg_temp.uid(2)::text,'edition ties deterministic by finish and user UUID');
SELECT pg_temp.check_true(jsonb_array_length(public.get_edition_ranking(pg_temp.uid(2001),50,9999)->'items')=0
 AND (public.get_edition_ranking(pg_temp.uid(2001),50,9999)->>'population')::int=1501,'empty page retains real population');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001),2,0)#>>'{items,0,average_score}')::numeric=90,'offline best dedup before best N');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001),2,0)#>>'{items,0,used_simulados}')::int=1,'used count explicit');
EXPLAIN (COSTS OFF) SELECT public.get_edition_ranking(pg_temp.uid(2001),50,0);
SELECT pg_temp.check_true(NOT ((public.get_edition_ranking(pg_temp.uid(2001),2,0)->'items'->0) ?| ARRAY['email','specialty','institutions','segment']),'minimal privacy payload');
DO $$ BEGIN PERFORM public.get_edition_ranking(pg_temp.uid(2001),0,-1); RAISE EXCEPTION 'bad page accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1506),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2001),2,2,true,'fixture minimum two');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))->>'population')::int=2,'minimum excludes single participation');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))#>>'{items,0,average_score}')::numeric=85,'same edition average only');
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2001),5,1,true,'partial best N explicit');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))#>>'{items,0,used_simulados}')::int=2,'minimum below best N labels actual count');
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2002),2,1,true,'archived visibility fixture');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2002))->>'offered_simulados')::int=1,'nonowner cannot inspect archived population');
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2001),5,1,false,'rollback disable keeps configuration');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2001))->>'status')='unconfigured','enabled policy can be disabled without student data');
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=6 FROM public.admin_audit_log WHERE entity_type='exam_edition_ranking_policies'
 AND metadata ?& ARRAY['before','after','reason']),'successful configuration audited with diff and reason');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.exam_edition_ranking_policies),'failed calls left no policy writes');
CREATE TEMP TABLE audit_failure_before AS SELECT
 (SELECT to_jsonb(p) FROM public.exam_edition_ranking_policies p WHERE edition_id=pg_temp.uid(2001)) policy,
 (SELECT count(*) FROM public.admin_audit_log) audit_count;
CREATE FUNCTION pg_temp.reject_analysis_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.entity_type='exam_edition_ranking_policies' AND NEW.metadata->>'reason'='forced audit failure' THEN
  RAISE EXCEPTION 'fixture audit unavailable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER analysis_audit_failure BEFORE INSERT ON public.admin_audit_log
 FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_analysis_audit();
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1506),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),99,1,true,'forced audit failure');
 RAISE EXCEPTION 'audit failure accepted'; EXCEPTION WHEN check_violation THEN NULL; END $$;
RESET ROLE;
DROP TRIGGER analysis_audit_failure ON public.admin_audit_log;
SELECT pg_temp.check_true((SELECT policy=(SELECT to_jsonb(p) FROM public.exam_edition_ranking_policies p WHERE edition_id=pg_temp.uid(2001))
 AND audit_count=(SELECT count(*) FROM public.admin_audit_log) FROM audit_failure_before),'audit failure atomically rolls back policy and actor/time');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1506),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.admin_configure_edition_ranking(pg_temp.uid(2002),2,2,true,'require both offered simulados');
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2002))->>'status')='insufficient_offered'
 AND jsonb_array_length(public.get_edition_ranking(pg_temp.uid(2002))->'items')=0,'archived nonowner cannot fill minimum using hidden results');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((public.get_edition_ranking(pg_temp.uid(2002))->>'population')::int=1
 AND (public.get_edition_ranking(pg_temp.uid(2002))#>>'{items,0,average_score}')::numeric=25,'archived owner reads both same-edition results');
RESET ROLE;

INSERT INTO public.enamed_institutions(id,name,uf,slug) VALUES(pg_temp.uid(3001),'Analysis institution','SP','analysis-institution');
INSERT INTO public.enamed_specialties(id,name,slug) VALUES(pg_temp.uid(3002),'Analysis specialty','analysis-specialty');
ALTER TABLE public.enamed_cutoff_scores DISABLE TRIGGER cutoff_require_reference;
INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,practice_scenario,cutoff_score_general)
 VALUES(pg_temp.uid(3001),pg_temp.uid(3002),'Analysis institution','Analysis specialty',' Hospital A ',99);
ALTER TABLE public.enamed_cutoff_scores ENABLE TRIGGER cutoff_require_reference;
INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,practice_scenario,
 cutoff_score_general,cutoff_score_quota,reference_edition_id,source) VALUES
 (pg_temp.uid(3001),pg_temp.uid(3002),'Analysis institution','Analysis specialty','Hospital A',80,70,pg_temp.uid(2001),'Process A official table'),
 (pg_temp.uid(3001),pg_temp.uid(3002),'Analysis institution','Analysis specialty','hospital a',600,NULL,pg_temp.uid(2002),'Process B different scale');
INSERT INTO public.enamed_programs(institution_id,specialty_id,cenario_pratica,vagas,reference_edition_id,source)
 VALUES(pg_temp.uid(3001),pg_temp.uid(3002),' hospital A ',4,pg_temp.uid(2001),'Process A official table');
DO $$ BEGIN
 INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,reference_edition_id,source)
 VALUES(pg_temp.uid(3001),pg_temp.uid(3002),'A','B',pg_temp.uid(2001),NULL);
 RAISE EXCEPTION 'null source accepted'; EXCEPTION WHEN check_violation THEN NULL; END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(jsonb_array_length(public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002),' HOSPITAL A ')->'items')=2,'normalized filter retains different processes separately');
SELECT pg_temp.check_true((public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002))->>'legacy_unknown_count')::int=1,'legacy counted outside comparable items');
SELECT pg_temp.check_true((public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002))#>>'{items,0,vagas}')::int=4,'vagas matched by reference source and normalized scenario');
SELECT pg_temp.check_true((public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002))#>>'{items,1,vagas}') IS NULL,'no invented vagas across process');
SELECT pg_temp.check_true(NOT (public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002))->>'trend_comparable')::boolean,'uncertified scales never comparable');
SELECT pg_temp.check_true(jsonb_array_length(public.get_cutoff_score_history(pg_temp.uid(3999),pg_temp.uid(3002))->'items')=0,'unknown source empty, no sourcing request');
SELECT pg_temp.check_true(jsonb_array_length(public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002),'hospital z')->'items')=0
 AND (public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002),'hospital z')->>'legacy_unknown_count')::int=0,'scenario filter also excludes unrelated legacy');
SELECT pg_temp.check_true(NOT EXISTS(SELECT FROM jsonb_array_elements(public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002))->'items') x
 WHERE nullif(btrim(x->>'source'),'') IS NULL OR x->>'reference_edition_id' IS NULL OR x->>'source_version' IS NOT NULL
 OR (x->>'trend_comparable')::boolean),'only explicit source references, unknown versions and uncertified trends');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(1501),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(jsonb_array_length(public.get_my_percentile_history()->'items')=1,'other caller cannot get owner history');
SELECT pg_temp.check_true((public.get_my_percentile_history()#>>'{items,0,position}')::int=1501,'last position tie ordered by user ID');
SELECT pg_temp.check_true((public.get_my_percentile_history()#>>'{items,0,top_percentile}')::int=99,'bottom clamp');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(16),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((public.get_my_percentile_history()#>>'{items,0,top_percentile}')::int=2,'nonintegral percentile uses ceil, not round or floor');
DO $$ BEGIN PERFORM public.get_my_percentile_history(pg_temp.uid(9999)); RAISE EXCEPTION 'unknown history edition accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
DO $$ BEGIN PERFORM public.get_cutoff_score_history(NULL,pg_temp.uid(3002)); RAISE EXCEPTION 'null canonical cutoff ID accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM public.get_my_percentile_history(); RAISE EXCEPTION 'null caller accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END $$;
DO $$ BEGIN PERFORM public.get_edition_ranking(pg_temp.uid(2001)); RAISE EXCEPTION 'null ranking caller accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END $$;
DO $$ BEGIN PERFORM public.get_cutoff_score_history(pg_temp.uid(3001),pg_temp.uid(3002)); RAISE EXCEPTION 'null cutoff caller accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END $$;
DO $$ BEGIN PERFORM public.admin_configure_edition_ranking(pg_temp.uid(2001),1,1,false,'null caller'); RAISE EXCEPTION 'null config caller accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN PERFORM public.get_my_percentile_history(); RAISE EXCEPTION 'anon executed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RESET ROLE;
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.get_my_percentile_history(uuid)','EXECUTE')
 AND NOT has_function_privilege('anon','public.get_edition_ranking(uuid,integer,integer)','EXECUTE')
 AND NOT has_function_privilege('anon','public.get_cutoff_score_history(uuid,uuid,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text)','EXECUTE'),'anon ACLs revoked on all RPCs');
SELECT pg_temp.check_true(NOT has_table_privilege('authenticated','public.exam_edition_ranking_policies','UPDATE')
 AND NOT has_table_privilege('authenticated','public.exam_edition_ranking_policies','SELECT'),'configuration has no direct client access');
SELECT pg_temp.check_true((SELECT relrowsecurity FROM pg_class WHERE oid='public.exam_edition_ranking_policies'::regclass),'configuration RLS enabled');
SELECT pg_temp.check_true(NOT has_function_privilege('service_role','public.get_my_percentile_history(uuid)','EXECUTE')
 AND NOT has_function_privilege('service_role','public.get_edition_ranking(uuid,integer,integer)','EXECUTE')
 AND NOT has_function_privilege('service_role','public.get_cutoff_score_history(uuid,uuid,text)','EXECUTE')
 AND NOT has_function_privilege('service_role','public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text)','EXECUTE')
 AND NOT has_table_privilege('service_role','public.exam_edition_ranking_policies','UPDATE'),'default service role grants do not broaden RPC-only contract');

CREATE TEMP TABLE config_before AS SELECT
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY edition_id) FROM public.exam_edition_ranking_policies p) policies,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.admin_audit_log a) audit;
SAVEPOINT before_reapply;
\ir ../migrations/20261104120005_fase4_edition_analysis.sql
SELECT pg_temp.check_true((SELECT policies=(SELECT jsonb_agg(to_jsonb(p) ORDER BY edition_id)
 FROM public.exam_edition_ranking_policies p) AND audit=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id)
 FROM public.admin_audit_log a) FROM config_before),'reapply preserves config and audit byte-for-byte');
ROLLBACK TO SAVEPOINT before_reapply;
-- Exercise only the documented non-destructive rollback inside this fixture.
UPDATE public.exam_edition_ranking_policies SET enabled=false;
DROP FUNCTION public.get_my_percentile_history(uuid);
DROP FUNCTION public.get_edition_ranking(uuid,integer,integer);
DROP FUNCTION public.get_cutoff_score_history(uuid,uuid,text);
DROP FUNCTION public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text);
SELECT pg_temp.check_true((SELECT count(*)=2 AND bool_and(NOT enabled) FROM public.exam_edition_ranking_policies)
 AND (SELECT audit=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.admin_audit_log a) FROM config_before),
 'manual rollback preserves disabled config and full audit');
\ir ../migrations/20261104120005_fase4_edition_analysis.sql
SELECT pg_temp.check_true(to_regprocedure('public.get_my_percentile_history(uuid)') IS NOT NULL
 AND (SELECT bool_and(NOT enabled) FROM public.exam_edition_ranking_policies),'reapply restores RPCs without enabling policies');
SELECT pg_temp.check_true((SELECT attempts=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a)
 AND simulados=(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.simulados s)
 AND canonical_ranking=pg_get_functiondef('public.get_ranking_for_simulado(uuid)'::regprocedure)
 FROM operational_before),'operational results metadata and canonical ranking untouched');
ROLLBACK;
