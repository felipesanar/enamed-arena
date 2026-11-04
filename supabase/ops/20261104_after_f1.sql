-- Operational checkpoint: run immediately AFTER 20261104065001, before 072218.
-- Requires the real protected snapshot and successful before_f1 ledger entry.
-- No attempt finalization, grade rewrite, student retargeting or trigger bypass.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';
DO $$
DECLARE
  t text; extra_columns text[]; changed boolean; target_id uuid; target_edition uuid;
  target_blueprint uuid; mfc_id uuid; target_before jsonb; before_action jsonb;
  after_action jsonb; alias_text text := 'Medicina de Família e Comunidade (MFC)';
  alias_normalized text; mapped_count bigint := 0; snap_name text;
  stage_action jsonb; expected_mapping jsonb := '{}'::jsonb; stage_captured timestamptz;
  before_captured timestamptz; baseline_prefix text := 'rollout_20261104_';
  use_stage boolean := false;
BEGIN
  IF session_user NOT IN ('postgres','supabase_admin')
     OR current_user NOT IN ('postgres','supabase_admin') OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'after_f1 requires the database owner without an authenticated actor';
  END IF;
  FOREACH t IN ARRAY ARRAY['simulados','attempts','answers','attempt_question_results',
    'user_performance_history','user_performance_summary','error_notebook','questions',
    'question_options','onboarding_profiles','profiles','actions'] LOOP
    snap_name := 'backup.rollout_20261104_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE c.oid=to_regclass(snap_name) AND c.relkind='r' AND c.relrowsecurity
        AND r.rolname IN ('postgres','supabase_admin')
        AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
          LEFT JOIN pg_roles gr ON gr.oid=x.grantee
          WHERE x.grantee=0 OR gr.rolname IN ('anon','authenticated','service_role'))
    ) THEN RAISE EXCEPTION 'Missing or unprotected rollout snapshot: %',snap_name; END IF;
  END LOOP;
  IF to_regclass('public.exam_blueprints') IS NULL
     OR to_regclass('public.exam_areas') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.simulados'::regclass
       AND conname='simulados_edition_windows_check' AND contype='c') THEN
    RAISE EXCEPTION 'Apply original 20261104065001 before after_f1';
  END IF;
  -- Parent first; NOWAIT makes a concurrent exam/admin writer an explicit abort.
  LOCK TABLE public.simulados IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  LOCK TABLE public.attempts,public.answers,public.attempt_question_results,
    public.user_performance_history,public.user_performance_summary,public.error_notebook,
    public.questions,public.question_options,public.onboarding_profiles,public.profiles,
    public.exam_editions,public.exam_blueprints,public.exam_areas,
    backup.rollout_20261104_actions IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  SELECT details,captured_at INTO before_action,before_captured FROM backup.rollout_20261104_actions WHERE action='before_f1';
  IF before_action IS NULL THEN RAISE EXCEPTION 'Missing successful before_f1 checkpoint'; END IF;
  -- A separately approved pre-repair checkpoint preserves legitimate activity
  -- after the original backup. It is never created or refreshed by this script.
  SELECT details,captured_at INTO stage_action,stage_captured
    FROM backup.rollout_20261104_actions WHERE action='live_activity_checkpoint';
  FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','user_performance_history',
    'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
    expected_mapping := expected_mapping || jsonb_build_object(t,'backup.rollout_20261104_stage_'||t);
  END LOOP;
  IF stage_action IS NOT NULL THEN
    IF before_action->'recovered_after_model' IS DISTINCT FROM 'true'::jsonb
      OR stage_action->'version' IS DISTINCT FROM '1'::jsonb
      OR stage_action->>'reason' IS DISTINCT FROM 'legitimate_activity_after_original_snapshot'
      OR stage_action->>'source' IS DISTINCT FROM 'pre_repair_owner_locked_snapshot'
      OR stage_action->>'original_snapshot_prefix' IS DISTINCT FROM 'backup.rollout_20261104_'
      OR stage_action->>'stage_snapshot_prefix' IS DISTINCT FROM 'backup.rollout_20261104_stage_'
      OR stage_action->'table_mapping' IS DISTINCT FROM expected_mapping
      OR jsonb_typeof(stage_action->'captured_at') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid live activity checkpoint provenance or table mapping';
    END IF;
    BEGIN
      IF (stage_action->>'captured_at')::timestamptz IS DISTINCT FROM stage_captured
        OR stage_captured>before_captured OR stage_captured>now() THEN
        RAISE EXCEPTION 'Invalid live activity checkpoint timestamp';
      END IF;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid live activity checkpoint timestamp';
    END;
    FOR t IN SELECT jsonb_object_keys(expected_mapping) LOOP
      snap_name := 'backup.rollout_20261104_stage_'||t;
      IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
        WHERE c.oid=to_regclass(snap_name) AND c.relkind='r' AND c.relrowsecurity
          AND r.rolname IN ('postgres','supabase_admin')
          AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
            LEFT JOIN pg_roles gr ON gr.oid=x.grantee
            WHERE x.grantee=0 OR gr.rolname IN ('anon','authenticated','service_role'))) THEN
        RAISE EXCEPTION 'Missing or unprotected live activity checkpoint table: %',t;
      END IF;
      IF EXISTS ((SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute
          WHERE attrelid=to_regclass(snap_name) AND attnum>0 AND NOT attisdropped
        EXCEPT ALL SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute
          WHERE attrelid=to_regclass('backup.rollout_20261104_'||t) AND attnum>0 AND NOT attisdropped)
        UNION ALL
        (SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute
          WHERE attrelid=to_regclass('backup.rollout_20261104_'||t) AND attnum>0 AND NOT attisdropped
        EXCEPT ALL SELECT attnum,attname,atttypid,atttypmod,attcollation FROM pg_attribute
          WHERE attrelid=to_regclass(snap_name) AND attnum>0 AND NOT attisdropped)) THEN
        RAISE EXCEPTION 'Live activity checkpoint must use original snapshot column types: %',t;
      END IF;
      EXECUTE format('LOCK TABLE %s IN SHARE MODE NOWAIT',to_regclass(snap_name));
    END LOOP;
    use_stage := true;
    baseline_prefix := 'rollout_20261104_stage_';
  ELSIF before_action->'recovered_after_model'='true'::jsonb THEN
    RAISE EXCEPTION 'Recovered assignment requires a live activity checkpoint';
  END IF;
  SELECT id INTO STRICT target_edition FROM public.exam_editions WHERE code='2027.1';
  SELECT id INTO STRICT target_id FROM public.simulados WHERE slug='enamed-2027-simulado-1';
  SELECT to_jsonb(b) INTO STRICT target_before FROM backup.rollout_20261104_simulados b
    WHERE b.id=target_id AND b.slug='enamed-2027-simulado-1';
  IF target_before->>'sequence_number' <> '8'
     OR before_action->>'target_simulado_id' IS DISTINCT FROM target_id::text
     OR before_action->>'target_edition_id' IS DISTINCT FROM target_edition::text
     OR NOT EXISTS (SELECT 1 FROM public.simulados s WHERE s.id=target_id
       AND s.edition_id=target_edition AND s.sequence_number IN (8,1)) THEN
    RAISE EXCEPTION 'Unexpected target identity, edition or original sequence';
  END IF;
  IF (SELECT count(*) FROM backup.rollout_20261104_attempts WHERE simulado_id=target_id) <> 2
     OR EXISTS (SELECT 1 FROM public.attempts WHERE simulado_id=target_id
       AND (score_percentage IS NOT NULL OR finished_at IS NOT NULL
         OR effective_deadline>now() OR created_at>now()-interval '30 minutes'))
     OR EXISTS (SELECT 1 FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id
       WHERE a.simulado_id=target_id) THEN
    RAISE EXCEPTION 'Target attempts are not the original two inactive unscored attempts';
  END IF;
  IF use_stage THEN
    IF jsonb_typeof(before_action->'attempts_before') IS DISTINCT FROM 'array'
      OR jsonb_typeof(before_action->'attempts_after') IS DISTINCT FROM 'array'
      OR jsonb_array_length(before_action->'attempts_before')<>2
      OR jsonb_array_length(before_action->'attempts_after')<>2
      OR before_action->'attempts_after' IS DISTINCT FROM
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attempts a WHERE a.simulado_id=target_id) THEN
      RAISE EXCEPTION 'Recovered attempt state does not match the recorded repair';
    END IF;
    IF EXISTS ((SELECT to_jsonb(b) FROM backup.rollout_20261104_stage_attempts b WHERE b.simulado_id=target_id
      EXCEPT ALL SELECT to_jsonb(jsonb_populate_record(NULL::backup.rollout_20261104_attempts,j))
        FROM jsonb_array_elements(before_action->'attempts_before') j)
      UNION ALL
      (SELECT to_jsonb(jsonb_populate_record(NULL::backup.rollout_20261104_attempts,j))
        FROM jsonb_array_elements(before_action->'attempts_before') j
      EXCEPT ALL SELECT to_jsonb(b) FROM backup.rollout_20261104_stage_attempts b WHERE b.simulado_id=target_id)) THEN
      RAISE EXCEPTION 'Recovered attempt provenance differs from the pre-repair checkpoint';
    END IF;
    -- The two original attempts retain every original business value. Only
    -- their exact recorded updated_at may change when edition metadata is fixed.
    IF EXISTS ((SELECT to_jsonb(b)-'updated_at' FROM backup.rollout_20261104_attempts b WHERE b.simulado_id=target_id
      EXCEPT ALL SELECT to_jsonb(jsonb_populate_record(NULL::backup.rollout_20261104_attempts,j))-'updated_at'
        FROM jsonb_array_elements(before_action->'attempts_after') j)
      UNION ALL
      (SELECT to_jsonb(jsonb_populate_record(NULL::backup.rollout_20261104_attempts,j))-'updated_at'
        FROM jsonb_array_elements(before_action->'attempts_after') j
      EXCEPT ALL SELECT to_jsonb(b)-'updated_at' FROM backup.rollout_20261104_attempts b WHERE b.simulado_id=target_id)) THEN
      RAISE EXCEPTION 'Recovered original attempts changed business values';
    END IF;
  END IF;
  -- Compare every original column, including empty snapshot tables. New F1
  -- provenance columns alone are excluded; no academic value is ignored.
  FOREACH t IN ARRAY ARRAY['attempts','answers','attempt_question_results','user_performance_history',
    'user_performance_summary','error_notebook','questions','question_options','onboarding_profiles','profiles'] LOOP
    SELECT coalesce(array_agg(a.attname::text),'{}'::text[]) INTO extra_columns
    FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||t) AND a.attnum>0 AND NOT a.attisdropped
      AND NOT EXISTS (SELECT 1 FROM pg_attribute b
        WHERE b.attrelid=to_regclass('backup.rollout_20261104_'||t) AND b.attnum>0
          AND NOT b.attisdropped AND b.attname=a.attname);
    IF use_stage AND t='attempts' THEN
      EXECUTE format('SELECT EXISTS ((SELECT CASE WHEN c.simulado_id=$2 THEN (to_jsonb(c)-$1)-''updated_at'' ELSE to_jsonb(c)-$1 END FROM public.%1$I c EXCEPT ALL SELECT CASE WHEN b.simulado_id=$2 THEN to_jsonb(b)-''updated_at'' ELSE to_jsonb(b) END FROM backup.%2$I b) UNION ALL (SELECT CASE WHEN b.simulado_id=$2 THEN to_jsonb(b)-''updated_at'' ELSE to_jsonb(b) END FROM backup.%2$I b EXCEPT ALL SELECT CASE WHEN c.simulado_id=$2 THEN (to_jsonb(c)-$1)-''updated_at'' ELSE to_jsonb(c)-$1 END FROM public.%1$I c))',t,baseline_prefix||t)
        INTO changed USING extra_columns,target_id;
    ELSE
      EXECUTE format('SELECT EXISTS ((SELECT to_jsonb(c)-$1 FROM public.%1$I c EXCEPT ALL SELECT to_jsonb(b) FROM backup.%2$I b) UNION ALL (SELECT to_jsonb(b) FROM backup.%2$I b EXCEPT ALL SELECT to_jsonb(c)-$1 FROM public.%1$I c))',t,baseline_prefix||t)
        INTO changed USING extra_columns;
    END IF;
    IF changed THEN RAISE EXCEPTION 'Academic snapshot changed: %',t; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.attempts a WHERE a.simulado_id=target_id AND a.edition_id IS DISTINCT FROM target_edition) THEN
    RAISE EXCEPTION 'Original F1 did not preserve the target attempt editions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.simulados s WHERE s.edition_id=target_edition
    AND s.sequence_number=1 AND s.id<>target_id) THEN RAISE EXCEPTION 'Target edition sequence 1 is occupied'; END IF;
  -- Original F1 parent updates may refresh updated_at; all academic and window
  -- values remain exact except the documented S7 release and target sequence.
  SELECT coalesce(array_agg(a.attname::text),'{}'::text[]) INTO extra_columns
  FROM pg_attribute a WHERE a.attrelid='public.simulados'::regclass AND a.attnum>0 AND NOT a.attisdropped
    AND NOT EXISTS (SELECT 1 FROM pg_attribute b WHERE b.attrelid='backup.rollout_20261104_simulados'::regclass
      AND b.attnum>0 AND NOT b.attisdropped AND b.attname=a.attname);
  IF EXISTS (SELECT 1 FROM public.simulados c FULL JOIN backup.rollout_20261104_simulados b USING(id)
    WHERE c.id IS NULL OR b.id IS NULL OR
      (to_jsonb(c)-extra_columns - ARRAY['updated_at']::text[])
      IS DISTINCT FROM
      ((to_jsonb(b) || CASE WHEN b.id=target_id THEN jsonb_build_object('sequence_number',c.sequence_number)
        WHEN b.slug='simulado-7' THEN jsonb_build_object('results_release_at',CASE WHEN b.results_release_at<b.execution_window_end THEN b.execution_window_end ELSE b.results_release_at END)
        ELSE '{}'::jsonb END)
        - ARRAY['updated_at']::text[])) THEN
    RAISE EXCEPTION 'Unexpected simulado changes outside the approved rollout';
  END IF;
  SELECT details INTO after_action FROM backup.rollout_20261104_actions WHERE action='after_f1';
  IF after_action IS NOT NULL AND (
    after_action->>'target_simulado_id' IS DISTINCT FROM target_id::text
    OR after_action->>'target_edition_id' IS DISTINCT FROM target_edition::text
    OR NOT EXISTS (SELECT 1 FROM public.simulados WHERE id=target_id AND sequence_number=1)) THEN
    RAISE EXCEPTION 'Existing after_f1 checkpoint does not match current state';
  END IF;

  SELECT b.id INTO STRICT target_blueprint FROM public.exam_blueprints b WHERE b.code='inep-478-2025';
  SELECT a.id INTO STRICT mfc_id FROM public.exam_areas a
    WHERE a.blueprint_id=target_blueprint AND a.code='medicina_familia_comunidade';
  alias_normalized := public.normalize_exam_area(alias_text);
  IF EXISTS (SELECT 1 FROM public.exam_areas a WHERE a.blueprint_id=target_blueprint AND a.id<>mfc_id
    AND EXISTS (SELECT 1 FROM unnest(a.aliases||ARRAY[a.label,a.code]) x
      WHERE public.normalize_exam_area(x)=alias_normalized)) THEN
    RAISE EXCEPTION 'MFC alias is ambiguous within the selected blueprint';
  END IF;
  IF EXISTS (SELECT 1 FROM public.simulados WHERE execution_window_start IS NULL
    OR execution_window_end IS NULL OR results_release_at IS NULL
    OR NOT isfinite(execution_window_start) OR NOT isfinite(execution_window_end) OR NOT isfinite(results_release_at)
    OR execution_window_start>=execution_window_end OR execution_window_end>results_release_at) THEN
    RAISE EXCEPTION 'Window inconsistency remains; do not validate the constraint';
  END IF;
  UPDATE public.simulados SET sequence_number=1 WHERE id=target_id AND sequence_number=8;
  UPDATE public.exam_areas SET aliases=array_append(aliases,alias_text)
    WHERE id=mfc_id AND NOT (alias_text=ANY(aliases));
  UPDATE public.questions q SET area_id=mfc_id FROM public.simulados s JOIN public.exam_editions e ON e.id=s.edition_id
    WHERE q.simulado_id=s.id AND e.blueprint_id=target_blueprint AND q.area_id IS NULL
      AND public.normalize_exam_area(q.area)=alias_normalized;
  GET DIAGNOSTICS mapped_count=ROW_COUNT;
  ALTER TABLE public.simulados VALIDATE CONSTRAINT simulados_edition_windows_check;
  INSERT INTO backup.rollout_20261104_actions(action,details) VALUES ('after_f1',jsonb_build_object(
    'target_simulado_id',target_id,'target_edition_id',target_edition,'sequence_before',8,'sequence_after',1,
    'alias',alias_text,'questions_backfilled',mapped_count,'window_constraint_validated',true))
    ON CONFLICT (action) DO NOTHING;
END $$;
COMMIT;
-- Recovery: turn editions_ui off through its audited admin RPC and preserve the
-- new provenance. Inspect the protected snapshot/ledger before a forward fix.
-- Never restore S7's early release, delete snapshots or bulk restore grades.
