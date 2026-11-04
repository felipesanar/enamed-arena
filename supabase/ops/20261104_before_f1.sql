-- Authorized maintenance only: after F0, before 20261104065001.
-- Keep the snapshot and ledger permanently; never restore S7's early release.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $rollout$
DECLARE
  t text; obj oid; target record; s7 record; edition uuid;
  old_target jsonb; old_s7 jsonb; prior jsonb; details jsonb; col smallint;
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin') OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Requires trusted maintenance owner without JWT actor';
  END IF;
  FOREACH t IN ARRAY ARRAY['simulados','attempts','answers','attempt_question_results',
    'user_performance_history','user_performance_summary','error_notebook','questions',
    'question_options','onboarding_profiles','profiles','actions'] LOOP
    obj := to_regclass('backup.rollout_20261104_' || t);
    IF obj IS NULL OR NOT EXISTS (SELECT FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE c.oid=obj AND c.relkind='r' AND c.relrowsecurity
        AND r.rolname IN ('postgres','supabase_admin'))
      OR has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated',obj,'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('service_role',obj,'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Missing or unsafe rollout snapshot/checkpoint: %',t;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.exam_editions WHERE code='2027.1')<>1 THEN
    RAISE EXCEPTION 'Requires exactly one seeded 2027.1 edition';
  END IF;
  SELECT id INTO edition FROM public.exam_editions WHERE code='2027.1';

  ALTER TABLE public.simulados ADD COLUMN IF NOT EXISTS edition_id uuid;
  SELECT attnum INTO col FROM pg_attribute WHERE attrelid='public.simulados'::regclass
    AND attname='edition_id' AND NOT attisdropped AND atttypid='uuid'::regtype;
  IF col IS NULL THEN RAISE EXCEPTION 'Unreviewed edition_id column'; END IF;
  IF EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.simulados'::regclass
      AND contype='f' AND col=ANY(conkey) AND conname<>'simulados_edition_id_fkey') THEN
    RAISE EXCEPTION 'Unreviewed edition foreign key';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.simulados'::regclass
      AND conname='simulados_edition_id_fkey') THEN
    ALTER TABLE public.simulados ADD CONSTRAINT simulados_edition_id_fkey
      FOREIGN KEY(edition_id) REFERENCES public.exam_editions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint c WHERE c.conrelid='public.simulados'::regclass
      AND c.conname='simulados_edition_id_fkey' AND c.contype='f'
      AND c.conkey=ARRAY[col] AND c.confrelid='public.exam_editions'::regclass
      AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.exam_editions'::regclass AND attname='id')]::smallint[]
      AND c.confdeltype='r' AND c.convalidated) THEN
    RAISE EXCEPTION 'Unreviewed edition foreign key definition';
  END IF;

  -- Parent before children, including the FK lock of concurrent attempt creators.
  PERFORM 1 FROM public.simulados WHERE slug IN ('enamed-2027-simulado-1','simulado-7')
    ORDER BY id FOR UPDATE NOWAIT;
  IF (SELECT count(*) FROM public.simulados WHERE slug='enamed-2027-simulado-1')<>1
    OR (SELECT count(*) FROM public.simulados WHERE slug='simulado-7' AND sequence_number=7)<>1 THEN
    RAISE EXCEPTION 'Missing or ambiguous rollout target/S7';
  END IF;
  SELECT * INTO target FROM public.simulados WHERE slug='enamed-2027-simulado-1';
  SELECT * INTO s7 FROM public.simulados WHERE slug='simulado-7' AND sequence_number=7;
  SELECT to_jsonb(b) INTO old_target FROM backup.rollout_20261104_simulados b
    WHERE b.id=target.id AND b.slug='enamed-2027-simulado-1' AND b.sequence_number=8;
  SELECT to_jsonb(b) INTO old_s7 FROM backup.rollout_20261104_simulados b
    WHERE b.id=s7.id AND b.slug='simulado-7' AND b.sequence_number=7;
  SELECT a.details INTO prior FROM backup.rollout_20261104_actions a WHERE action='before_f1' FOR UPDATE;
  IF old_target IS NULL OR old_s7 IS NULL
    OR (to_jsonb(target)-ARRAY['edition_id','sequence_number']) IS DISTINCT FROM
      (coalesce(prior->'target_after',old_target)-ARRAY['edition_id','sequence_number'])
    OR (to_jsonb(s7)-ARRAY['edition_id','results_release_at']) IS DISTINCT FROM
      (coalesce(prior->'s7_after',old_s7)-ARRAY['edition_id','results_release_at'])
    OR NOT (target.sequence_number=8 OR (prior IS NOT NULL AND target.sequence_number=1))
    OR (prior IS NOT NULL AND (prior->>'target_simulado_id' IS DISTINCT FROM target.id::text
      OR prior->>'target_edition_id' IS DISTINCT FROM edition::text
      OR prior->>'s7_simulado_id' IS DISTINCT FROM s7.id::text)) THEN
    RAISE EXCEPTION 'Rollout target differs from the authorized snapshot/checkpoint';
  END IF;
  IF target.edition_id IS NOT NULL AND target.edition_id<>edition THEN
    RAISE EXCEPTION 'Target already belongs to another edition';
  END IF;
  IF target.edition_id IS DISTINCT FROM edition AND EXISTS (SELECT FROM pg_trigger
    WHERE tgrelid='public.simulados'::regclass AND tgname='trg_simulado_edition_change' AND tgenabled<>'D') THEN
    RAISE EXCEPTION 'F1 protection already installed: cannot repair edition assignment';
  END IF;
  PERFORM 1 FROM public.attempts WHERE simulado_id=target.id ORDER BY id FOR UPDATE NOWAIT;
  IF (SELECT count(*) FROM public.attempts WHERE simulado_id=target.id)<>2
    OR (SELECT count(*) FROM backup.rollout_20261104_attempts WHERE simulado_id=target.id)<>2
    OR EXISTS (SELECT FROM public.attempts a LEFT JOIN backup.rollout_20261104_attempts b ON b.id=a.id
      WHERE a.simulado_id=target.id AND (b.id IS NULL OR
        (SELECT jsonb_object_agg(k,to_jsonb(a)->k) FROM jsonb_object_keys(to_jsonb(b)) k) IS DISTINCT FROM to_jsonb(b)))
    OR EXISTS (SELECT FROM public.attempts WHERE simulado_id=target.id AND
      (score_percentage IS NOT NULL OR finished_at IS NOT NULL OR status IN ('submitted','expired') OR effective_deadline>now()))
    OR EXISTS (SELECT FROM public.attempt_question_results r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id=target.id)
    OR EXISTS (SELECT FROM public.user_performance_history WHERE simulado_id=target.id) THEN
    RAISE EXCEPTION 'Requires exactly two unchanged, unscored, inactive original attempts and no results';
  END IF;
  IF s7.results_release_at IS DISTINCT FROM (old_s7->>'results_release_at')::timestamptz
    AND s7.results_release_at IS DISTINCT FROM s7.execution_window_end THEN
    RAISE EXCEPTION 'Unreviewed S7 release change';
  END IF;
  IF s7.execution_window_start IS NULL OR s7.execution_window_end IS NULL
    OR s7.results_release_at IS NULL OR s7.execution_window_start>=s7.execution_window_end THEN
    RAISE EXCEPTION 'Unreviewed S7 window';
  END IF;

  UPDATE public.simulados SET edition_id=edition WHERE id=target.id AND edition_id IS DISTINCT FROM edition;
  UPDATE public.simulados SET results_release_at=execution_window_end
    WHERE id=s7.id AND results_release_at<execution_window_end;
  details := jsonb_build_object('target_simulado_id',target.id,'target_edition_id',edition,
    's7_simulado_id',s7.id,'target_before',old_target,'s7_before',old_s7,
    'target_after',(SELECT to_jsonb(s) FROM public.simulados s WHERE id=target.id),
    's7_after',(SELECT to_jsonb(s) FROM public.simulados s WHERE id=s7.id));
  INSERT INTO backup.rollout_20261104_actions(action,details) VALUES('before_f1',details)
    ON CONFLICT(action) DO NOTHING;
END $rollout$;
COMMIT;
