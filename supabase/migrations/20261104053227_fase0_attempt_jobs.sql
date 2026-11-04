-- T4 / R-02, R-03 partial, F-01 preparation ONLY.
-- PREREQUISITE: Felipe must authorize and separately enable pg_cron.
-- This migration deliberately fails atomically if the extension is absent.
-- Never run CREATE EXTENSION here and never process the historical backlog.
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE EXCEPTION 'pg_cron must be enabled separately with Felipe authorization before applying fase0_attempt_jobs';
  END IF;
END;
$check$;

CREATE OR REPLACE FUNCTION public.process_attempt_reprocessing_queue(p_limit integer DEFAULT 20)
RETURNS TABLE(processed_count integer,failed_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_row record; v_processed integer := 0; v_failed integer := 0; v_cutoff timestamptz;
BEGIN
  SELECT deployed_at INTO STRICT v_cutoff FROM fase0_private.attempt_jobs_config WHERE singleton;
  FOR v_row IN
    SELECT q.id,q.attempt_id,q.user_id
    FROM public.attempt_processing_queue q JOIN public.attempts a ON a.id=q.attempt_id
    WHERE q.status IN ('pending','failed')
      AND q.created_at >= v_cutoff AND a.created_at >= v_cutoff
    -- Rotate failures to the back so one permanent failure cannot starve new work.
    ORDER BY q.updated_at,q.created_at,q.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),200)
    -- Lock both rows without waiting; finalizers lock attempt before queue too.
    FOR UPDATE OF q,a SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.attempt_processing_queue SET status='processing',attempt_count=attempt_count+1
        WHERE id=v_row.id;
      PERFORM public.finalize_attempt_with_results_for_user(v_row.attempt_id,v_row.user_id,true);
      UPDATE public.attempt_processing_queue SET status='completed',processed_at=now(),last_error=null
        WHERE id=v_row.id;
      v_processed := v_processed+1;
    EXCEPTION WHEN OTHERS THEN
      -- The inner subtransaction rolled back 'processing' and scoring; persist
      -- the failed attempt count here, so no committed processing orphan remains.
      UPDATE public.attempt_processing_queue SET status='failed',attempt_count=attempt_count+1,
        last_error=SQLERRM,processed_at=null,updated_at=now() WHERE id=v_row.id;
      v_failed := v_failed+1;
    END;
  END LOOP;
  RETURN QUERY SELECT v_processed,v_failed;
END;
$function$;
REVOKE ALL ON FUNCTION public.process_attempt_reprocessing_queue(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_attempt_reprocessing_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.run_fase0_attempt_maintenance(p_limit integer DEFAULT 20)
RETURNS TABLE(processed_count integer,failed_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_row record; v_queue record; v_queue_id uuid; v_cutoff timestamptz;
  v_processed integer := 0; v_failed integer := 0;
BEGIN
  SELECT deployed_at INTO STRICT v_cutoff FROM fase0_private.attempt_jobs_config WHERE singleton;
  -- Independent bounded budgets for BOTH sources on each run: neither source
  -- can starve the other, including when the queue contains permanent failures.
  SELECT * INTO v_queue FROM public.process_attempt_reprocessing_queue(p_limit);
  v_processed := v_queue.processed_count; v_failed := v_queue.failed_count;
  FOR v_row IN
    SELECT a.id,a.user_id FROM public.attempts a
    WHERE a.attempt_type='online' AND a.status='in_progress'
      AND a.created_at >= v_cutoff
      AND a.effective_deadline + interval '2 minutes' < now()
      -- Preserve legacy queue items even if their attempt was created later.
      AND NOT EXISTS (SELECT 1 FROM public.attempt_processing_queue q WHERE q.attempt_id=a.id)
    ORDER BY a.effective_deadline,a.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit,20),1),200)
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    v_queue_id := null;
    INSERT INTO public.attempt_processing_queue(attempt_id,user_id)
      VALUES(v_row.id,v_row.user_id) ON CONFLICT (attempt_id) DO NOTHING
      RETURNING id INTO v_queue_id;
    IF v_queue_id IS NULL THEN CONTINUE; END IF;
    BEGIN
      UPDATE public.attempt_processing_queue SET status='processing',attempt_count=attempt_count+1
        WHERE id=v_queue_id;
      PERFORM public.finalize_attempt_with_results_for_user(v_row.id,v_row.user_id,true);
      UPDATE public.attempt_processing_queue SET status='completed',processed_at=now(),last_error=null
        WHERE id=v_queue_id;
      v_processed := v_processed+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.attempt_processing_queue SET status='failed',attempt_count=attempt_count+1,
        last_error=SQLERRM,processed_at=null,updated_at=now() WHERE id=v_queue_id;
      v_failed := v_failed+1;
    END;
  END LOOP;
  RETURN QUERY SELECT v_processed,v_failed;
END;
$function$;
REVOKE ALL ON FUNCTION public.run_fase0_attempt_maintenance(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_fase0_attempt_maintenance(integer) TO service_role;

-- Named schedule is replaced on rerun, not duplicated. Runs as migration owner
-- (the other allowed maintenance capability); no JWT/auth.uid() dependency.
DO $schedule$
DECLARE v_job bigint;
BEGIN
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname='fase0-attempt-maintenance' LOOP
    PERFORM cron.unschedule(v_job);
  END LOOP;
  PERFORM cron.schedule('fase0-attempt-maintenance','*/5 * * * *',
    'SELECT public.run_fase0_attempt_maintenance(100);');
END;
$schedule$;

-- ROLLBACK (owner, deliberate operation):
-- BEGIN;
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='fase0-attempt-maintenance';
-- DROP FUNCTION IF EXISTS public.run_fase0_attempt_maintenance(integer);
-- DROP FUNCTION IF EXISTS public.process_attempt_reprocessing_queue(integer);
-- COMMIT;
-- No old worker is restored: absence is intentional fail-closed behavior.
-- Keep fase0_private config and queue audit rows. For a full finalizer rollback,
-- use the transactional psql recipe in 20261104053219_fase0_safe_finalization.sql
-- instead; it includes the same worker teardown and restores the old arities.
