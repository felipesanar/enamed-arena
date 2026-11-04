\set ON_ERROR_STOP on
-- Run only against the disposable clone; every fixture, trigger and reapply rolls back.
BEGIN;
DO $$ BEGIN
 IF inet_server_addr() <> '127.0.0.1'::inet OR inet_server_port() <> 54737
 OR current_database() !~ '^enamed_test_(cutoff|fixtures_integrated)_[a-z0-9_]+$' OR session_user <> 'postgres' OR current_user <> 'postgres' THEN
 RAISE EXCEPTION 'Unsafe test connection'; END IF;
END $$;
CREATE FUNCTION pg_temp.check_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT: %',message; END IF;
RAISE NOTICE 'PASS: %',message; END $$;
SELECT pg_temp.check_true(to_regprocedure('public.admin_import_cutoffs(uuid,text,jsonb)') IS NOT NULL,'import RPC exists');

CREATE TEMP TABLE cutoff_fixture AS
SELECT '61000000-0000-0000-0000-000000000001'::uuid u,
 '61000000-0000-0000-0000-000000000002'::uuid student,
 '61000000-0000-0000-0000-000000000003'::uuid i,
 '61000000-0000-0000-0000-000000000004'::uuid s,
 '61000000-0000-0000-0000-000000000005'::uuid a,
 '61000000-0000-0000-0000-000000000006'::uuid b;
-- Avoid auth provisioning/email/integration triggers in this local-only fixture.
ALTER TABLE auth.users DISABLE TRIGGER USER;
INSERT INTO auth.users(id,email) SELECT u,'cutoff-editor@test.invalid' FROM cutoff_fixture
UNION ALL SELECT student,'cutoff-student@test.invalid' FROM cutoff_fixture;
ALTER TABLE auth.users ENABLE TRIGGER USER;
INSERT INTO public.user_roles(user_id,role) SELECT u,'content_editor' FROM cutoff_fixture;
INSERT INTO public.enamed_institutions(id,name,slug,uf) SELECT i,'Cutoff Fixture','cutoff-fixture','SP' FROM cutoff_fixture;
INSERT INTO public.enamed_specialties(id,name,slug) SELECT s,'Cutoff Specialty','cutoff-specialty' FROM cutoff_fixture;
INSERT INTO public.exam_editions(id,code,year,term,label,status,cutoff_reference_label)
SELECT a,'2098.1',2098,1,'Fixture A','preparing'::public.exam_edition_status,'Reference A' FROM cutoff_fixture
UNION ALL SELECT b,'2099.2',2099,2,'Fixture B','active'::public.exam_edition_status,'Reference B' FROM cutoff_fixture;
INSERT INTO public.onboarding_profiles(user_id,specialty,target_institutions,specialty_id,target_institution_ids,status)
SELECT student,'Different display name',ARRAY['Different institution'],s,ARRAY[i],'completed' FROM cutoff_fixture;
-- Simulate rows that existed BEFORE expansion, not a permitted new write.
SET LOCAL session_replication_role=replica;
INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,practice_scenario,cutoff_score_general)
SELECT i,s,'Cutoff Fixture','Cutoff Specialty','legacy',x FROM cutoff_fixture CROSS JOIN (VALUES (60),(70)) v(x);
INSERT INTO public.enamed_programs(institution_id,specialty_id,cenario_pratica,vagas)
SELECT i,s,' Legacy Text ',1 FROM cutoff_fixture;
SET LOCAL session_replication_role=origin;
CREATE TEMP TABLE legacy_snapshot AS SELECT id,reference_edition_id,source FROM public.enamed_cutoff_scores WHERE reference_edition_id IS NULL;
CREATE TEMP TABLE legacy_program_snapshot AS SELECT * FROM public.enamed_programs WHERE reference_edition_id IS NULL;
CREATE TEMP TABLE original_snapshot AS SELECT * FROM cutoff_private.original_functions;
CREATE TEMP TABLE cutoff_requests AS SELECT f.*,
 jsonb_build_array(jsonb_build_object('institution_id',i,'specialty_id',s,'practice_scenario','Hospital A','cutoff_score_general',80,'vagas',2),
 jsonb_build_object('institution_id',i,'specialty_id',s,'practice_scenario','Hospital B','cutoff_score_general',81)) rows FROM cutoff_fixture f;
SELECT set_config('request.jwt.claim.sub',u::text,true) FROM cutoff_fixture;
SET LOCAL ROLE authenticated;
RESET ROLE;
GRANT SELECT ON cutoff_fixture,cutoff_requests TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(public.has_capability('content.manage'),'real content_editor capability');
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Fixture source A',rows)->>'imported')::int=2,'editor imports two scenarios') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(b,'Fixture source B',jsonb_set(jsonb_set(rows,'{0,cutoff_score_general}','90'),'{1,cutoff_score_general}','91'))->>'imported')::int=2,'second reference same canonical IDs') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Duplicate',rows)->>'ok')::boolean=false,'DB duplicates rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Duplicate',jsonb_build_array(rows->0,rows->0))->>'ok')::boolean=false,'request duplicates rejected') FROM cutoff_requests;
SELECT pg_temp.check_true(public.get_user_cutoff_context()->>'reason'='no_onboarding','no onboarding reason preserved');
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'  ',rows)->'errors'->0->>'field')='source','blank source per-field error') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs('61000000-0000-0000-0000-000000000099','Unknown',rows)->'errors'->0->>'field')='reference_edition_id','unknown reference rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Bad',jsonb_set(rows,'{0,cutoff_score_general}','"NaN"'))->'errors'->0->>'field')='cutoff_score_general','NaN rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Bad',jsonb_set(rows,'{0,cutoff_score_quota}','"Infinity"'))->'errors'->0->>'field')='cutoff_score_quota','infinite quota rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Bad',jsonb_set(rows,'{0,vagas}','1.5'))->'errors'->0->>'field')='vagas','fractional seats rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Bad',jsonb_build_array(jsonb_set(rows->0,'{practice_scenario}','" same "'),jsonb_set(rows->1,'{practice_scenario}','"SAME"')))->>'ok')::boolean=false,'normalized program request duplicates rejected') FROM cutoff_requests;
SELECT pg_temp.check_true((SELECT count(*)=2 AND min(cutoff_score_general)=80 AND max(cutoff_score_general)=81 AND bool_and(source='Fixture source A' AND reference_label='Reference A') FROM public.get_cutoff_scores(s,ARRAY[i],a)),'explicit A all scenarios isolated') FROM cutoff_fixture;
SELECT pg_temp.check_true((SELECT count(*)=2 AND min(cutoff_score_general)=90 FROM public.get_cutoff_scores(s,ARRAY[i],b)),'explicit B isolated') FROM cutoff_fixture;
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=2 AND bool_and(actor_id=u AND metadata->'before'='[]'::jsonb AND jsonb_array_length(metadata->'after')=2) FROM public.admin_audit_log WHERE entity_id IN(a,b) AND action='IMPORT'),'real audit identity and diff') FROM cutoff_fixture;
SELECT pg_temp.check_true((SELECT count(*)=4 AND count(DISTINCT source)=2 FROM public.enamed_programs WHERE reference_edition_id IN(a,b)),'programs isolated by same two references') FROM cutoff_fixture;
DO $$ DECLARE f record; BEGIN
 SELECT * INTO f FROM cutoff_fixture;
 BEGIN
 INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,practice_scenario,cutoff_score_general,reference_edition_id,source)
 VALUES(f.i,f.s,'Cutoff Fixture','Cutoff Specialty','Hospital A',99,f.a,'Duplicate');
 RAISE EXCEPTION 'unique key missing'; EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM pg_temp.check_true(true,'database same scenario reference unique');
 BEGIN
 INSERT INTO public.enamed_programs(institution_id,specialty_id,cenario_pratica,reference_edition_id,source)
 VALUES(f.i,f.s,' hospital a ',f.a,'Duplicate');
 RAISE EXCEPTION 'program unique key missing'; EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM pg_temp.check_true(true,'database normalized program key unique');
 BEGIN
 INSERT INTO public.enamed_programs(institution_id,specialty_id,cenario_pratica) VALUES(f.i,f.s,'New unknown');
 RAISE EXCEPTION 'new unknown source accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM pg_temp.check_true(true,'new rows cannot hide as legacy');
END $$;
UPDATE public.app_config SET value='false' WHERE key='editions_ui';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=1 AND max(cutoff_score_general)=70 FROM public.get_cutoff_scores(s,ARRAY[i])),'flag false keeps legacy maximum, not new scores') FROM cutoff_fixture;
RESET ROLE;
UPDATE public.app_config SET value='true' WHERE key='editions_ui';
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=2 AND min(cutoff_score_general)=80 FROM public.get_cutoff_scores(s,ARRAY[i])),'preparing before active, catalog not clock') FROM cutoff_fixture;
RESET ROLE;
UPDATE public.exam_editions SET cutoff_reference_label=NULL WHERE id=(SELECT a FROM cutoff_fixture);
SELECT set_config('request.jwt.claim.sub',student::text,true) FROM cutoff_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.get_cutoff_scores(s,ARRAY[i])),'unknown current reference never reuses legacy') FROM cutoff_fixture;
SELECT pg_temp.check_true(public.get_user_cutoff_context()->>'reference_reason'='unknown_reference' AND public.get_user_cutoff_context()->'matches'='[]'::jsonb,'unknown reference context explains empty data');
RESET ROLE;
UPDATE public.exam_editions SET cutoff_reference_label='Reference A' WHERE id=(SELECT a FROM cutoff_fixture);
-- A known label with no imported data cannot borrow the other reference.
SET LOCAL session_replication_role=replica;
INSERT INTO public.exam_editions(code,year,term,label,status,cutoff_reference_label) VALUES('2097.1',2097,1,'No imported data','preparing','Empty reference');
SET LOCAL session_replication_role=origin;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.get_cutoff_scores(s,ARRAY[i])),'current label without imported data never crosses references') FROM cutoff_fixture;
SELECT pg_temp.check_true(public.get_user_cutoff_context()->>'reason'='no_match','known empty reference preserves no_match reason');
RESET ROLE;
DELETE FROM public.exam_editions WHERE code='2097.1';
-- A catalog tie is not resolved with UUID, wall clock or a guessed reference.
INSERT INTO public.exam_editions(code,year,term,label,status,cutoff_reference_label) VALUES('2098.2',2098,1,'Ambiguous','preparing','Other');
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(public.get_user_cutoff_context()->>'reference_reason'='ambiguous_current_edition','ambiguous catalog returns empty with reason');
SELECT pg_temp.check_true((SELECT count(*)=2 FROM public.get_cutoff_scores(s,ARRAY[i],a)),'explicit reference overrides ambiguous current') FROM cutoff_fixture;
RESET ROLE;
DELETE FROM public.exam_editions WHERE code='2098.2';
SELECT set_config('request.jwt.claim.sub',student::text,true) FROM cutoff_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(public.get_user_cutoff_context(student,a)->>'reason'='matched' AND jsonb_array_length(public.get_user_cutoff_context(student,a)->'matches')=2
 AND public.get_user_cutoff_context(student,a)->'stats'->>'max'='81' AND public.get_user_cutoff_context(student,a)->'matches'->0->>'source'='Fixture source A','canonical onboarding IDs authoritative') FROM cutoff_fixture;
SELECT pg_temp.check_true(public.get_user_cutoff_context(u,a)->>'reason'='unauthorized','other user denied') FROM cutoff_fixture;
DO $$ BEGIN
 BEGIN PERFORM public.admin_import_cutoffs(NULL,'Forbidden','[]'); RAISE EXCEPTION 'student admitted';
 EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
 PERFORM pg_temp.check_true(true,'student cannot import');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.get_cutoff_scores(s,ARRAY[i],a)),'null identity no rows') FROM cutoff_fixture;
SELECT pg_temp.check_true(public.get_user_cutoff_context(NULL)->>'reason'='unauthorized','null identity context denied');
RESET ROLE;
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.get_cutoff_scores(uuid,uuid[],uuid)','EXECUTE'),'anon ACL denied');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.get_user_cutoff_context(uuid,uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.admin_import_cutoffs(uuid,text,jsonb)','EXECUTE'),'anon context and importer ACL denied');
SELECT set_config('request.jwt.claim.sub',u::text,true) FROM cutoff_fixture;
CREATE TEMP TABLE before_counts AS SELECT (SELECT count(*) FROM public.enamed_cutoff_scores) cuts,(SELECT count(*) FROM public.enamed_programs) programs;
SET LOCAL ROLE authenticated;
WITH response AS MATERIALIZED (SELECT public.admin_import_cutoffs(a,'Invalid batch',jsonb_build_array(
 jsonb_set(rows->0,'{practice_scenario}','"Fresh"'),jsonb_set(rows->1,'{institution_id}','"not-a-uuid"'))) result FROM cutoff_requests)
SELECT pg_temp.check_true(result->>'ok'='false' AND result->>'imported'='0' AND result->'errors'->0->>'row'='2'
 AND result->'errors'->0->>'field'='institution_id','invalid second row rejects whole batch with row and field') FROM response;
RESET ROLE;
SELECT pg_temp.check_true(cuts=(SELECT count(*) FROM public.enamed_cutoff_scores) AND programs=(SELECT count(*) FROM public.enamed_programs),'invalid batch zero writes both tables') FROM before_counts;
CREATE FUNCTION pg_temp.fail_cutoff_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.practice_scenario='Explode' THEN RAISE EXCEPTION 'fixture insert failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER cutoff_fixture_failure BEFORE INSERT ON public.enamed_cutoff_scores FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_cutoff_insert();
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((public.admin_import_cutoffs(a,'Fail batch',jsonb_build_array(
 jsonb_set(rows->0,'{practice_scenario}','"Fresh"'),jsonb_set(rows->1,'{practice_scenario}','"Explode"')))->>'ok')::boolean=false,'mid-insert error structured failure') FROM cutoff_requests;
RESET ROLE;
SELECT pg_temp.check_true(cuts=(SELECT count(*) FROM public.enamed_cutoff_scores) AND programs=(SELECT count(*) FROM public.enamed_programs),'mid-insert rolls back both tables') FROM before_counts;
DROP TRIGGER cutoff_fixture_failure ON public.enamed_cutoff_scores;
-- RELEASE must still find the caller's savepoint: the file must never COMMIT seeds.
SAVEPOINT cutoff_reapply_caller;
\ir ../migrations/20261104090759_fase1_cutoff_reference.sql
RELEASE SAVEPOINT cutoff_reapply_caller;
SELECT pg_temp.check_true(NOT EXISTS(SELECT * FROM legacy_snapshot EXCEPT SELECT id,reference_edition_id,source FROM public.enamed_cutoff_scores),'D6 historical nulls intact after reapply');
SELECT pg_temp.check_true(NOT EXISTS(SELECT * FROM legacy_program_snapshot EXCEPT SELECT * FROM public.enamed_programs),'D6 program source and original text intact');
SELECT pg_temp.check_true(NOT EXISTS(SELECT * FROM original_snapshot EXCEPT SELECT * FROM cutoff_private.original_functions),'original definitions owners and ACL unchanged on reapply');
SELECT pg_temp.check_true((SELECT count(*)=4 AND count(DISTINCT source)=2 FROM public.enamed_cutoff_scores WHERE reference_edition_id IN (a,b)),'reapply preserves imported sources') FROM cutoff_fixture;
SELECT pg_temp.check_true(NOT has_schema_privilege('authenticated','cutoff_private','USAGE') AND NOT has_table_privilege('authenticated','cutoff_private.original_functions','SELECT'),'private backups remain inaccessible');
SELECT pg_temp.check_true((SELECT bool_and(NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')) FROM pg_proc p WHERE pronamespace='cutoff_private'::regnamespace),'all private helper ACLs retained on reapply');
SELECT set_config('request.jwt.claim.sub',student::text,true) FROM cutoff_fixture;
UPDATE public.app_config SET value='false' WHERE key='editions_ui';
UPDATE public.onboarding_profiles SET specialty='Cutoff Specialty',target_institutions=ARRAY['Cutoff Fixture'] WHERE user_id=(SELECT student FROM cutoff_fixture);
CREATE TEMP TABLE legacy_context_expected AS SELECT cutoff_private.legacy_context(student) result FROM cutoff_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true(public.get_user_cutoff_context()->>'reason'='matched' AND public.get_user_cutoff_context()->'stats'->>'max'='70','legacy context keeps matches and stats after reapply');
RESET ROLE;
SELECT pg_temp.check_true((public.get_user_cutoff_context()-ARRAY['mode','reference_edition_id','reference_label','reference_reason','matches'])=(result-'matches'),'legacy JSON keys and ownership unchanged') FROM legacy_context_expected;
ROLLBACK;
