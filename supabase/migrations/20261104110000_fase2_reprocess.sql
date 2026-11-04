-- F2-5 only. The operator corrects Gabarito separately; this never edits content.
BEGIN;
CREATE SCHEMA IF NOT EXISTS fase2_private;
REVOKE ALL ON SCHEMA fase2_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS fase2_private.reprocess_operations (
 operation_id uuid PRIMARY KEY,
 simulado_id uuid NOT NULL,
 operator_id uuid NOT NULL,
 reason text NOT NULL CHECK (btrim(reason)<>''),
 answer_key_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 counts_before jsonb NOT NULL,
 counts_after jsonb,
 checkpoint jsonb NOT NULL
);
ALTER TABLE fase2_private.reprocess_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fase2_private.reprocess_operations FROM PUBLIC, anon, authenticated, service_role;

-- Keep the live authoritative calculation, signature, owner and ACL. Only add
-- a semantic no-op predicate to the inspected upsert; unknown tails fail closed
-- rather than silently replacing a newer formula with a copied implementation.
CREATE TABLE IF NOT EXISTS fase2_private.reprocess_ddl_checkpoint (
 signature text PRIMARY KEY, definition text NOT NULL
);
ALTER TABLE fase2_private.reprocess_ddl_checkpoint ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fase2_private.reprocess_ddl_checkpoint FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE
 v_definition text; v_source text;
 v_tail text := 'ON CONFLICT (user_id) DO UPDATE SET total_attempts = EXCLUDED.total_attempts, avg_score = EXCLUDED.avg_score, best_score = EXCLUDED.best_score, last_score = EXCLUDED.last_score, last_simulado_id = EXCLUDED.last_simulado_id, last_finished_at = EXCLUDED.last_finished_at, updated_at = now(); END;';
 v_predicate text := 'WHERE ROW(public.user_performance_summary.total_attempts,
   public.user_performance_summary.avg_score,public.user_performance_summary.best_score,
   public.user_performance_summary.last_score,public.user_performance_summary.last_simulado_id,
   public.user_performance_summary.last_finished_at) IS DISTINCT FROM
   ROW(EXCLUDED.total_attempts,EXCLUDED.avg_score,EXCLUDED.best_score,
     EXCLUDED.last_score,EXCLUDED.last_simulado_id,EXCLUDED.last_finished_at);';
BEGIN
 SELECT pg_get_functiondef(p.oid),btrim(regexp_replace(p.prosrc,'[[:space:]]+',' ','g'))
 INTO STRICT v_definition,v_source FROM pg_proc p
 WHERE p.oid='public.recalculate_user_performance(uuid)'::regprocedure;
 INSERT INTO fase2_private.reprocess_ddl_checkpoint(signature,definition)
 VALUES('public.recalculate_user_performance(uuid)',v_definition) ON CONFLICT(signature) DO NOTHING;
 IF position(v_predicate IN v_definition)=0 THEN
   IF right(v_source,length(v_tail))<>v_tail THEN
     RAISE EXCEPTION 'Unrecognized summary helper upsert; inspect live definition before applying F2-5';
   END IF;
   EXECUTE regexp_replace(v_definition,'updated_at[[:space:]]*=[[:space:]]*now\(\)[[:space:]]*;',
     'updated_at = now()' || chr(10) || '  ' || v_predicate);
 END IF;
END $patch$;

-- Existing deleted_at values have unknown/manual provenance. Never adopt them.
ALTER TABLE public.error_notebook ADD COLUMN IF NOT EXISTS reprocess_deleted_at timestamptz;
CREATE OR REPLACE FUNCTION fase2_private.guard_notebook_origin()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_user NOT IN ('postgres','supabase_admin') AND (
   (TG_OP='INSERT' AND NEW.reprocess_deleted_at IS NOT NULL) OR
   (TG_OP='UPDATE' AND NEW.reprocess_deleted_at IS DISTINCT FROM OLD.reprocess_deleted_at)) THEN
   RAISE EXCEPTION 'Reprocess provenance is private' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
   AND NEW.reprocess_deleted_at IS NOT DISTINCT FROM OLD.reprocess_deleted_at THEN
   NEW.reprocess_deleted_at:=NULL;
 END IF;
 IF NEW.reprocess_deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM NEW.reprocess_deleted_at THEN
   RAISE EXCEPTION 'Invalid reprocess deletion provenance' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION fase2_private.guard_notebook_origin() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS reprocess_notebook_origin ON public.error_notebook;
CREATE TRIGGER reprocess_notebook_origin BEFORE INSERT OR UPDATE ON public.error_notebook
FOR EACH ROW EXECUTE FUNCTION fase2_private.guard_notebook_origin();

CREATE OR REPLACE FUNCTION public.admin_reprocess_simulado(p_simulado_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 sim public.simulados%ROWTYPE; v_users uuid[]; n integer; option_count integer; processed integer;
 changed integer:=0; reconciled integer:=0; dirty integer:=0; history_dirty integer:=0; summary_dirty integer:=0;
 op uuid:=gen_random_uuid(); key_hash text; checkpoint jsonb; uid uuid; v_entry record;
 before_counts jsonb; after_counts jsonb; summary_before jsonb; summary_after jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage');
 PERFORM public.admin_require('attempts.manage');
 IF p_simulado_id IS NULL OR p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>2000 THEN
   RAISE EXCEPTION 'Simulado and reason (1..2000 characters) required' USING ERRCODE='22023';
 END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
   RAISE EXCEPTION 'Reprocess requires READ COMMITTED' USING ERRCODE='25001';
 END IF;

 -- Finalizer takes attempt -> parent SHARE (F1 trigger). Never wait for content
 -- after taking attempts: a content writer can already own a question/option
 -- while waiting for its parent. NOWAIT makes that inversion a retry, not a
 -- deadlock. Lock users and ALL their attempts to serialize summary writers
 -- across exams; auth.users FK also fences newly inserted attempts for them.
 SELECT coalesce(array_agg(DISTINCT user_id ORDER BY user_id),'{}'::uuid[]) INTO v_users
 FROM public.attempts WHERE simulado_id=p_simulado_id;
 PERFORM 1 FROM auth.users WHERE id=ANY(v_users) ORDER BY id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.attempts WHERE user_id=ANY(v_users) ORDER BY id FOR UPDATE NOWAIT;
 SELECT * INTO sim FROM public.simulados WHERE id=p_simulado_id FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Simulado not found' USING ERRCODE='22023'; END IF;
 -- A creator may have committed between the initial scan and the parent lock.
 IF EXISTS(SELECT FROM public.attempts WHERE simulado_id=sim.id AND NOT(user_id=ANY(v_users))) THEN
   RAISE EXCEPTION 'Concurrent attempt creation; retry' USING ERRCODE='55P03';
 END IF;
 IF sim.execution_window_end IS NULL OR sim.execution_window_end>=now() THEN
   RAISE EXCEPTION 'Execution window must be closed' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT FROM public.attempts WHERE simulado_id=sim.id
   AND (status NOT IN ('submitted','expired') OR finished_at IS NULL OR score_percentage IS NULL
     OR target_institution_ids_at_finish IS NULL)) THEN
   RAISE EXCEPTION 'Unfinished/inconsistent attempts; legacy backlog is not reprocessed' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM public.questions WHERE simulado_id=sim.id ORDER BY id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.question_options WHERE question_id IN
   (SELECT id FROM public.questions WHERE simulado_id=sim.id) ORDER BY id FOR UPDATE NOWAIT;
 SELECT count(*) INTO n FROM public.questions WHERE simulado_id=sim.id;
 SELECT CASE WHEN (format->>'options') ~ '^[1-9][0-9]?$' THEN (format->>'options')::integer END
 INTO option_count FROM public.exam_editions WHERE id=sim.edition_id FOR SHARE NOWAIT;
 IF n=0 OR option_count IS NULL OR option_count NOT BETWEEN 2 AND 26 OR sim.questions_count IS DISTINCT FROM n
   OR (SELECT count(DISTINCT question_number) FROM public.questions WHERE simulado_id=sim.id)<>n
   OR EXISTS(SELECT FROM public.questions WHERE simulado_id=sim.id
     AND (question_number NOT BETWEEN 1 AND n OR text IS NULL OR btrim(text)='')) OR EXISTS (
   SELECT q.id FROM public.questions q LEFT JOIN public.question_options o ON o.question_id=q.id
   WHERE q.simulado_id=sim.id GROUP BY q.id
   HAVING count(o.id)<>option_count OR count(*) FILTER(WHERE o.is_correct)<>1
     OR count(DISTINCT o.label)<>count(o.id)
     OR bool_or(o.label IS NULL OR o.label !~ '^[A-Z]$' OR ascii(o.label)-ascii('A') NOT BETWEEN 0 AND option_count-1
       OR o.text IS NULL OR btrim(o.text)='')) THEN
   RAISE EXCEPTION 'Incomplete/inconsistent answer key or question count' USING ERRCODE='22023';
 END IF;
 SELECT encode(sha256(convert_to(string_agg(q.id::text||':'||o.id::text,',' ORDER BY q.id),'UTF8')),'hex')
 INTO key_hash FROM public.questions q JOIN public.question_options o ON o.question_id=q.id AND o.is_correct
 WHERE q.simulado_id=sim.id;

 PERFORM 1 FROM public.attempt_question_results WHERE attempt_id IN
   (SELECT id FROM public.attempts WHERE simulado_id=sim.id) ORDER BY id FOR UPDATE NOWAIT;
 IF EXISTS (SELECT FROM public.attempts a WHERE a.simulado_id=sim.id AND (
   (SELECT count(*) FROM public.attempt_question_results r WHERE r.attempt_id=a.id)<>n
   OR a.total_answered IS DISTINCT FROM (SELECT count(*)::integer FROM public.attempt_question_results r
     WHERE r.attempt_id=a.id AND r.selected_option_id IS NOT NULL)
   OR EXISTS(SELECT FROM public.attempt_question_results r LEFT JOIN public.questions q ON q.id=r.question_id
     LEFT JOIN public.question_options o ON o.id=r.selected_option_id
     WHERE r.attempt_id=a.id AND (q.simulado_id IS DISTINCT FROM sim.id
       OR (r.selected_option_id IS NOT NULL AND o.question_id IS DISTINCT FROM r.question_id)))
   OR NOT EXISTS(SELECT FROM public.user_performance_history h WHERE h.attempt_id=a.id
     AND h.user_id=a.user_id AND h.simulado_id=a.simulado_id AND h.finished_at=a.finished_at))) THEN
   RAISE EXCEPTION 'Incomplete/inconsistent results, answers or history' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM public.user_performance_history WHERE user_id=ANY(v_users) ORDER BY id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.user_performance_summary WHERE user_id=ANY(v_users) ORDER BY user_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.error_notebook e WHERE e.simulado_id=sim.id AND e.user_id=ANY(v_users)
   AND e.question_id IN (SELECT id FROM public.questions WHERE simulado_id=sim.id) ORDER BY e.id FOR UPDATE NOWAIT;

 SELECT count(*) INTO processed FROM public.attempts WHERE simulado_id=sim.id;
 SELECT jsonb_build_object('attempts',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.attempts a WHERE simulado_id=sim.id),'[]'),
   'results',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attempt_question_results r WHERE attempt_id IN (SELECT id FROM public.attempts WHERE simulado_id=sim.id)),'[]'),
   'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM public.user_performance_history h WHERE simulado_id=sim.id),'[]'),
   'summary',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) FROM public.user_performance_summary s WHERE user_id=ANY(v_users)),'[]'),
   'notebook',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.error_notebook e WHERE simulado_id=sim.id AND user_id=ANY(v_users)
     AND question_id IN(SELECT id FROM public.questions WHERE simulado_id=sim.id)),'[]')) INTO checkpoint;
 before_counts:=jsonb_build_object('attempts',processed,'summaries_present',
   (SELECT count(*) FROM public.user_performance_summary WHERE user_id=ANY(v_users)),'correct',
   (SELECT coalesce(sum(total_correct),0) FROM public.attempts WHERE simulado_id=sim.id));
 INSERT INTO fase2_private.reprocess_operations(operation_id,simulado_id,operator_id,reason,answer_key_hash,counts_before,checkpoint)
 VALUES(op,sim.id,auth.uid(),btrim(p_reason),key_hash,before_counts,checkpoint);

 UPDATE public.attempt_question_results r SET correct_option_id=o.id,
   is_correct=coalesce(r.selected_option_id=o.id,false),was_answered=r.selected_option_id IS NOT NULL
 FROM public.questions q JOIN public.question_options o ON o.question_id=q.id AND o.is_correct
 WHERE q.simulado_id=sim.id AND r.question_id=q.id
   AND r.attempt_id IN(SELECT id FROM public.attempts WHERE simulado_id=sim.id)
   AND ROW(r.correct_option_id,r.is_correct,r.was_answered) IS DISTINCT FROM
     ROW(o.id,coalesce(r.selected_option_id=o.id,false),r.selected_option_id IS NOT NULL);
 GET DIAGNOSTICS dirty=ROW_COUNT;
 UPDATE public.attempts a SET total_correct=c.correct,score_percentage=round(c.correct*100.0/n,2)
 FROM (SELECT r.attempt_id,count(*) FILTER(WHERE r.is_correct)::integer correct
   FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id
   WHERE a.simulado_id=sim.id GROUP BY r.attempt_id) c
 WHERE a.id=c.attempt_id AND ROW(a.total_correct,a.score_percentage) IS DISTINCT FROM ROW(c.correct,round(c.correct*100.0/n,2));
 GET DIAGNOSTICS changed=ROW_COUNT;
 UPDATE public.user_performance_history h SET total_correct=a.total_correct,
   score_percentage=a.score_percentage,total_answered=a.total_answered,total_questions=n
 FROM public.attempts a WHERE h.attempt_id=a.id AND a.simulado_id=sim.id
 AND ROW(h.total_correct,h.score_percentage,h.total_answered,h.total_questions)
   IS DISTINCT FROM ROW(a.total_correct,a.score_percentage,a.total_answered,n);
 GET DIAGNOSTICS history_dirty=ROW_COUNT;
 -- Always use the authoritative helper, including isolated missing/stale
 -- summaries. Its conditional upsert preserves updated_at on semantic no-op.
 -- Count actual row changes without duplicating its calculation here.
 FOREACH uid IN ARRAY v_users LOOP
   SELECT to_jsonb(s) INTO summary_before FROM public.user_performance_summary s WHERE user_id=uid;
   PERFORM public.recalculate_user_performance(uid);
   SELECT to_jsonb(s) INTO summary_after FROM public.user_performance_summary s WHERE user_id=uid;
   IF summary_before IS DISTINCT FROM summary_after THEN summary_dirty:=summary_dirty+1; END IF;
 END LOOP;

 -- No attempt_id exists on notebook entries. Resolve the user's latest
 -- finalized attempt for this exam (finished_at DESC, id DESC tie breaker).
 -- Reconcile only questions whose AQR changed in THIS operation.
 FOR v_entry IN SELECT e.id,e.was_correct,e.deleted_at,e.reprocess_deleted_at,x.is_correct
 FROM public.error_notebook e JOIN LATERAL (
   SELECT qr.is_correct FROM public.attempts a JOIN public.attempt_question_results qr ON qr.attempt_id=a.id
   WHERE a.user_id=e.user_id AND a.simulado_id=sim.id AND qr.question_id=e.question_id
   ORDER BY a.finished_at DESC,a.id DESC LIMIT 1) x ON true
 WHERE e.simulado_id=sim.id AND e.user_id=ANY(v_users)
 AND EXISTS(SELECT FROM public.attempt_question_results qr JOIN public.attempts a ON a.id=qr.attempt_id
   JOIN jsonb_array_elements(checkpoint->'results') old ON old->>'id'=qr.id::text
   WHERE a.user_id=e.user_id AND qr.question_id=e.question_id AND a.simulado_id=sim.id
     AND ROW(qr.correct_option_id,qr.is_correct,qr.was_answered) IS DISTINCT FROM
       ROW((old->>'correct_option_id')::uuid,(old->>'is_correct')::boolean,(old->>'was_answered')::boolean))
 ORDER BY e.id LOOP
   IF v_entry.deleted_at IS NOT NULL AND v_entry.reprocess_deleted_at IS NULL THEN
     -- Manual deletion remains manual, including its timestamp; correctness
     -- still reflects the current key without resurrecting the entry.
     IF v_entry.was_correct IS DISTINCT FROM v_entry.is_correct THEN
       UPDATE public.error_notebook SET was_correct=v_entry.is_correct WHERE id=v_entry.id;
       reconciled:=reconciled+1;
     END IF;
     CONTINUE;
   END IF;
   IF v_entry.was_correct IS DISTINCT FROM v_entry.is_correct OR (v_entry.is_correct AND v_entry.deleted_at IS NULL)
     OR (NOT v_entry.is_correct AND v_entry.reprocess_deleted_at IS NOT NULL) THEN
     UPDATE public.error_notebook SET was_correct=v_entry.is_correct,
       deleted_at=CASE WHEN v_entry.is_correct THEN coalesce(v_entry.deleted_at,now()) ELSE NULL END,
       reprocess_deleted_at=CASE WHEN v_entry.is_correct THEN coalesce(v_entry.deleted_at,now()) ELSE NULL END
     WHERE id=v_entry.id;
     reconciled:=reconciled+1;
   END IF;
 END LOOP;
 after_counts:=jsonb_build_object('attempts',processed,'summaries_present',
   (SELECT count(*) FROM public.user_performance_summary WHERE user_id=ANY(v_users)),'summaries_changed',summary_dirty,'correct',
   (SELECT coalesce(sum(total_correct),0) FROM public.attempts WHERE simulado_id=sim.id),
   'scores_changed',changed,'entries_reconciled',reconciled,'results_changed',dirty,'history_changed',history_dirty);
 UPDATE fase2_private.reprocess_operations SET counts_after=after_counts WHERE operation_id=op;
 PERFORM public.admin_log_action('REPROCESS','simulados',sim.id,'Audited raw-score reprocess',
   jsonb_build_object('operation_id',op,'reason',btrim(p_reason),'answer_key_hash',key_hash,
     'before',before_counts,'after',after_counts));
 RETURN jsonb_build_object('operation_id',op,'simulado_id',sim.id,'answer_key_hash',key_hash,
   'attempts_processed',processed,'scores_changed',changed,'entries_reconciled',reconciled,'summaries_changed',summary_dirty,
   'idempotent',dirty=0 AND changed=0 AND history_dirty=0 AND reconciled=0 AND summary_dirty=0);
END $$;
REVOKE ALL ON FUNCTION public.admin_reprocess_simulado(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_reprocess_simulado(uuid,text) TO authenticated;
COMMIT;

-- ROLLBACK (manual, data-preserving; roll back callers first):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.admin_reprocess_simulado(uuid,text);
-- DO $rollback$ BEGIN
--   EXECUTE (SELECT definition FROM fase2_private.reprocess_ddl_checkpoint
--     WHERE signature='public.recalculate_user_performance(uuid)');
-- END $rollback$;
-- COMMIT;
-- Keep private operations, notebook provenance and its guard. They preserve
-- audit evidence and distinguish manual deletions; never drop/reset their data.
-- Reapply this migration to restore the RPC without changing student rows.
