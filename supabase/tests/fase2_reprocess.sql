\set ON_ERROR_STOP on
BEGIN;
\ir local/fixture-publication-setup.sql
DO $$ BEGIN
 IF current_database() !~ '^enamed_test_(reprocess|fixtures_integrated)_[a-z0-9_]+$'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
 OR inet_server_port() IS DISTINCT FROM 54737 OR session_user <> 'postgres'
 THEN RAISE EXCEPTION 'Unsafe local target'; END IF;
 ASSERT to_regprocedure('public.admin_reprocess_simulado(uuid,text)') IS NOT NULL,
   'F2-5 RPC missing';
END $$;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT ('f2500000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'reprocess-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('f2500000-0000-0000-0000-000000000003','admin'),
 ('f2500000-0000-0000-0000-000000000004','content_editor'),
 ('f2500000-0000-0000-0000-000000000005','support');
-- JWT identity is installed only after synthetic publication setup is restored.
INSERT INTO public.enamed_specialties(id,name,slug) VALUES
 ('f2570000-0000-0000-0000-000000000001','Reprocess specialty','f25-specialty');
INSERT INTO public.enamed_institutions(id,name,uf,slug) VALUES
 ('f2570000-0000-0000-0000-000000000002','Reprocess institution','BA','f25-institution');
INSERT INTO public.onboarding_profiles(user_id,specialty_id,target_institution_ids)
SELECT id,'f2570000-0000-0000-0000-000000000001',ARRAY['f2570000-0000-0000-0000-000000000002']::uuid[]
FROM auth.users WHERE id IN('f2500000-0000-0000-0000-000000000001','f2500000-0000-0000-0000-000000000002')
ON CONFLICT(user_id) DO UPDATE SET specialty_id=EXCLUDED.specialty_id,target_institution_ids=EXCLUDED.target_institution_ids;
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f2510000-0000-0000-0000-000000000001','2198.1',2198,1,'Reprocess fixture','active');
SELECT pg_temp.fixture_publication_begin();
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,questions_count,
 execution_window_start,execution_window_end,results_release_at,status)
SELECT ('f2520000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Reprocess '||n,'f25-reprocess-'||n,n,
 'f2510000-0000-0000-0000-000000000001',2,now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','published'
FROM generate_series(1,2) n;
SELECT pg_temp.fixture_publication_end();
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
SELECT ('f2530000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2520000-0000-0000-0000-'||lpad(((n+1)/2)::text,12,'0'))::uuid,(n-1)%2+1,'Fixture','PED','Fixture'
FROM generate_series(1,4) n;
INSERT INTO public.question_options(id,question_id,label,text,is_correct)
SELECT ('f2540000-0000-0000-0000-'||lpad((n*10+o)::text,12,'0'))::uuid,
 ('f2530000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,chr(64+o),'Option '||o,o=1
FROM generate_series(1,4) n CROSS JOIN generate_series(1,4) o;
-- Six finalized attempts: two users, three modalities; plus untouched other exam.
INSERT INTO public.attempts(id,simulado_id,user_id,status,attempt_type,effective_deadline,
 finished_at,total_correct,total_answered,score_percentage,is_within_window)
SELECT ('f2550000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2520000-0000-0000-0000-'||lpad((CASE WHEN n=7 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,
 ('f2500000-0000-0000-0000-'||lpad((CASE WHEN n<=3 OR n=7 THEN 1 ELSE 2 END)::text,12,'0'))::uuid,
 CASE WHEN n=6 THEN 'expired'::public.attempt_status ELSE 'submitted'::public.attempt_status END,
 (ARRAY['online','offline','presencial'])[(n-1)%3+1],now()-interval '2 days',now()-interval '2 days',
 CASE WHEN n<=3 OR n=7 THEN 1 ELSE 0 END,1,CASE WHEN n<=3 OR n=7 THEN 50 ELSE 0 END,n%3<>2
FROM generate_series(1,7) n;
INSERT INTO public.attempt_question_results(attempt_id,question_id,selected_option_id,correct_option_id,is_correct,was_answered)
SELECT a.id,q.id,CASE WHEN q.question_number=2 THEN NULL
 ELSE ('f2540000-0000-0000-0000-'||lpad(((CASE WHEN a.simulado_id='f2520000-0000-0000-0000-000000000002' THEN 3 ELSE 1 END)*10+
 CASE WHEN a.user_id='f2500000-0000-0000-0000-000000000001' THEN 1 ELSE 2 END)::text,12,'0'))::uuid END,
 o.id,q.question_number=1 AND a.user_id='f2500000-0000-0000-0000-000000000001',q.question_number=1
FROM public.attempts a JOIN public.questions q ON q.simulado_id=a.simulado_id
JOIN public.question_options o ON o.question_id=q.id AND o.is_correct
WHERE a.id::text LIKE 'f2550000%';
INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,score_percentage,total_correct,total_answered,total_questions,finished_at)
SELECT user_id,id,simulado_id,score_percentage,total_correct,total_answered,2,finished_at
FROM public.attempts WHERE id::text LIKE 'f2550000%';
SELECT public.recalculate_user_performance(id) FROM auth.users WHERE id::text LIKE 'f2500000%';
INSERT INTO public.error_notebook(id,user_id,simulado_id,question_id,area,theme,reason,learning_text,was_correct,deleted_at,srs_reps)
SELECT ('f2560000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2500000-0000-0000-0000-'||lpad((CASE WHEN n=1 THEN 1 ELSE 2 END)::text,12,'0'))::uuid,
 'f2520000-0000-0000-0000-000000000001','f2530000-0000-0000-0000-000000000001',
 'PED','Fixture','did_not_know','Private reflection',n=1,CASE WHEN n=3 THEN now()-interval '1 day' END,4
FROM generate_series(1,4) n;
INSERT INTO public.error_notebook(id,user_id,simulado_id,question_id,area,theme,reason,learning_text,was_correct,srs_reps)
VALUES('f2560000-0000-0000-0000-000000000005','f2500000-0000-0000-0000-000000000001',
 'f2520000-0000-0000-0000-000000000001','f2530000-0000-0000-0000-000000000002',
 'PED','Fixture','did_not_know','Private reflection',false,4);
CREATE TEMP TABLE unaffected_notebook AS SELECT to_jsonb(e) data FROM public.error_notebook e
WHERE id='f2560000-0000-0000-0000-000000000005';
CREATE TEMP TABLE frozen AS SELECT id,to_jsonb(a)-ARRAY['score_percentage','total_correct'] AS data
FROM public.attempts a WHERE id::text LIKE 'f2550000%';
CREATE TEMP TABLE other_before AS SELECT to_jsonb(r) data FROM public.attempt_question_results r
JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id='f2520000-0000-0000-0000-000000000002';
CREATE TEMP TABLE manual_before AS SELECT to_jsonb(e) data FROM public.error_notebook e WHERE id='f2560000-0000-0000-0000-000000000003';
-- Operator corrects Gabarito, not the RPC. No historical migration is executed.
UPDATE public.question_options SET is_correct=label='B' WHERE question_id='f2530000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub','f2500000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE result AS SELECT public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Gabarito A to B') data;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT (data->>'attempts_processed')::int=6 AND (data->>'scores_changed')::int=6 AND NOT (data->>'idempotent')::boolean FROM result);
 ASSERT (SELECT count(*)=3 FROM public.attempts WHERE id::text LIKE 'f2550000%' AND user_id='f2500000-0000-0000-0000-000000000002' AND score_percentage=50);
 ASSERT NOT EXISTS(SELECT FROM public.attempts a JOIN frozen f USING(id) WHERE to_jsonb(a)-ARRAY['score_percentage','total_correct']<>f.data);
 ASSERT (SELECT bool_and(specialty_id_at_finish='f2570000-0000-0000-0000-000000000001'
   AND target_institution_ids_at_finish=ARRAY['f2570000-0000-0000-0000-000000000002']::uuid[]) FROM public.attempts WHERE id::text LIKE 'f2550000%');
 ASSERT NOT EXISTS(SELECT FROM public.attempts a JOIN public.user_performance_history h ON h.attempt_id=a.id WHERE a.id::text LIKE 'f2550000%' AND (a.total_correct<>h.total_correct OR a.score_percentage<>h.score_percentage));
 ASSERT (SELECT avg_score=12.50 FROM public.user_performance_summary WHERE user_id='f2500000-0000-0000-0000-000000000001');
 ASSERT (SELECT avg_score=50 FROM public.user_performance_summary WHERE user_id='f2500000-0000-0000-0000-000000000002');
 ASSERT NOT EXISTS(SELECT FROM public.error_notebook WHERE id::text LIKE 'f2560000%' AND (learning_text<>'Private reflection' OR srs_reps<>4));
 ASSERT (SELECT deleted_at IS NOT NULL AND reprocess_deleted_at=deleted_at AND was_correct FROM public.error_notebook WHERE id='f2560000-0000-0000-0000-000000000002');
 ASSERT (SELECT to_jsonb(e)-ARRAY['was_correct','updated_at']=m.data-ARRAY['was_correct','updated_at'] AND was_correct
   FROM public.error_notebook e CROSS JOIN manual_before m WHERE e.id='f2560000-0000-0000-0000-000000000003');
 ASSERT NOT EXISTS((SELECT data FROM other_before) EXCEPT (SELECT to_jsonb(r) FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id='f2520000-0000-0000-0000-000000000002'));
 ASSERT (SELECT count(*)=1 FROM fase2_private.reprocess_operations WHERE simulado_id='f2520000-0000-0000-0000-000000000001' AND operator_id=auth.uid());
 ASSERT (SELECT count(*)=2 AND max(nota_final) FILTER(WHERE user_id='f2500000-0000-0000-0000-000000000002')=50
   AND max(nota_final) FILTER(WHERE user_id='f2500000-0000-0000-0000-000000000001')=0
   FROM public.get_ranking_for_simulado('f2520000-0000-0000-0000-000000000001'));
 ASSERT NOT EXISTS(SELECT FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id
   WHERE a.simulado_id='f2520000-0000-0000-0000-000000000001'
   AND r.selected_option_id IS NULL AND (r.is_correct OR r.was_answered));
 ASSERT (SELECT to_jsonb(e)=u.data FROM public.error_notebook e CROSS JOIN unaffected_notebook u
   WHERE e.id='f2560000-0000-0000-0000-000000000005');
END $$;
CREATE TEMP TABLE stable AS SELECT
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attempt_question_results r) aqr,
 (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e) notebook,
 (SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.user_performance_summary s) summary,
 (SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h) history;
DO $$ DECLARE response jsonb; BEGIN
 response:=public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Repeat B');
 ASSERT (response->>'idempotent')::boolean AND (response->>'scores_changed')::int=0 AND (response->>'entries_reconciled')::int=0;
 ASSERT (SELECT aqr=(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attempt_question_results r)
 AND notebook=(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e)
 AND summary=(SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.user_performance_summary s)
 AND history=(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h) FROM stable);
END $$;
-- Drift isolated to summary: key/AQR/attempt/history are already correct.
-- An old timestamp makes accidental UPDATE observable inside this transaction.
UPDATE public.user_performance_summary SET updated_at=now()-interval '10 days'
WHERE user_id IN('f2500000-0000-0000-0000-000000000001','f2500000-0000-0000-0000-000000000002');
CREATE TEMP TABLE summary_reference AS SELECT * FROM public.user_performance_summary;
CREATE TEMP TABLE chain_reference AS SELECT
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a) attempts,
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attempt_question_results r) aqr,
 (SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h) history,
 (SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e) notebook;
UPDATE public.user_performance_summary SET total_attempts=999,avg_score=99,best_score=99,last_score=99,
 last_simulado_id=NULL,last_finished_at=NULL
WHERE user_id='f2500000-0000-0000-0000-000000000001';
DO $$ DECLARE response jsonb; BEGIN
 response:=public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Heal isolated wrong summary');
 ASSERT (response->>'summaries_changed')::integer=1 AND NOT (response->>'idempotent')::boolean,
   'Isolated wrong summary must be repaired and reported';
 ASSERT (response->>'scores_changed')::integer=0 AND (response->>'entries_reconciled')::integer=0;
 ASSERT (SELECT to_jsonb(s)-'updated_at'=to_jsonb(ref)-'updated_at' FROM public.user_performance_summary s
   JOIN summary_reference ref USING(user_id) WHERE s.user_id='f2500000-0000-0000-0000-000000000001');
 ASSERT (SELECT to_jsonb(s)=to_jsonb(ref) FROM public.user_performance_summary s JOIN summary_reference ref USING(user_id)
   WHERE s.user_id='f2500000-0000-0000-0000-000000000002'),'Other user summary must not be written';
END $$;
DELETE FROM public.user_performance_summary WHERE user_id='f2500000-0000-0000-0000-000000000001';
DO $$ DECLARE response jsonb; BEGIN
 response:=public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Heal isolated missing summary');
 ASSERT (response->>'summaries_changed')::integer=1 AND NOT (response->>'idempotent')::boolean,
   'Isolated missing summary must be recreated and reported';
 ASSERT (SELECT to_jsonb(s)-'updated_at'=to_jsonb(ref)-'updated_at' FROM public.user_performance_summary s
   JOIN summary_reference ref USING(user_id) WHERE s.user_id='f2500000-0000-0000-0000-000000000001');
 ASSERT (SELECT to_jsonb(s)=to_jsonb(ref) FROM public.user_performance_summary s JOIN summary_reference ref USING(user_id)
   WHERE s.user_id='f2500000-0000-0000-0000-000000000002');
 ASSERT (SELECT attempts=(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a)
   AND aqr=(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attempt_question_results r)
   AND history=(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h)
   AND notebook=(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e) FROM chain_reference);
 ASSERT (SELECT counts_after->>'summaries_changed'='1' FROM fase2_private.reprocess_operations
   WHERE operation_id=(response->>'operation_id')::uuid);
 ASSERT EXISTS(SELECT FROM public.admin_audit_log WHERE metadata->>'operation_id'=response->>'operation_id'
   AND metadata->'after'->>'summaries_changed'='1');
END $$;
UPDATE public.user_performance_summary SET updated_at=now()-interval '10 days'
WHERE user_id IN('f2500000-0000-0000-0000-000000000001','f2500000-0000-0000-0000-000000000002');
CREATE TEMP TABLE summary_noop AS SELECT to_jsonb(s) data FROM public.user_performance_summary s;
DO $$ DECLARE response jsonb; BEGIN
 -- Legacy call contract still returns void and must now avoid a no-op write.
 PERFORM public.recalculate_user_performance('f2500000-0000-0000-0000-000000000001');
 ASSERT NOT EXISTS((SELECT data FROM summary_noop) EXCEPT (SELECT to_jsonb(s) FROM public.user_performance_summary s)),
   'Legacy helper must preserve updated_at on no-op';
 response:=public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','After summary healed');
 ASSERT (response->>'idempotent')::boolean AND (response->>'summaries_changed')::integer=0;
 ASSERT NOT EXISTS((SELECT data FROM summary_noop) EXCEPT (SELECT to_jsonb(s) FROM public.user_performance_summary s));
 ASSERT (SELECT history=(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h)
   AND notebook=(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e) FROM chain_reference);
END $$;
-- A voluntary deletion AFTER automatic hiding must also survive key reversal.
UPDATE public.error_notebook SET deleted_at=now()+interval '1 second' WHERE id='f2560000-0000-0000-0000-000000000004';
CREATE TEMP TABLE later_manual AS SELECT to_jsonb(e) data FROM public.error_notebook e WHERE id='f2560000-0000-0000-0000-000000000004';
UPDATE public.question_options SET is_correct=label='A' WHERE question_id='f2530000-0000-0000-0000-000000000001';
SELECT public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Reverse B to A');
DO $$ BEGIN
 ASSERT (SELECT deleted_at IS NULL AND reprocess_deleted_at IS NULL AND NOT was_correct FROM public.error_notebook WHERE id='f2560000-0000-0000-0000-000000000002');
 ASSERT (SELECT to_jsonb(e)=m.data FROM public.error_notebook e CROSS JOIN manual_before m WHERE e.id='f2560000-0000-0000-0000-000000000003');
 ASSERT (SELECT to_jsonb(e)-ARRAY['was_correct','updated_at']=m.data-ARRAY['was_correct','updated_at']
   AND reprocess_deleted_at IS NULL AND NOT was_correct
   FROM public.error_notebook e CROSS JOIN later_manual m WHERE e.id='f2560000-0000-0000-0000-000000000004');
END $$;
-- Actual authenticated capability boundary, not owner-only positive tests.
SET LOCAL ROLE authenticated;
DO $$ DECLARE u uuid; BEGIN
 FOREACH u IN ARRAY ARRAY['f2500000-0000-0000-0000-000000000001','f2500000-0000-0000-0000-000000000004','f2500000-0000-0000-0000-000000000005']::uuid[] LOOP
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Denied'); RAISE EXCEPTION 'Unexpected authorization';
  EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','No identity'); RAISE EXCEPTION 'Unexpected authorization';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','f2500000-0000-0000-0000-000000000003',true);
-- Every negative call is a subtransaction; compare ALL affected tables/audit.
CREATE FUNCTION pg_temp.state() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.attempts t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.attempt_question_results t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.user_performance_history t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM public.user_performance_summary t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.error_notebook t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY operation_id) FROM fase2_private.reprocess_operations t),
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.admin_audit_log t)) $$;
-- Summary is the ONLY changed part of the chain; audit failure must restore
-- even a newly inserted (previously missing) summary and operation checkpoint.
CREATE FUNCTION pg_temp.fail_summary_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 ASSERT NEW.metadata->'after'->>'summaries_changed'='1';
 ASSERT NEW.metadata->'after'->>'results_changed'='0'
   AND NEW.metadata->'after'->>'history_changed'='0'
   AND NEW.metadata->'after'->>'scores_changed'='0'
   AND NEW.metadata->'after'->>'entries_reconciled'='0';
 ASSERT (SELECT total_attempts=4 AND avg_score=50 FROM public.user_performance_summary
   WHERE user_id='f2500000-0000-0000-0000-000000000001'),'Helper must repair before audit fails';
 RAISE EXCEPTION 'Injected summary-only audit failure';
END $$;
CREATE TRIGGER reprocess_summary_failure BEFORE INSERT ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_summary_audit();
DO $$ DECLARE missing boolean; before jsonb; BEGIN
 FOREACH missing IN ARRAY ARRAY[false,true] LOOP
  BEGIN
   IF missing THEN
    DELETE FROM public.user_performance_summary WHERE user_id='f2500000-0000-0000-0000-000000000001';
   ELSE
    UPDATE public.user_performance_summary SET total_attempts=999,avg_score=99
      WHERE user_id='f2500000-0000-0000-0000-000000000001';
   END IF;
   before:=pg_temp.state();
   BEGIN
    PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Summary-only audit rollback');
    RAISE EXCEPTION 'Summary failure not injected';
   EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Injected summary-only audit failure' THEN RAISE; END IF;
   END;
   ASSERT before=pg_temp.state(),'Summary-only failure must revert summary/audit/checkpoint and all other rows';
   RAISE SQLSTATE 'Z2501'; -- Restore deliberate fixture drift, not just RPC writes.
  EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 END LOOP;
END $$;
DROP TRIGGER reprocess_summary_failure ON public.admin_audit_log;
CREATE FUNCTION pg_temp.refusal() RETURNS void LANGUAGE plpgsql AS $$
DECLARE before jsonb:=pg_temp.state(); BEGIN
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Invalid fixture');
   RAISE EXCEPTION 'Expected validation refusal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT before=pg_temp.state(),'Validation refusal must write nothing';
END $$;
DO $$ BEGIN
 BEGIN
  UPDATE public.simulados SET questions_count=3 WHERE id='f2520000-0000-0000-0000-000000000001';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 BEGIN
  DELETE FROM public.attempt_question_results WHERE attempt_id='f2550000-0000-0000-0000-000000000001'
    AND question_id='f2530000-0000-0000-0000-000000000001';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 BEGIN
  UPDATE public.attempt_question_results SET selected_option_id='f2540000-0000-0000-0000-000000000021'
    WHERE attempt_id='f2550000-0000-0000-0000-000000000001' AND question_id='f2530000-0000-0000-0000-000000000001';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 BEGIN
  UPDATE public.attempt_question_results SET question_id='f2530000-0000-0000-0000-000000000003'
    WHERE attempt_id='f2550000-0000-0000-0000-000000000001' AND question_id='f2530000-0000-0000-0000-000000000001';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 BEGIN
  UPDATE public.attempts SET status='in_progress' WHERE id='f2550000-0000-0000-0000-000000000001';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
 BEGIN
  DELETE FROM public.question_options WHERE id='f2540000-0000-0000-0000-000000000014';
  PERFORM pg_temp.refusal(); RAISE SQLSTATE 'Z2501';
 EXCEPTION WHEN SQLSTATE 'Z2501' THEN NULL; END;
END $$;
DO $$ DECLARE before jsonb; BEGIN
 before:=pg_temp.state();
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001',' '); RAISE EXCEPTION 'Expected reason refusal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT before=pg_temp.state();
 UPDATE public.simulados SET execution_window_end=now()+interval '1 day',results_release_at=now()+interval '2 days' WHERE id='f2520000-0000-0000-0000-000000000001';
 before:=pg_temp.state();
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Open'); RAISE EXCEPTION 'Expected open refusal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT before=pg_temp.state();
 UPDATE public.simulados SET execution_window_end=now()-interval '2 days',results_release_at=now()-interval '1 day' WHERE id='f2520000-0000-0000-0000-000000000001';
 UPDATE public.question_options SET is_correct=label IN('A','B') WHERE question_id='f2530000-0000-0000-0000-000000000001';
 before:=pg_temp.state();
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Invalid key'); RAISE EXCEPTION 'Expected key refusal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT before=pg_temp.state();
 UPDATE public.question_options SET is_correct=false WHERE question_id='f2530000-0000-0000-0000-000000000001';
 before:=pg_temp.state();
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Missing key'); RAISE EXCEPTION 'Expected key refusal';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 ASSERT before=pg_temp.state();
 UPDATE public.question_options SET is_correct=label='B' WHERE question_id='f2530000-0000-0000-0000-000000000001';
END $$;
CREATE FUNCTION pg_temp.fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected failure'; END $$;
CREATE TRIGGER reprocess_test_failure BEFORE INSERT ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail();
DO $$ DECLARE before jsonb:=pg_temp.state(); BEGIN
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Audit failure'); RAISE EXCEPTION 'Failure not injected';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Injected failure' THEN RAISE; END IF; END;
 ASSERT before=pg_temp.state(),'Audit failure must roll back every write';
END $$;
DROP TRIGGER reprocess_test_failure ON public.admin_audit_log;
CREATE TRIGGER reprocess_test_failure BEFORE UPDATE ON public.user_performance_history FOR EACH ROW EXECUTE FUNCTION pg_temp.fail();
DO $$ DECLARE before jsonb:=pg_temp.state(); BEGIN
 BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Mid-calculation failure'); RAISE EXCEPTION 'Failure not injected';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Injected failure' THEN RAISE; END IF; END;
 ASSERT before=pg_temp.state(),'History failure must roll back every write';
END $$;
DROP TRIGGER reprocess_test_failure ON public.user_performance_history;
DO $$ BEGIN
 BEGIN UPDATE public.attempts SET target_institution_ids_at_finish=ARRAY[gen_random_uuid()] WHERE id='f2550000-0000-0000-0000-000000000001';
 RAISE EXCEPTION 'Snapshot guard missing'; EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'finished attempt snapshot is immutable' THEN RAISE; END IF; END;
 ASSERT NOT has_function_privilege('anon','public.admin_reprocess_simulado(uuid,text)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','fase2_private.reprocess_operations','SELECT');
 ASSERT NOT has_table_privilege('authenticated','fase2_private.reprocess_ddl_checkpoint','SELECT');
END $$;
ROLLBACK;
\echo 'F2-5 regression assertions passed; fixtures rolled back'
