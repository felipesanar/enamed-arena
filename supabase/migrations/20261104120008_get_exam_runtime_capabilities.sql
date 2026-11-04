-- Read-only rollout contract, timestamp reserved by parent. No student data returned.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.get_exam_runtime_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object('version',1,'answer_freshness_v1',
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.answers')
      AND attname='client_updated_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped)
    AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid=to_regclass('public.answers')
      AND t.tgname='trg_enforce_answer_integrity' AND t.tgfoid=to_regprocedure('public.enforce_answer_integrity()')
      AND t.tgtype=23 AND t.tgenabled='O' AND NOT p.prosecdef)
    AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid=to_regclass('public.answers') AND t.tgname='zzzz_answer_freshness'
        AND t.tgfoid=to_regprocedure('public.enforce_answer_freshness()') AND t.tgtype=23 AND t.tgenabled='O'
         AND NOT p.prosecdef),
    -- Metadata is readiness, never permission to call the original RPCs.
    'safe_auto_finalize',to_regprocedure('public.finalize_attempt_with_results(uuid,boolean)') IS NOT NULL,
    'question_explanations',to_regprocedure('public.get_question_explanations(uuid)') IS NOT NULL,
    'attempt_counts',to_regprocedure('public.admin_simulado_attempt_counts(uuid)') IS NOT NULL,
    'server_clock',to_regprocedure('public.get_server_time()') IS NOT NULL,
    'exam_editions',to_regprocedure('public.get_exam_editions()') IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.get_exam_runtime_capabilities() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_exam_runtime_capabilities() TO authenticated;
COMMIT;
