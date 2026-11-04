\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() !~ '^enamed_test_admin_session_[a-z0-9_]+$'
 OR session_user <> 'postgres' OR current_user <> 'postgres'
 OR inet_server_addr() <> '127.0.0.1'::inet OR inet_server_port() <> 54737 THEN
  RAISE EXCEPTION 'Unsafe test target';
 END IF;
END $$;
BEGIN;
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',message; END IF; END $$;
SELECT pg_temp.assert(position('FOR SHARE' IN pg_get_functiondef('public.create_attempt_guarded(uuid)'::regprocedure))>0,'online creation serializes window read');
SELECT pg_temp.assert(to_regprocedure('public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid)') IS NOT NULL,'session-aware creation exists');
SELECT pg_temp.assert(to_regprocedure('public.admin_update_simulado_window(uuid,timestamptz,timestamptz,timestamptz,text,text)') IS NOT NULL,'explicit window update exists');
SELECT pg_temp.assert(NOT has_function_privilege('authenticated','public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid)','EXECUTE'),'session creation not authenticated');
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid)','EXECUTE'),'session creation not anonymous');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (md5('as:admin')::uuid,'as-admin@example.invalid','{}'),
 (md5('as:editor')::uuid,'as-editor@example.invalid','{}'),
 (md5('as:student')::uuid,'as-student@example.invalid','{}'),
 (md5('as:student2')::uuid,'as-student2@example.invalid','{}');
INSERT INTO public.user_roles(user_id,role) VALUES (md5('as:admin')::uuid,'admin'),(md5('as:editor')::uuid,'content_editor');
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT md5('as:extra'||n)::uuid,'as-extra'||n||'@example.invalid','{}' FROM generate_series(1,9) n;
SELECT set_config('request.jwt.claim.sub',md5('as:admin')::uuid::text,true);
INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,execution_window_start,execution_window_end,results_release_at)
VALUES(md5('as:sim')::uuid,'Session QA','as-session-qa',998041,'test',1,60,now()-interval '4 hours',now()-interval '3 hours',now()+interval '1 day');
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
VALUES(md5('as:q')::uuid,md5('as:sim')::uuid,1,'Fixture','Clinica Medica','Fixture');
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
VALUES(md5('as:option')::uuid,md5('as:q')::uuid,'A','Fixture',true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('as:editor')::uuid::text,true);
SELECT public.admin_presencial_session_upsert(NULL,md5('as:sim')::uuid,'as-legacy','Legacy',now()-interval '1 hour',now()+interval '1 hour',true,NULL);
SELECT public.admin_presencial_session_upsert(NULL,md5('as:sim')::uuid,'as-v1','V1',now()-interval '1 hour',now()+interval '1 hour',true,NULL,'session_window_v1');
SELECT pg_temp.assert((SELECT ranking_rule='legacy_online_window' FROM public.admin_presencial_sessions_list() WHERE code='as-legacy'),'8 arg default remains legacy');
SELECT pg_temp.assert((SELECT ranking_rule='session_window_v1' FROM public.admin_presencial_sessions_list() WHERE code='as-v1'),'list exposes v1');
SELECT public.admin_presencial_session_upsert((SELECT id FROM public.admin_presencial_sessions_list() WHERE code='as-v1'),md5('as:sim')::uuid,'as-v1','V1 edited',now()-interval '1 hour',now()+interval '1 hour',true,NULL);
SELECT pg_temp.assert((SELECT ranking_rule='session_window_v1' FROM public.admin_presencial_sessions_list() WHERE code='as-v1'),'legacy edit preserves v1');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:student')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
SELECT public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:student')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
DO $$ BEGIN
 BEGIN
  PERFORM public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:student')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-legacy'));
  RAISE EXCEPTION 'Snapshot retarget accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM public.create_or_convert_presencial_attempt_for_session(md5('as:wrong-sim')::uuid,md5('as:student')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
  RAISE EXCEPTION 'Session simulado mismatch accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- An old pending attempt is not a new check-in participation. No backfill.
SELECT public.create_or_convert_presencial_attempt(md5('as:sim')::uuid,md5('as:extra1')::uuid);
SELECT public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:extra1')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM admin_session_private.attempt_rules r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.user_id=md5('as:extra1')::uuid),'legacy pending retry never snapshots');
UPDATE public.attempts SET status='in_progress' WHERE user_id=md5('as:extra1')::uuid;
DO $$ BEGIN
 BEGIN
  PERFORM public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:extra1')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
  RAISE EXCEPTION 'Historical in_progress accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PRESENCIAL_ALREADY_SUBMITTED' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM admin_session_private.attempt_rules r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.user_id=md5('as:extra1')::uuid),'legacy in_progress retry never snapshots');
UPDATE public.attempts SET status='submitted',score_percentage=0,finished_at=now() WHERE user_id=md5('as:extra1')::uuid;
DO $$ BEGIN
 BEGIN
  PERFORM public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:extra1')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
  RAISE EXCEPTION 'Historical submitted accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PRESENCIAL_ALREADY_SUBMITTED' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM admin_session_private.attempt_rules r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.user_id=md5('as:extra1')::uuid),'legacy submitted retry never snapshots');
-- Submit boundary oracle uses server-stored snapshot, not mutable session rows.
SELECT pg_temp.assert(admin_session_private.presencial_eligible(a.id,r.opens_at,now()+interval '5 days',now()+interval '6 days')
 AND admin_session_private.presencial_eligible(a.id,r.closes_at,now()+interval '5 days',now()+interval '6 days')
 AND NOT admin_session_private.presencial_eligible(a.id,r.closes_at+interval '1 microsecond',r.closes_at,r.closes_at+interval '1 day'),
 'inclusive session boundaries override opposite online windows')
FROM public.attempts a JOIN admin_session_private.attempt_rules r ON r.attempt_id=a.id WHERE a.user_id=md5('as:student')::uuid;
-- Freeze unlinked at creation, edit the session to days in the past, then link.
INSERT INTO public.presencial_submissions(id,session_id,simulado_id,declared_name,declared_email,identification_path,answers,submitted_at)
SELECT md5('as:unlinked')::uuid,id,simulado_id,'Fixture','qa@example.invalid','unlinked',
 jsonb_build_array(jsonb_build_object('question_id',md5('as:q')::uuid,'selected_option_id',md5('as:option')::uuid)),now()
FROM public.presencial_sessions WHERE code='as-v1';
UPDATE public.presencial_sessions SET opens_at=now()-interval '10 days',closes_at=now()-interval '9 days',ranking_rule='legacy_online_window' WHERE code='as-v1';
SELECT public.link_presencial_submission(md5('as:unlinked')::uuid,md5('as:student2')::uuid);
SELECT pg_temp.assert((SELECT a.is_within_window AND r.ranking_rule='session_window_v1' AND r.checked_in_at=sr.checked_in_at
 FROM public.attempts a JOIN admin_session_private.attempt_rules r ON r.attempt_id=a.id
 JOIN admin_session_private.submission_rules sr ON sr.submission_id=md5('as:unlinked')::uuid WHERE a.user_id=md5('as:student2')::uuid),'late link copies original frozen rule');
DO $$ BEGIN
 BEGIN
  PERFORM public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:extra2')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-v1'));
  RAISE EXCEPTION 'Out-of-session checkin accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT public.submit_presencial_answers((SELECT id FROM public.attempts WHERE user_id=md5('as:student')::uuid),md5('as:student')::uuid,
 jsonb_build_array(jsonb_build_object('question_id',md5('as:q')::uuid,'selected_option_id',md5('as:option')::uuid)));
SELECT pg_temp.assert((SELECT is_within_window AND score_percentage=100 FROM public.attempts WHERE user_id=md5('as:student')::uuid),'v1 valid outside online window');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('as:editor')::uuid::text,true);
SELECT set_config('app.admin_window_operation','true',true);
SELECT pg_temp.assert(current_user='authenticated','SET ROLE did not retain postgres effective identity');
DO $$ BEGIN
 BEGIN
  UPDATE public.simulados SET execution_window_end=now() WHERE id=md5('as:sim')::uuid;
  RAISE EXCEPTION 'Direct editor update accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.admin_preview_simulado_window(md5('as:sim')::uuid,now()-interval '2 hours',now()+interval '1 hour',now()+interval '2 hours');
  RAISE EXCEPTION 'Editor accepted without attempts.manage';
 EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',md5('as:admin')::uuid::text,true);
SELECT public.admin_preview_simulado_window(md5('as:sim')::uuid,now()-interval '2 hours',now()+interval '1 hour',now()+interval '2 hours') AS preview \gset
SELECT public.admin_update_simulado_window(md5('as:sim')::uuid,now()-interval '2 hours',now()+interval '1 hour',now()+interval '2 hours',(:'preview'::jsonb->>'current_window_hash'),'QA explicit update');
DO $$ BEGIN
 BEGIN
  PERFORM public.admin_update_simulado_window(md5('as:sim')::uuid,now()-interval '2 hours',now()+interval '1 hour',now()+interval '2 hours','stale','QA stale');
  RAISE EXCEPTION 'Stale hash accepted';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
END $$;
RESET ROLE;
SELECT pg_temp.assert((SELECT is_within_window AND score_percentage=100 AND total_correct=1 FROM public.attempts WHERE user_id=md5('as:student')::uuid),'window recalc preserves frozen eligibility and grade');
SELECT pg_temp.assert((SELECT count(*)=1 FROM public.answers WHERE attempt_id IN (SELECT id FROM public.attempts WHERE user_id=md5('as:student')::uuid)),'answers unchanged');
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM public.admin_audit_log WHERE actor_id=md5('as:admin')::uuid AND action='update_simulado_window'),'JWT actor audit');
SELECT id AS reassign_attempt FROM public.attempts WHERE user_id=md5('as:student')::uuid \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('as:admin')::uuid::text,true);
SELECT public.admin_presencial_reassign(:'reassign_attempt'::uuid,md5('as:extra9')::uuid);
RESET ROLE;
SELECT pg_temp.assert((SELECT a.is_within_window AND a.score_percentage=100 AND r.ranking_rule='session_window_v1' FROM public.attempts a JOIN admin_session_private.attempt_rules r ON r.attempt_id=a.id WHERE a.user_id=md5('as:extra9')::uuid),'reassign preserves frozen rule and grade');
SELECT pg_temp.assert(NOT has_schema_privilege('authenticated','admin_session_private','USAGE') AND NOT has_table_privilege('service_role','admin_session_private.attempt_rules','UPDATE'),'snapshot ACL private');
SELECT pg_temp.assert((SELECT bool_and(pg_get_userbyid(proowner)='postgres') FROM pg_proc WHERE proname IN ('admin_update_simulado_window','admin_preview_simulado_window','create_or_convert_presencial_attempt_for_session')),'new RPC owners');
SELECT pg_temp.assert((SELECT count(*)=1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='admin_presencial_session_upsert'),'one unambiguous signature');
-- Real trigger failure after writes must roll back windows, flags AND audit.
CREATE FUNCTION pg_temp.fail_window_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.action='update_simulado_window' AND NEW.entity_id=md5('as:sim')::uuid THEN RAISE EXCEPTION 'QA_AUDIT_FAILURE'; END IF; RETURN NEW; END $$;
CREATE TRIGGER qa_fail_window_audit BEFORE INSERT ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_window_audit();
DO $$ DECLARE before_state jsonb; after_state jsonb; h text; before_ops bigint;
BEGIN
 SELECT jsonb_build_object('window',admin_session_private.window_json(s),'flags',(SELECT jsonb_object_agg(id,is_within_window) FROM public.attempts WHERE simulado_id=s.id)),admin_session_private.window_hash(s)
 INTO before_state,h FROM public.simulados s WHERE s.id=md5('as:sim')::uuid;
 SELECT count(*) INTO before_ops FROM admin_session_private.window_operations;
 BEGIN
  PERFORM public.admin_update_simulado_window(md5('as:sim')::uuid,now()-interval '5 days',now()-interval '4 days',now()+interval '2 hours',h,'QA injected failure');
  RAISE EXCEPTION 'Audit failure not raised';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QA_AUDIT_FAILURE' THEN RAISE; END IF; END;
 SELECT jsonb_build_object('window',admin_session_private.window_json(s),'flags',(SELECT jsonb_object_agg(id,is_within_window) FROM public.attempts WHERE simulado_id=s.id))
 INTO after_state FROM public.simulados s WHERE s.id=md5('as:sim')::uuid;
 PERFORM pg_temp.assert(before_state=after_state AND before_ops=(SELECT count(*) FROM admin_session_private.window_operations),'audit failure atomicity');
END $$;
DROP TRIGGER qa_fail_window_audit ON public.admin_audit_log;
DO $$ DECLARE h text; report jsonb; op uuid; before_state jsonb; original_state jsonb;
BEGIN
 SELECT admin_session_private.window_json(s),admin_session_private.window_hash(s) INTO before_state,h FROM public.simulados s WHERE id=md5('as:sim')::uuid;
 report:=public.admin_update_simulado_window(md5('as:sim')::uuid,(before_state->>'execution_window_start')::timestamptz,(before_state->>'execution_window_end')::timestamptz,(before_state->>'results_release_at')::timestamptz,h,'QA no-op');
 PERFORM pg_temp.assert((report->>'eligibility_changed')::integer=0,'no-op idempotent flags');
 report:=public.admin_update_simulado_window(md5('as:sim')::uuid,now()-interval '5 days',now()-interval '4 days',now()+interval '2 hours',h,'QA rollback target');
 op:=(report->>'operation_id')::uuid;
 PERFORM admin_session_private.rollback_window_operation(op);
 SELECT admin_session_private.window_json(s) INTO original_state FROM public.simulados s WHERE id=md5('as:sim')::uuid;
 PERFORM pg_temp.assert(original_state=before_state,'executable rollback restores exact window');
 BEGIN
  PERFORM admin_session_private.rollback_window_operation(op);
  RAISE EXCEPTION 'Repeated stale rollback accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM admin_session_private.rollback_installation();
  RAISE EXCEPTION 'Rollback with active v1 accepted';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN PERFORM pg_temp.assert(SQLERRM='ROLLBACK_REFUSED_ACTIVE_V1','explicit active-v1 refusal'); END;
END $$;
-- Both new auxiliary FKs cascade, without relaxing academic/F0 restrictions.
SELECT public.create_or_convert_presencial_attempt_for_session(md5('as:sim')::uuid,md5('as:extra3')::uuid,(SELECT id FROM public.presencial_sessions WHERE code='as-legacy'));
SELECT id AS delete_attempt FROM public.attempts WHERE user_id=md5('as:extra3')::uuid \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',md5('as:extra3')::uuid::text,true);
DO $$ DECLARE n integer; BEGIN
 BEGIN UPDATE admin_session_private.attempt_rules SET ranking_rule='session_window_v1'; RAISE EXCEPTION 'Student wrote snapshot'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM admin_session_private.attempt_rules; RAISE EXCEPTION 'Student deleted snapshot'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.attempts WHERE user_id=md5('as:extra3')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; PERFORM pg_temp.assert(n=0,'student cannot delete attempt');
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM admin_session_private.attempt_rules WHERE attempt_id=:'delete_attempt'::uuid),'snapshot immutable while parent exists');
DELETE FROM public.attempts WHERE id=:'delete_attempt'::uuid;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM admin_session_private.attempt_rules WHERE attempt_id=:'delete_attempt'::uuid),'privileged attempt delete cleans auxiliary');
INSERT INTO public.presencial_submissions(id,session_id,simulado_id,declared_name,declared_email,identification_path)
SELECT md5('as:delete-sub')::uuid,id,simulado_id,'Fixture','delete@example.invalid','unlinked' FROM public.presencial_sessions WHERE code='as-legacy';
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM admin_session_private.submission_rules WHERE submission_id=md5('as:delete-sub')::uuid),'submission snapshot captured');
DELETE FROM public.presencial_submissions WHERE id=md5('as:delete-sub')::uuid;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM admin_session_private.submission_rules WHERE submission_id=md5('as:delete-sub')::uuid),'privileged submission delete cleans auxiliary');
ROLLBACK;
\echo 'Transactional admin session assertions PASS (fixtures rolled back)'

-- Opt-in only on a fresh disposable clone: this phase COMMITs legacy fixtures
-- so the migration's own transaction can test a real rollback/reapply cycle.
\if :{?test_installation_rollback}
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(md5('rb:student')::uuid,'rollback@example.invalid','{}');
INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,execution_window_start,execution_window_end,results_release_at)
VALUES(md5('rb:sim')::uuid,'Rollback QA','rollback-qa',991041,'test',1,60,now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours');
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme) VALUES(md5('rb:q')::uuid,md5('rb:sim')::uuid,1,'Fixture','Clinica Medica','Fixture');
INSERT INTO public.question_options(id,question_id,label,text,is_correct) VALUES(md5('rb:o')::uuid,md5('rb:q')::uuid,'A','Fixture',true);
INSERT INTO public.presencial_sessions(id,simulado_id,code,label,opens_at,closes_at)
VALUES(md5('rb:s')::uuid,md5('rb:sim')::uuid,'rollback-qa','Fixture',now()-interval '1 hour',now()+interval '1 hour');
SELECT public.create_or_convert_presencial_attempt_for_session(md5('rb:sim')::uuid,md5('rb:student')::uuid,md5('rb:s')::uuid) AS attempt \gset
SELECT public.submit_presencial_answers(:'attempt'::uuid,md5('rb:student')::uuid,jsonb_build_array(jsonb_build_object('question_id',md5('rb:q')::uuid,'selected_option_id',md5('rb:o')::uuid)));
CREATE TEMP TABLE rollback_expected AS SELECT
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE simulado_id=md5('rb:sim')::uuid) AS attempts,
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY attempt_id) FROM admin_session_private.attempt_rules r) AS snapshots,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.answers a WHERE attempt_id=:'attempt'::uuid) AS answers;
DO $$ DECLARE d text; BEGIN
 BEGIN
  SELECT pg_get_functiondef('public.create_attempt_guarded(uuid)'::regprocedure) INTO d;
  EXECUTE replace(d,'AS $function$','AS $function$'||chr(10)||'-- injected drift');
  PERFORM admin_session_private.rollback_installation();
  RAISE EXCEPTION 'Drift accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
SELECT admin_session_private.rollback_installation();
DO $$ DECLARE p oid:='public.create_attempt_guarded(uuid)'::regprocedure; BEGIN
 IF EXISTS(SELECT 1 FROM admin_session_private.definitions c JOIN pg_proc f ON f.proname=c.name AND f.pronamespace='public'::regnamespace WHERE NOT admin_session_private.original_checkpoint_matches(c.name,f.oid)) THEN RAISE EXCEPTION 'Original definition/owner/ACL not restored'; END IF;
 IF has_function_privilege('service_role','public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Session caller not fenced'; END IF;
 BEGIN
  GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO anon;
  IF admin_session_private.original_checkpoint_matches('create_attempt_guarded',p) THEN RAISE EXCEPTION 'ACL drift accepted'; END IF;
  RAISE EXCEPTION 'QA_REVERT' USING ERRCODE='40001';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  ALTER FUNCTION public.create_attempt_guarded(uuid) OWNER TO service_role;
  IF admin_session_private.original_checkpoint_matches('create_attempt_guarded',p) THEN RAISE EXCEPTION 'Owner drift accepted'; END IF;
  RAISE EXCEPTION 'QA_REVERT' USING ERRCODE='40001';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
COMMIT;
\i supabase/migrations/20261104120004_fase2_admin_session_rules.sql
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM rollback_expected e WHERE
 e.attempts=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE simulado_id=md5('rb:sim')::uuid)
 AND e.snapshots=(SELECT jsonb_agg(to_jsonb(r) ORDER BY attempt_id) FROM admin_session_private.attempt_rules r)
 AND e.answers=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.answers a WHERE attempt_id IN (SELECT id FROM public.attempts WHERE simulado_id=md5('rb:sim')::uuid))) THEN RAISE EXCEPTION 'Rollback/reapply changed grade, snapshots or answers'; END IF;
 IF NOT has_function_privilege('service_role','public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Reapply ACL missing'; END IF;
END $$;
\echo 'Installation rollback/reapply PASS (legacy fixtures retained in disposable clone)'
\endif
