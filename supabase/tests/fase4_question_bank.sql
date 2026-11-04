\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() !~ '^enamed_test_bank_[a-z0-9_]+$' OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
  OR inet_server_port() IS DISTINCT FROM 54737 OR session_user<>'postgres' THEN RAISE EXCEPTION 'Unsafe local target'; END IF;
END $$;
BEGIN;
SET LOCAL statement_timeout='30s';
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT ('f4200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'bank-'||n||'@example.invalid' FROM generate_series(1,4) n;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('f4200000-0000-0000-0000-000000000001','admin'),
 ('f4200000-0000-0000-0000-000000000003','content_editor'),
 ('f4200000-0000-0000-0000-000000000004','analyst');
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
INSERT INTO public.exam_blueprints(id,code,label) VALUES('f4270000-0000-0000-0000-000000000001','bank-synthetic','Synthetic blueprint');
INSERT INTO public.exam_areas(id,blueprint_id,code,label,weight,sort_order) VALUES
 ('f4280000-0000-0000-0000-000000000001','f4270000-0000-0000-0000-000000000001','PED','Synthetic pediatrics',1,1);
INSERT INTO public.exam_editions(id,code,year,term,label,status,blueprint_id) VALUES
 ('f4210000-0000-0000-0000-000000000001','2196.1',2196,1,'Bank fixture one','active','f4270000-0000-0000-0000-000000000001'),
 ('f4210000-0000-0000-0000-000000000002','2196.2',2196,2,'Bank fixture two','active','f4270000-0000-0000-0000-000000000001');
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,questions_count,
 execution_window_start,execution_window_end,results_release_at,status)
SELECT ('f4220000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Bank '||n,'f42-bank-'||n,n,
 ('f4210000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,350,
 now()-interval '3 days',now()-interval '2 days',
 CASE WHEN n=1 THEN now()-interval '1 day' ELSE now()+interval '1 day' END,'test'
FROM generate_series(1,2) n;
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
SELECT ('f4230000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f4220000-0000-0000-0000-'||lpad(((n-1)/350+1)::text,12,'0'))::uuid,
 (n-1)%350+1,'Synthetic identical text','PED','Synthetic theme' FROM generate_series(1,700) n;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
SELECT ('f4240000-0000-0000-0000-'||lpad((n*10+o)::text,12,'0'))::uuid,
 ('f4230000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,chr(64+o),'Option '||o,o=1
FROM generate_series(1,700) n CROSS JOIN generate_series(1,4) o;
INSERT INTO public.attempts(id,simulado_id,user_id,status,attempt_type,effective_deadline,finished_at,total_correct,total_answered,score_percentage,is_within_window)
SELECT ('f4250000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f4220000-0000-0000-0000-'||lpad((CASE WHEN n=3 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,
 'f4200000-0000-0000-0000-000000000002','submitted',CASE WHEN n=2 THEN 'offline' WHEN n=4 THEN 'presencial' ELSE 'online' END,now()-interval '2 days',now()-interval '2 days',1,1,100,n NOT IN(2,4)
FROM generate_series(1,4) n;
INSERT INTO public.answers(attempt_id,question_id,selected_option_id) VALUES
 ('f4250000-0000-0000-0000-000000000002','f4230000-0000-0000-0000-000000000001','f4240000-0000-0000-0000-000000000012');
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered)
VALUES ('f4250000-0000-0000-0000-000000000001','f4230000-0000-0000-0000-000000000001',true,true);
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_created_hubspot;
COMMIT;
CREATE TEMP TABLE frozen_questions AS SELECT to_jsonb(q) data FROM public.questions q;
CREATE TEMP TABLE frozen_options AS SELECT to_jsonb(o) data FROM public.question_options o;
CREATE TEMP TABLE frozen_attempts AS SELECT to_jsonb(a) data FROM public.attempts a;
CREATE TEMP TABLE frozen_aqr AS SELECT to_jsonb(r) data FROM public.attempt_question_results r;
CREATE TEMP TABLE frozen_answers AS SELECT to_jsonb(a) data FROM public.answers a;
CREATE TEMP TABLE frozen_acl AS SELECT c.oid,c.relacl FROM pg_class c WHERE c.oid IN
 ('public.questions'::regclass,'public.question_options'::regclass,'public.attempt_question_results'::regclass,'public.attempts'::regclass);
CREATE TEMP TABLE frozen_helpers AS SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid IN
 ('public.lock_option_simulado()'::regprocedure,'public.enforce_question_edition_area()'::regprocedure,
  'public.recalculate_user_performance(uuid)'::regprocedure);
-- Fail late in installation, AFTER the 700-row backfill. Sequence evidence is
-- intentionally nontransactional, so an unrelated early SQL error cannot pass.
CREATE TEMP SEQUENCE bank_install_fault_hit;
CREATE FUNCTION pg_temp.bank_install_fault() RETURNS event_trigger LANGUAGE plpgsql AS $$
BEGIN
 IF to_regprocedure('public.admin_get_question_item_analysis(uuid,uuid)') IS NOT NULL THEN
  PERFORM nextval('pg_temp.bank_install_fault_hit');
  RAISE EXCEPTION 'injected bank installation fault' USING ERRCODE='23514';
 END IF;
END $$;
CREATE EVENT TRIGGER bank_install_fault ON ddl_command_end WHEN TAG IN ('CREATE FUNCTION')
 EXECUTE FUNCTION pg_temp.bank_install_fault();
\set ON_ERROR_STOP off
\ir ../migrations/20261104120003_fase4_question_bank.sql
\set ON_ERROR_STOP on
DROP EVENT TRIGGER bank_install_fault;
DO $$ BEGIN
 ASSERT (SELECT is_called AND last_value=1 FROM pg_temp.bank_install_fault_hit),'late installation fault actually reached';
 ASSERT to_regnamespace('question_bank_private') IS NULL AND to_regclass('public.question_bank') IS NULL,'failed installation fully rolled back';
 ASSERT to_regprocedure('public.admin_list_question_bank_versions(uuid,integer,integer)') IS NULL,'failed installation left no RPC';
 ASSERT NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid IN('public.questions'::regclass,'public.question_options'::regclass) AND tgname LIKE 'bank_%'),'failed installation left no content triggers';
END $$;
\ir ../migrations/20261104120003_fase4_question_bank.sql
DO $$ BEGIN
 ASSERT (SELECT count(*)=700 FROM public.question_bank),'700 independent identities';
 ASSERT (SELECT count(*)=700 AND bool_and(provenance='legacy_snapshot' AND editor_id IS NULL AND state='published') FROM public.question_bank_versions),'honest initial snapshots';
 ASSERT (SELECT count(*)=700 FROM public.question_bank_usage WHERE archived_at IS NULL),'700 usage links';
 ASSERT NOT EXISTS((SELECT data FROM frozen_questions EXCEPT SELECT to_jsonb(q) FROM public.questions q)
  UNION ALL (SELECT data FROM frozen_options EXCEPT SELECT to_jsonb(o) FROM public.question_options o)
  UNION ALL (SELECT data FROM frozen_attempts EXCEPT SELECT to_jsonb(a) FROM public.attempts a)
  UNION ALL (SELECT data FROM frozen_aqr EXCEPT SELECT to_jsonb(r) FROM public.attempt_question_results r)
  UNION ALL (SELECT data FROM frozen_answers EXCEPT SELECT to_jsonb(a) FROM public.answers a)),'legacy unchanged';
 ASSERT (SELECT count(DISTINCT content_hash)=1 FROM public.question_bank_versions),'deterministic semantic hash, no identity merging';
 ASSERT NOT EXISTS(SELECT FROM frozen_acl f JOIN pg_class c ON c.oid=f.oid WHERE f.relacl IS DISTINCT FROM c.relacl),'legacy ACL preserved';
 ASSERT NOT EXISTS(SELECT FROM frozen_helpers f WHERE f.definition<>pg_get_functiondef(f.oid)),'legacy helpers preserved';
END $$;
CREATE TEMP TABLE frozen_versions AS SELECT to_jsonb(v) data FROM public.question_bank_versions v;
\ir ../migrations/20261104120003_fase4_question_bank.sql
DO $$ BEGIN
 ASSERT (SELECT count(*)=700 FROM public.question_bank_versions),'reapply is no-op';
 ASSERT NOT EXISTS(SELECT data FROM frozen_versions EXCEPT SELECT to_jsonb(v) FROM public.question_bank_versions v),'immutable backfill on reapply';
END $$;
BEGIN;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
-- One statement, one snapshot; A -> B -> A appends, never resurrects.
UPDATE public.question_options SET is_correct=label='B' WHERE question_id='f4230000-0000-0000-0000-000000000001';
UPDATE public.question_options SET is_correct=label='A' WHERE question_id='f4230000-0000-0000-0000-000000000001';
UPDATE public.question_options SET text=text WHERE question_id='f4230000-0000-0000-0000-000000000001';
DO $$ DECLARE b uuid; BEGIN
 SELECT id INTO b FROM public.question_bank WHERE original_question_id='f4230000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=3 AND count(DISTINCT content_hash)=2 FROM public.question_bank_versions WHERE bank_id=b),'A B A and no-op';
 ASSERT (SELECT count(*)=1 FROM public.question_bank_usage WHERE bank_id=b AND archived_at IS NULL),'only terminal usage active';
 ASSERT NOT EXISTS(SELECT data FROM frozen_versions EXCEPT SELECT to_jsonb(v) FROM public.question_bank_versions v),'old payloads intact';
 BEGIN UPDATE public.question_bank_versions SET provenance='observed'; RAISE EXCEPTION 'immutable update accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN DELETE FROM public.question_bank_versions; RAISE EXCEPTION 'immutable delete accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN TRUNCATE public.question_bank_versions CASCADE; RAISE EXCEPTION 'immutable truncate accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
DELETE FROM public.question_options WHERE question_id='f4230000-0000-0000-0000-000000000002' AND label='D';
DO $$ BEGIN ASSERT (SELECT v.state='incomplete' FROM public.question_bank_usage u JOIN public.question_bank_versions v ON v.id=u.version_id WHERE u.original_question_id='f4230000-0000-0000-0000-000000000002' AND u.archived_at IS NULL),'partial save not published'; END $$;
INSERT INTO public.question_options(question_id,label,text,is_correct) VALUES('f4230000-0000-0000-0000-000000000002','D','Option 4',false);
UPDATE public.questions SET explanation='Synthetic explanation' WHERE id='f4230000-0000-0000-0000-000000000002';
DO $$ BEGIN
 ASSERT (SELECT v.state='published' AND v.payload->'question'->>'explanation'='Synthetic explanation' FROM public.question_bank_usage u JOIN public.question_bank_versions v ON v.id=u.version_id WHERE u.original_question_id='f4230000-0000-0000-0000-000000000002' AND u.archived_at IS NULL),'terminal exact snapshot';
END $$;
-- AQR existing at installation is NOT retrospectively assigned version 1.
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered) VALUES
 ('f4250000-0000-0000-0000-000000000002','f4230000-0000-0000-0000-000000000001',false,true),
 ('f4250000-0000-0000-0000-000000000003','f4230000-0000-0000-0000-000000000351',true,true);
UPDATE public.questions SET explanation='Later version' WHERE id='f4230000-0000-0000-0000-000000000001';
UPDATE public.attempt_question_results SET is_correct=is_correct WHERE question_id='f4230000-0000-0000-0000-000000000001';
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered) VALUES
 ('f4250000-0000-0000-0000-000000000001','f4230000-0000-0000-0000-000000000002',true,true),
 ('f4250000-0000-0000-0000-000000000004','f4230000-0000-0000-0000-000000000001',false,true),
 ('f4250000-0000-0000-0000-000000000001','f4230000-0000-0000-0000-000000000003',false,false);
INSERT INTO public.attempts(id,simulado_id,user_id,status,attempt_type,effective_deadline,is_within_window)
VALUES('f4250000-0000-0000-0000-000000000005','f4220000-0000-0000-0000-000000000001',
 'f4200000-0000-0000-0000-000000000001','in_progress','online',now()+interval '1 hour',true);
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered) VALUES
 ('f4250000-0000-0000-0000-000000000005','f4230000-0000-0000-0000-000000000004',true,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE b uuid; BEGIN
 SELECT bank_id INTO b FROM public.admin_get_question_item_analysis(NULL,NULL) WHERE version_id IS NULL;
 ASSERT b IS NOT NULL,'legacy unattributed group';
 ASSERT (SELECT count(*)=3 AND count(DISTINCT version_id)=2 FROM public.admin_get_question_item_analysis(b,NULL)),'legacy and two observed versions distinct, no-op AQR stable';
 ASSERT (SELECT sum(n_responses)=5 AND sum(n_answered)=4 AND sum(n_correct)=2 FROM public.admin_get_question_item_analysis(NULL,NULL)),'released finalized only, blanks counted separately';
 ASSERT (SELECT count(*)=2 AND bool_and(difficulty_observed=0) FROM public.admin_get_question_item_analysis(NULL,NULL) WHERE is_training),'training explicit with raw difficulty';
 ASSERT NOT EXISTS(SELECT FROM public.admin_get_question_item_analysis(NULL,'f4210000-0000-0000-0000-000000000002')),'unreleased excluded';
 ASSERT (SELECT count(*)=2 FROM public.admin_list_question_bank_versions(b,2,0)),'bounded pagination';
 BEGIN PERFORM public.admin_list_question_bank_versions(b,201,0); RAISE EXCEPTION 'bad limit accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- No direct key access, even for an administrator.
DO $$ BEGIN
 BEGIN PERFORM * FROM public.question_bank_versions; RAISE EXCEPTION 'raw read accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.question_bank(original_question_id) VALUES(gen_random_uuid()); RAISE EXCEPTION 'raw write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
 BEGIN PERFORM public.admin_list_question_bank_versions(NULL,20,0); RAISE EXCEPTION 'student content accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN SQLSTATE 'P0003' THEN ASSERT SQLERRM='unauthorized'; END;
 BEGIN PERFORM public.admin_get_question_item_analysis(NULL,NULL); RAISE EXCEPTION 'student intel accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN SQLSTATE 'P0003' THEN ASSERT SQLERRM='unauthorized'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000003',true);
DO $$ BEGIN BEGIN PERFORM public.admin_get_question_item_analysis(NULL,NULL); RAISE EXCEPTION 'editor intel accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN SQLSTATE 'P0003' THEN ASSERT SQLERRM='unauthorized'; END; END $$;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000004',true);
DO $$ BEGIN BEGIN PERFORM public.admin_list_question_bank_versions(NULL,20,0); RAISE EXCEPTION 'analyst content accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN SQLSTATE 'P0003' THEN ASSERT SQLERRM='unauthorized'; END; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.question_bank_versions; RAISE EXCEPTION 'anon keys accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_get_question_item_analysis(NULL,NULL); RAISE EXCEPTION 'anon rpc accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme) VALUES
 ('f4230000-0000-0000-0000-000000000701','f4220000-0000-0000-0000-000000000002',351,'New synthetic question','PED','Synthetic theme');
DO $$ BEGIN
 ASSERT (SELECT v.state='incomplete' AND v.provenance='observed' AND v.editor_id=auth.uid()
  FROM public.question_bank_versions v JOIN public.question_bank b ON b.id=v.bank_id
  WHERE b.original_question_id='f4230000-0000-0000-0000-000000000701'),'new question observed incomplete with actual editor';
END $$;
INSERT INTO public.question_options(question_id,label,text,is_correct)
 SELECT 'f4230000-0000-0000-0000-000000000701',chr(64+n),'New option '||n,n=1 FROM generate_series(1,4) n;
DO $$ BEGIN
 ASSERT (SELECT v.state='published' AND v.version_number=2 FROM public.question_bank_versions v
  JOIN public.question_bank_usage u ON u.version_id=v.id
  WHERE u.original_question_id='f4230000-0000-0000-0000-000000000701' AND u.archived_at IS NULL),'bulk option insert captures one complete terminal snapshot';
 ASSERT NOT EXISTS((SELECT data FROM frozen_attempts EXCEPT SELECT to_jsonb(a) FROM public.attempts a)
  UNION ALL (SELECT data FROM frozen_answers EXCEPT SELECT to_jsonb(a) FROM public.answers a)),'content edits do not touch attempts or answers';
END $$;
-- Legacy permits this deletion; the bank must not add a restrictive live FK.
DELETE FROM public.questions WHERE id='f4230000-0000-0000-0000-000000000700';
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 AND bool_and(archived_at IS NOT NULL) FROM public.question_bank_usage WHERE original_question_id='f4230000-0000-0000-0000-000000000700'),'soft archived usage survives';
 ASSERT (SELECT count(*)=1 FROM public.question_bank_versions v JOIN public.question_bank b ON b.id=v.bank_id WHERE b.original_question_id='f4230000-0000-0000-0000-000000000700'),'deleted source payload preserved';
END $$;
-- Fault after capture: entire content statement AND version append roll back.
CREATE FUNCTION pg_temp.bank_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected' USING ERRCODE='23514'; END $$;
CREATE TRIGGER zz_bank_fault AFTER UPDATE ON public.questions FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.bank_fault();
DO $$ DECLARE n bigint; BEGIN
 SELECT count(*) INTO n FROM public.question_bank_versions;
 BEGIN UPDATE public.questions SET explanation='Must roll back' WHERE id='f4230000-0000-0000-0000-000000000003'; EXCEPTION WHEN check_violation THEN NULL; END;
 ASSERT (SELECT count(*)=n FROM public.question_bank_versions),'version rollback';
 ASSERT (SELECT explanation IS NULL FROM public.questions WHERE id='f4230000-0000-0000-0000-000000000003'),'content rollback';
END $$;
ROLLBACK;
\echo PASS: backfill, reapply, snapshots, ABA, incomplete, ACL, analysis, deletion, fault rollback
BEGIN;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 ASSERT to_regprocedure('public.admin_list_question_bank(text,integer,integer)') IS NOT NULL,'identity list RPC missing';
 ASSERT to_regprocedure('public.admin_add_bank_version_to_simulado(uuid,uuid,integer)') IS NOT NULL,'explicit reuse RPC missing';
END $$;
CREATE FUNCTION pg_temp.expect_reuse_error(v uuid,s uuid,n integer,expected text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN PERFORM public.admin_add_bank_version_to_simulado(v,s,n);
 EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
 RAISE EXCEPTION 'Expected reuse error %',expected;
END $$;
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,questions_count,status,execution_window_start,execution_window_end,results_release_at)
SELECT ('f4260000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Reuse target '||n,'bank-reuse-'||n,n+10,
 ('f4210000-0000-0000-0000-'||lpad((CASE WHEN n=1 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,100,'draft',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days'
FROM generate_series(1,2) n;
CREATE TEMP TABLE reuse_source AS SELECT b.id bank_id,v.id version_id,v.payload
 FROM public.question_bank b JOIN public.question_bank_versions v ON v.bank_id=b.id
 WHERE b.original_question_id='f4230000-0000-0000-0000-000000000002';
CREATE TEMP TABLE reuse_result(data jsonb);
GRANT SELECT ON reuse_source TO authenticated;
GRANT SELECT,INSERT ON reuse_result TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ DECLARE page jsonb; BEGIN
 page:=public.admin_list_question_bank(NULL,50,0);
 ASSERT (page->>'total')::int=700 AND jsonb_array_length(page->'items')=50,'identities paginated independently of AQR';
 ASSERT (public.admin_list_question_bank(NULL,50,1000)->>'total')::int=700,'total available even on empty page';
 ASSERT (public.admin_list_question_bank('%_'' OR 1=1 --',50,0)->>'total')::int=0,'literal search, not SQL or wildcard';
 BEGIN PERFORM public.admin_list_question_bank(NULL,201,0); RAISE EXCEPTION 'bad limit accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.admin_list_question_bank(NULL,50,-1); RAISE EXCEPTION 'bad offset accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.admin_list_question_bank(repeat('x',501)); RAISE EXCEPTION 'long search accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT jsonb_array_length(public.admin_list_question_bank(NULL,50,1000)->'items')=0,'empty page is array';
END $$;
INSERT INTO reuse_result SELECT public.admin_add_bank_version_to_simulado(version_id,'f4260000-0000-0000-0000-000000000001',1) FROM reuse_source;
INSERT INTO reuse_result SELECT public.admin_add_bank_version_to_simulado(version_id,'f4260000-0000-0000-0000-000000000002',1) FROM reuse_source;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=2 AND count(DISTINCT data->>'question_id')=2 FROM reuse_result),'new question IDs per materialization';
 ASSERT NOT EXISTS(SELECT FROM public.question_options o JOIN public.question_options src ON src.id=o.id
  WHERE o.question_id IN(SELECT (data->>'question_id')::uuid FROM reuse_result)
   AND src.question_id='f4230000-0000-0000-0000-000000000002'),'new option IDs';
 ASSERT (SELECT count(*)=3 AND count(DISTINCT version_id)=1 AND count(DISTINCT original_edition_id)=2
  FROM public.question_bank_usage WHERE bank_id=(SELECT bank_id FROM reuse_source) AND archived_at IS NULL),'same identity and exact version across editions';
 ASSERT (SELECT count(*)=1 FROM public.question_bank_versions WHERE bank_id=(SELECT bank_id FROM reuse_source)),'no intermediate versions hidden or appended on reuse';
 ASSERT (SELECT count(*)=700 FROM public.question_bank),'reuse does not create duplicate canonical identity';
END $$;
UPDATE public.questions SET explanation='Local copy edit' WHERE id=(SELECT (data->>'question_id')::uuid FROM reuse_result LIMIT 1);
UPDATE public.questions SET text=text WHERE id='f4230000-0000-0000-0000-000000000002';
DO $$ DECLARE page jsonb; BEGIN
 ASSERT (SELECT count(*)=2 FROM public.question_bank_versions WHERE bank_id=(SELECT bank_id FROM reuse_source)),'edit appends once, source no-op does not follow canonical latest';
 ASSERT (SELECT count(*)=2 FROM public.question_bank_usage WHERE version_id=(SELECT version_id FROM reuse_source) AND archived_at IS NULL),'source and other copy retain original version';
 ASSERT (SELECT payload=(SELECT payload FROM reuse_source) FROM public.question_bank_versions WHERE id=(SELECT version_id FROM reuse_source)),'source version immutable';
 page:=public.admin_list_question_bank('Synthetic identical text',200,0);
 ASSERT (page->>'total')::int=700,'list contains identities without AQR';
 ASSERT EXISTS(SELECT FROM jsonb_array_elements(page->'items') i WHERE (i->>'bank_id')::uuid=(SELECT bank_id FROM reuse_source) AND (i->>'usage_count')::int=3),'usage count independent of AQR';
END $$;
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',1,'23505');
SELECT pg_temp.expect_reuse_error(NULL,'f4260000-0000-0000-0000-000000000001',2,'22023');
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',0,'22023');
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',101,'22023');
SELECT pg_temp.expect_reuse_error(gen_random_uuid(),'f4260000-0000-0000-0000-000000000001',2,'22023');
-- Existing test exam is never a legal destination.
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4220000-0000-0000-0000-000000000001',1,'22023');
UPDATE public.simulados SET status='archived' WHERE id='f4260000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',2,'22023');
UPDATE public.simulados SET status='draft' WHERE id='f4260000-0000-0000-0000-000000000001';
UPDATE public.questions SET text='<b>Visible</b>'||chr(10)||repeat('x',500) WHERE id='f4230000-0000-0000-0000-000000000004';
DO $$ DECLARE page jsonb; BEGIN
 page:=public.admin_list_question_bank('Visible');
 ASSERT (page->>'total')::int=1 AND length(page->'items'->0->>'title')=180
  AND page->'items'->0->>'title' NOT LIKE '%<%' AND page->'items'->0->>'title' NOT LIKE '%>%'
  AND position(chr(10) IN page->'items'->0->>'title')=0,'bounded plain-text preview';
 ASSERT NOT EXISTS(SELECT FROM jsonb_array_elements(public.admin_list_question_bank(NULL,50,0)->'items') a
  JOIN jsonb_array_elements(public.admin_list_question_bank(NULL,50,50)->'items') b ON a->>'bank_id'=b->>'bank_id'),'stable disjoint pages';
 ASSERT NOT EXISTS((SELECT data FROM frozen_attempts EXCEPT SELECT to_jsonb(a) FROM public.attempts a)
  UNION ALL (SELECT data FROM frozen_answers EXCEPT SELECT to_jsonb(a) FROM public.answers a)
  UNION ALL (SELECT data FROM frozen_aqr EXCEPT SELECT to_jsonb(a) FROM public.attempt_question_results a)),'reuse leaves attempts, answers and AQR untouched';
END $$;
DELETE FROM public.question_options WHERE question_id='f4230000-0000-0000-0000-000000000003' AND label='D';
SELECT pg_temp.expect_reuse_error((SELECT u.version_id FROM public.question_bank_usage u WHERE u.original_question_id='f4230000-0000-0000-0000-000000000003' AND archived_at IS NULL),'f4260000-0000-0000-0000-000000000001',2,'22023');
-- Drifted destination format and blueprint must reject, never silently remap.
UPDATE public.exam_editions SET format=jsonb_set(format,'{options}','5') WHERE id='f4210000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',2,'22023');
UPDATE public.exam_editions SET format=jsonb_set(format,'{options}','4') WHERE id='f4210000-0000-0000-0000-000000000002';
INSERT INTO public.exam_editions(id,code,year,term,label,status)
VALUES('f4210000-0000-0000-0000-000000000003','2197.1',2197,1,'Empty reuse destination','active');
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,questions_count,status,execution_window_start,execution_window_end,results_release_at)
VALUES('f4260000-0000-0000-0000-000000000003','Empty reuse target','bank-reuse-3',13,
 'f4210000-0000-0000-0000-000000000003',100,'draft',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days');
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000003',1,'22023');
INSERT INTO public.exam_blueprints(id,code,label) VALUES('f4270000-0000-0000-0000-000000000002','bank-other','Other blueprint');
UPDATE public.exam_editions SET blueprint_id='f4270000-0000-0000-0000-000000000002' WHERE id='f4210000-0000-0000-0000-000000000003';
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000003',1,'22023');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',2,'P0003');
DO $$ BEGIN
 BEGIN PERFORM public.admin_list_question_bank(); RAISE EXCEPTION 'student list accepted'; EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
 BEGIN INSERT INTO question_bank_private.materializations(question_id,bank_id,source_version_id,initializing)
  SELECT gen_random_uuid(),bank_id,version_id,true FROM reuse_source; RAISE EXCEPTION 'private binding accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.admin_list_question_bank(); RAISE EXCEPTION 'missing identity list accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_add_bank_version_to_simulado(NULL,NULL,1); RAISE EXCEPTION 'missing identity reuse accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',2,'P0003');
DO $$ BEGIN
 BEGIN PERFORM public.admin_list_question_bank(); RAISE EXCEPTION 'analyst list accepted'; EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.admin_list_question_bank(); RAISE EXCEPTION 'anon list accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_add_bank_version_to_simulado(NULL,NULL,1); RAISE EXCEPTION 'anon reuse accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
-- Reinstall with materializations present: no new identities or versions.
-- The migration commits these synthetic reuse fixtures for concurrency evidence.
CREATE TEMP TABLE reuse_counts AS SELECT (SELECT count(*) FROM public.question_bank) banks,
 (SELECT count(*) FROM public.question_bank_versions) versions,(SELECT count(*) FROM public.question_bank_usage) usages;
COMMIT;
\ir ../migrations/20261104120003_fase4_question_bank.sql
BEGIN;
SELECT set_config('request.jwt.claim.sub','f4200000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 ASSERT (SELECT banks=(SELECT count(*) FROM public.question_bank) AND versions=(SELECT count(*) FROM public.question_bank_versions)
  AND usages=(SELECT count(*) FROM public.question_bank_usage) FROM reuse_counts),'reapply preserves reused identities and usages';
END $$;
CREATE FUNCTION pg_temp.reuse_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'after option injection' USING ERRCODE='23514'; END $$;
CREATE TRIGGER zz_reuse_fault AFTER INSERT ON public.question_options FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.reuse_fault();
DO $$ DECLARE before_state jsonb; BEGIN
 SELECT jsonb_build_array((SELECT count(*) FROM public.questions),(SELECT count(*) FROM public.question_options),
  (SELECT count(*) FROM public.question_bank_versions),(SELECT count(*) FROM public.question_bank_usage),
  (SELECT count(*) FROM question_bank_private.materializations)) INTO before_state;
 PERFORM pg_temp.expect_reuse_error((SELECT version_id FROM reuse_source),'f4260000-0000-0000-0000-000000000001',2,'23514');
 ASSERT before_state=jsonb_build_array((SELECT count(*) FROM public.questions),(SELECT count(*) FROM public.question_options),
  (SELECT count(*) FROM public.question_bank_versions),(SELECT count(*) FROM public.question_bank_usage),
  (SELECT count(*) FROM question_bank_private.materializations)),'fault after options rolls back full materialization';
END $$;
ROLLBACK;
\echo PASS: list and explicit version reuse, independent local edits, negatives, atomic failure
