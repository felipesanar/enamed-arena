-- Authorized recovery: the before_f1 preview rolled back after legitimate
-- offline activity, but 065001 subsequently assigned the new exam to 2026.
-- Run only with editions_ui=false. No grade repair, renumbering or alias edits.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $repair$
DECLARE
 t text; obj oid; target record; s7 record; edition uuid; legacy uuid; n integer;
 original_target jsonb; original_s7 jsonb; prior jsonb; before_action jsonb;
 target_state_before jsonb; s7_state_before jsonb; attempts_before jsonb; attempts_after jsonb;
 guard_definition text; guard_state "char"; trigger_catalog jsonb; functions_before jsonb;
 mapping jsonb := '{}'::jsonb; stage_action jsonb; captured timestamptz:=transaction_timestamp();
BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Repair requires postgres without JWT actor';
 END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  RAISE EXCEPTION 'Model migration history is required';
 END IF;
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261104065001')
  OR NOT EXISTS(SELECT FROM public.app_config WHERE key='editions_ui' AND value='false'::jsonb) THEN
  RAISE EXCEPTION 'Requires registered 065001 and editions_ui=false';
 END IF;
 FOREACH t IN ARRAY ARRAY['simulados','attempts','answers','attempt_question_results',
  'user_performance_history','user_performance_summary','error_notebook','questions',
  'question_options','onboarding_profiles','profiles','actions'] LOOP
  obj:=to_regclass('backup.rollout_20261104_'||t);
  IF obj IS NULL OR NOT EXISTS(SELECT FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
   WHERE c.oid=obj AND c.relkind='r' AND c.relrowsecurity AND r.rolname IN('postgres','supabase_admin'))
   OR has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE')
   OR has_table_privilege('authenticated',obj,'SELECT,INSERT,UPDATE,DELETE')
   OR has_table_privilege('service_role',obj,'SELECT,INSERT,UPDATE,DELETE') THEN
   RAISE EXCEPTION 'Missing or unsafe original snapshot: %',t;
  END IF;
 END LOOP;
 -- Freeze all relevant writers before the stage checkpoint or temporary guard change.
 LOCK TABLE public.simulados,public.attempts IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 LOCK TABLE public.answers,public.attempt_question_results,public.user_performance_history,
  public.user_performance_summary,public.error_notebook,public.questions,public.question_options,
  public.onboarding_profiles,public.profiles,public.exam_editions,public.app_config,
  backup.rollout_20261104_actions IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 IF NOT EXISTS(SELECT FROM public.app_config WHERE key='editions_ui' AND value='false'::jsonb) THEN
  RAISE EXCEPTION 'editions_ui must remain false';
 END IF;
 SELECT id INTO STRICT edition FROM public.exam_editions WHERE code='2027.1';
 SELECT id INTO STRICT legacy FROM public.exam_editions WHERE code='2026';
 SELECT * INTO STRICT target FROM public.simulados WHERE slug='enamed-2027-simulado-1';
 SELECT * INTO STRICT s7 FROM public.simulados WHERE slug='simulado-7' AND sequence_number=7;
 SELECT to_jsonb(b) INTO STRICT original_target FROM backup.rollout_20261104_simulados b
  WHERE b.id=target.id AND b.slug='enamed-2027-simulado-1' AND b.sequence_number=8;
 SELECT to_jsonb(b) INTO STRICT original_s7 FROM backup.rollout_20261104_simulados b
  WHERE b.id=s7.id AND b.slug='simulado-7' AND b.sequence_number=7;
 SELECT details INTO prior FROM backup.rollout_20261104_actions WHERE action='repair_initial_assignment';
 SELECT details INTO before_action FROM backup.rollout_20261104_actions WHERE action='before_f1';
 SELECT details INTO stage_action FROM backup.rollout_20261104_actions WHERE action='live_activity_checkpoint';
 IF (to_jsonb(target)-ARRAY['edition_id','source_simulado_id','updated_at','sequence_number'])
    IS DISTINCT FROM (original_target-ARRAY['edition_id','source_simulado_id','updated_at','sequence_number'])
  OR (to_jsonb(s7)-ARRAY['edition_id','source_simulado_id','updated_at','results_release_at'])
    IS DISTINCT FROM (original_s7-ARRAY['edition_id','source_simulado_id','updated_at','results_release_at'])
  OR (SELECT count(*) FROM public.attempts WHERE simulado_id=target.id)<>2
  OR (SELECT count(*) FROM backup.rollout_20261104_attempts WHERE simulado_id=target.id)<>2
  OR EXISTS(SELECT FROM public.attempts a LEFT JOIN backup.rollout_20261104_attempts b ON b.id=a.id
   WHERE a.simulado_id=target.id AND (b.id IS NULL OR
    ((SELECT jsonb_object_agg(k,to_jsonb(a)->k) FROM jsonb_object_keys(to_jsonb(b)) k)-'updated_at')
      IS DISTINCT FROM (to_jsonb(b)-'updated_at')))
  OR EXISTS(SELECT FROM public.attempts WHERE simulado_id=target.id AND
   (score_percentage IS NOT NULL OR finished_at IS NOT NULL OR status IN('submitted','expired')
    OR effective_deadline>clock_timestamp() OR created_at>clock_timestamp()-interval '30 minutes'
    OR specialty_id_at_finish IS NOT NULL OR target_institution_ids_at_finish IS NOT NULL OR snapshot_backfilled))
  OR EXISTS(SELECT FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id=target.id)
  OR EXISTS(SELECT FROM public.user_performance_history WHERE simulado_id=target.id) THEN
  RAISE EXCEPTION 'Target or its original two inactive unscored attempts changed';
 END IF;
 SELECT pg_get_triggerdef(oid),tgenabled INTO guard_definition,guard_state FROM pg_trigger
  WHERE tgrelid='public.simulados'::regclass AND tgname='trg_simulado_edition_change'
   AND tgfoid=to_regprocedure('public.enforce_simulado_edition_change()') AND tgtype=19;
 IF guard_definition IS NULL OR guard_state<>'O'
  OR (SELECT count(*) FROM pg_trigger WHERE tgenabled='O' AND
   ((tgrelid='public.attempts'::regclass AND tgname='trg_prevent_direct_attempts_update'
      AND tgfoid=to_regprocedure('public.prevent_direct_attempts_update()'))
    OR (tgrelid='public.attempts'::regclass AND tgname='trg_attempt_edition_snapshot'
      AND tgfoid=to_regprocedure('public.enforce_attempt_edition_snapshot()'))
    OR (tgrelid='public.answers'::regclass AND tgname='trg_enforce_answer_integrity'
      AND tgfoid=to_regprocedure('public.enforce_answer_integrity()'))))<>3 THEN
  RAISE EXCEPTION 'Requires active original inverse, snapshot and F0 integrity guards';
 END IF;
 FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','user_performance_history',
  'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
  mapping:=mapping||jsonb_build_object(t,'backup.rollout_20261104_stage_'||t);
 END LOOP;
 IF prior IS NOT NULL THEN
  IF before_action->'recovered_after_model' IS DISTINCT FROM 'true'::jsonb
   OR prior->>'target_simulado_id' IS DISTINCT FROM target.id::text
   OR prior->>'target_edition_id' IS DISTINCT FROM edition::text
   OR stage_action->'table_mapping' IS DISTINCT FROM mapping
   OR target.edition_id IS DISTINCT FROM edition
   OR NOT(target.sequence_number=8 OR (target.sequence_number=1 AND EXISTS(SELECT FROM backup.rollout_20261104_actions WHERE action='after_f1')))
   OR s7.results_release_at IS DISTINCT FROM s7.execution_window_end
   OR EXISTS(SELECT FROM public.attempts WHERE simulado_id=target.id AND edition_id IS DISTINCT FROM edition) THEN
   RAISE EXCEPTION 'Existing repair checkpoint does not match current state';
  END IF;
  FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','user_performance_history',
   'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
   obj:=to_regclass('backup.rollout_20261104_stage_'||t);
   IF obj IS NULL OR NOT EXISTS(SELECT FROM pg_class WHERE oid=obj AND relrowsecurity AND relowner='postgres'::regrole)
    OR has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated',obj,'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('service_role',obj,'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Missing or unsafe stage checkpoint: %',t;
   END IF;
  END LOOP;
  RETURN; -- Completed repair: verification only, never overwrite evidence.
 END IF;
 IF before_action IS NOT NULL OR stage_action IS NOT NULL OR target.edition_id IS DISTINCT FROM legacy
  OR target.sequence_number<>8 OR s7.edition_id IS DISTINCT FROM legacy
  OR s7.results_release_at IS DISTINCT FROM (original_s7->>'results_release_at')::timestamptz
  OR s7.results_release_at IS NULL OR s7.execution_window_start IS NULL OR s7.execution_window_end IS NULL
  OR NOT isfinite(s7.results_release_at) OR NOT isfinite(s7.execution_window_start) OR NOT isfinite(s7.execution_window_end)
  OR s7.execution_window_start>=s7.execution_window_end
  OR EXISTS(SELECT FROM public.attempts WHERE simulado_id=target.id AND edition_id IS DISTINCT FROM legacy) THEN
  RAISE EXCEPTION 'Not the reviewed missing initial assignment recovery state';
 END IF;
 SELECT to_jsonb(target),to_jsonb(s7) INTO target_state_before,s7_state_before;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO attempts_before FROM public.attempts a WHERE simulado_id=target.id;
 SELECT jsonb_object_agg(t.oid::text,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)) INTO trigger_catalog
  FROM pg_trigger t WHERE t.tgrelid IN('public.simulados'::regclass,'public.attempts'::regclass,'public.answers'::regclass);
 SELECT jsonb_object_agg(p.oid::text,md5(pg_get_functiondef(p.oid))) INTO functions_before
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f';
 FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','user_performance_history',
  'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
  IF to_regclass('backup.rollout_20261104_stage_'||t) IS NOT NULL THEN
   RAISE EXCEPTION 'Unreviewed preexisting stage snapshot: %',t;
  END IF;
  EXECUTE format('CREATE TABLE backup.rollout_20261104_stage_%1$I AS SELECT (jsonb_populate_record(NULL::backup.rollout_20261104_%1$I,to_jsonb(c))).* FROM public.%1$I c',t);
  EXECUTE format('ALTER TABLE backup.rollout_20261104_stage_%I OWNER TO postgres',t);
  EXECUTE format('ALTER TABLE backup.rollout_20261104_stage_%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON backup.rollout_20261104_stage_%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
 INSERT INTO backup.rollout_20261104_actions(action,details,captured_at) VALUES('live_activity_checkpoint',
  jsonb_build_object('version',1,'reason','legitimate_activity_after_original_snapshot','captured_at',captured,
   'table_mapping',mapping,'source','pre_repair_owner_locked_snapshot',
   'original_snapshot_prefix','backup.rollout_20261104_','stage_snapshot_prefix','backup.rollout_20261104_stage_'),captured);

 -- The only disabled guard, inside the same transaction holding all writer locks.
 ALTER TABLE public.simulados DISABLE TRIGGER trg_simulado_edition_change;
 UPDATE public.simulados SET edition_id=edition WHERE id=target.id AND edition_id=legacy;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Expected exactly one parent edition repair'; END IF;
 UPDATE public.attempts SET edition_id=edition WHERE simulado_id=target.id AND edition_id=legacy;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>2 THEN RAISE EXCEPTION 'Expected exactly two child edition repairs'; END IF;
 ALTER TABLE public.simulados ENABLE TRIGGER trg_simulado_edition_change;
 UPDATE public.simulados SET results_release_at=execution_window_end WHERE id=s7.id AND results_release_at<execution_window_end;
 IF guard_definition IS DISTINCT FROM (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.simulados'::regclass AND tgname='trg_simulado_edition_change')
  OR guard_state IS DISTINCT FROM (SELECT tgenabled FROM pg_trigger WHERE tgrelid='public.simulados'::regclass AND tgname='trg_simulado_edition_change')
  OR trigger_catalog IS DISTINCT FROM (SELECT jsonb_object_agg(t.oid::text,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)) FROM pg_trigger t WHERE t.tgrelid IN('public.simulados'::regclass,'public.attempts'::regclass,'public.answers'::regclass))
  OR functions_before IS DISTINCT FROM (SELECT jsonb_object_agg(p.oid::text,md5(pg_get_functiondef(p.oid))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f') THEN
  RAISE EXCEPTION 'Trigger/function definition or enabled state changed during repair';
 END IF;
 SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) INTO attempts_after FROM public.attempts a WHERE simulado_id=target.id;
 IF EXISTS(SELECT FROM jsonb_array_elements(attempts_before) b JOIN jsonb_array_elements(attempts_after) a ON a->>'id'=b->>'id'
  WHERE (a-ARRAY['edition_id','updated_at']) IS DISTINCT FROM (b-ARRAY['edition_id','updated_at'])) THEN
  RAISE EXCEPTION 'Repair changed attempt fields outside edition and technical updated_at';
 END IF;
 INSERT INTO backup.rollout_20261104_actions(action,details,captured_at) VALUES('before_f1',
  jsonb_build_object('target_simulado_id',target.id,'target_edition_id',edition,'s7_simulado_id',s7.id,
   'target_before',original_target,'s7_before',original_s7,'recovered_after_model',true,
   'attempts_before',attempts_before,'attempts_after',attempts_after,
   'target_after',(SELECT to_jsonb(s) FROM public.simulados s WHERE id=target.id),
   's7_after',(SELECT to_jsonb(s) FROM public.simulados s WHERE id=s7.id)),captured);
 INSERT INTO backup.rollout_20261104_actions(action,details,captured_at) VALUES('repair_initial_assignment',
  jsonb_build_object('target_simulado_id',target.id,'target_edition_id',edition,
   'cause','before_f1_preview_rolled_back_after_legitimate_offline_S2_submission_then_model_applied_without_assignment',
   'target_state_before',target_state_before,'s7_state_before',s7_state_before,
   'attempts_before',attempts_before,'attempts_after',attempts_after,
   'trigger_definition_before',guard_definition,'trigger_definition_after',guard_definition,
   'trigger_state_before',guard_state,'trigger_state_after',guard_state,
   'trigger_catalog_unchanged',true,'function_definitions_unchanged',true),captured);
END $repair$;
COMMIT;
-- On any error the entire transaction, stage snapshots and trigger state roll back.
-- Preserve all snapshots/ledgers; rollback never restores S7's early release.
