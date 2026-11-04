-- T4 / R-01: deploy locally first. Does NOT enable extensions or touch legacy attempts.
-- The cutoff is private, persisted exactly once, and never recomputed on rerun.
CREATE SCHEMA IF NOT EXISTS fase0_private;
REVOKE ALL ON SCHEMA fase0_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS fase0_private.attempt_jobs_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  deployed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fase0_private.attempt_jobs_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE fase0_private.attempt_jobs_config FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO fase0_private.attempt_jobs_config(singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- Drop only the old arities, without CASCADE. One defaulted signature per name
-- avoids ambiguous SQL/PostgREST resolution. PL/pgSQL offline/presencial callers
-- still resolve their omitted argument to false. Reapplying is safe.
DROP FUNCTION IF EXISTS public.finalize_attempt_with_results(uuid);
DROP FUNCTION IF EXISTS public.finalize_attempt_with_results_for_user(uuid, uuid);

CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results_for_user(
  p_attempt_id uuid, p_user_id uuid, p_auto_submit boolean DEFAULT false
)
RETURNS TABLE(score_percentage numeric, total_correct integer, total_answered integer,
  total_questions integer, is_within_window boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_total_questions integer := 0;
  v_total_answered integer := 0;
  v_total_correct integer := 0;
  v_score numeric(5,2) := 0;
  v_finished_at timestamptz := now();
  v_unanswered integer := 0;
BEGIN
  -- This helper's capability is its EXECUTE ACL (service_role/owner only).
  -- User-facing callers must go through the auth.uid()-checked wrapper below.
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_attempt FROM public.attempts
  WHERE id = p_attempt_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found for current user'; END IF;

  IF v_attempt.status = 'submitted' AND v_attempt.score_percentage IS NOT NULL THEN
    RETURN QUERY SELECT v_attempt.score_percentage, COALESCE(v_attempt.total_correct,0),
      COALESCE(v_attempt.total_answered,0),
      (SELECT count(*)::integer FROM public.questions q WHERE q.simulado_id=v_attempt.simulado_id),
      COALESCE(v_attempt.is_within_window,false);
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_total_questions FROM public.questions q
    WHERE q.simulado_id=v_attempt.simulado_id;
  SELECT count(*)::integer INTO v_unanswered FROM public.questions q
    LEFT JOIN public.answers a ON a.question_id=q.id AND a.attempt_id=v_attempt.id
    WHERE q.simulado_id=v_attempt.simulado_id AND a.selected_option_id IS NULL;
  IF v_unanswered > 0 AND NOT COALESCE(p_auto_submit,false)
    AND now() < v_attempt.effective_deadline THEN
    RAISE EXCEPTION 'Cannot submit: % question(s) unanswered', v_unanswered;
  END IF;

  -- Read persisted answers only: never write answers past their write deadline.
  -- A LEFT JOIN produces a false/was_answered=false result for every blank.
  INSERT INTO public.attempt_question_results(attempt_id,question_id,selected_option_id,
    correct_option_id,is_correct,was_answered)
  SELECT v_attempt.id,q.id,a.selected_option_id,qo.id,
    COALESCE(a.selected_option_id=qo.id,false),a.selected_option_id IS NOT NULL
  FROM public.questions q
  LEFT JOIN public.answers a ON a.question_id=q.id AND a.attempt_id=v_attempt.id
  LEFT JOIN public.question_options qo ON qo.question_id=q.id AND qo.is_correct=true
  WHERE q.simulado_id=v_attempt.simulado_id
  ON CONFLICT (attempt_id,question_id) DO UPDATE SET
    selected_option_id=EXCLUDED.selected_option_id,correct_option_id=EXCLUDED.correct_option_id,
    is_correct=EXCLUDED.is_correct,was_answered=EXCLUDED.was_answered;

  SELECT count(*) FILTER (WHERE aqr.was_answered)::integer,
    count(*) FILTER (WHERE aqr.is_correct)::integer
  INTO v_total_answered,v_total_correct FROM public.attempt_question_results aqr
  WHERE aqr.attempt_id=v_attempt.id;
  v_score := CASE WHEN v_total_questions > 0
    THEN round(v_total_correct::numeric*100/v_total_questions,2) ELSE 0 END;

  UPDATE public.attempts SET status='submitted',finished_at=COALESCE(finished_at,v_finished_at),
    score_percentage=v_score,total_correct=v_total_correct,total_answered=v_total_answered,
    last_saved_at=now() WHERE id=v_attempt.id;
  SELECT * INTO v_attempt FROM public.attempts WHERE id=v_attempt.id;
  INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,score_percentage,
    total_correct,total_answered,total_questions,finished_at)
  VALUES(v_attempt.user_id,v_attempt.id,v_attempt.simulado_id,v_score,v_total_correct,
    v_total_answered,v_total_questions,COALESCE(v_attempt.finished_at,v_finished_at))
  ON CONFLICT (attempt_id) DO UPDATE SET score_percentage=EXCLUDED.score_percentage,
    total_correct=EXCLUDED.total_correct,total_answered=EXCLUDED.total_answered,
    total_questions=EXCLUDED.total_questions,finished_at=EXCLUDED.finished_at;
  PERFORM public.recalculate_user_performance(v_attempt.user_id);

  -- Retain the queue audit trail. Never alter a pre-deploy queue/attempt here.
  UPDATE public.attempt_processing_queue q SET status='completed',processed_at=now(),last_error=null
  FROM fase0_private.attempt_jobs_config c
  WHERE c.singleton AND q.attempt_id=v_attempt.id
    AND q.created_at >= c.deployed_at AND v_attempt.created_at >= c.deployed_at;
  RETURN QUERY SELECT v_score,v_total_correct,v_total_answered,v_total_questions,
    COALESCE(v_attempt.is_within_window,false);
END;
$function$;
REVOKE ALL ON FUNCTION public.finalize_attempt_with_results_for_user(uuid,uuid,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results_for_user(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(
  p_attempt_id uuid, p_auto_submit boolean DEFAULT false
)
RETURNS TABLE(score_percentage numeric,total_correct integer,total_answered integer,
  total_questions integer,is_within_window boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY SELECT * FROM public.finalize_attempt_with_results_for_user(p_attempt_id,auth.uid(),p_auto_submit);
END;
$function$;
REVOKE ALL ON FUNCTION public.finalize_attempt_with_results(uuid,boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results(uuid,boolean) TO authenticated;

-- ROLLBACK: psql recipe, run as migration owner from the repository root.
-- Execute the following commented commands as one script (not as a migration).
-- The referenced file exists in this repository and supplies the original score
-- implementation. ON_ERROR_STOP + transaction prevents a partial restoration.
-- Roll back the frontend p_auto_submit caller together with this DB rollback.
-- Do NOT restore the old queue worker: it would authorize the legacy backlog.
-- \set ON_ERROR_STOP on
-- BEGIN;
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='fase0-attempt-maintenance';
-- DROP FUNCTION IF EXISTS public.run_fase0_attempt_maintenance(integer);
-- DROP FUNCTION IF EXISTS public.process_attempt_reprocessing_queue(integer);
-- DROP FUNCTION IF EXISTS public.finalize_attempt_with_results(uuid,boolean);
-- DROP FUNCTION IF EXISTS public.finalize_attempt_with_results_for_user(uuid,uuid,boolean);
-- \i supabase/migrations/20260812100100_finalize_for_user.sql
-- CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(p_attempt_id uuid)
-- RETURNS TABLE(score_percentage numeric,total_correct integer,total_answered integer,
--   total_questions integer,is_within_window boolean)
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $rollback$
-- BEGIN
--   IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
--   RETURN QUERY SELECT * FROM public.finalize_attempt_with_results_for_user(p_attempt_id,auth.uid());
-- END;
-- $rollback$;
-- REVOKE ALL ON FUNCTION public.finalize_attempt_with_results(uuid) FROM PUBLIC,anon,service_role;
-- GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results(uuid) TO authenticated;
-- REVOKE ALL ON FUNCTION public.finalize_attempt_with_results_for_user(uuid,uuid) FROM PUBLIC,anon,authenticated;
-- GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_results_for_user(uuid,uuid) TO service_role;
-- COMMIT;
-- If the jobs migration was never applied / pg_cron is absent, omit ONLY the
-- cron.unschedule line. Keep fase0_private and its immutable cutoff, and all
-- existing queue rows. The restored legacy finalizer deletes queue entries for
-- future explicit finalizations, as before; this rollback itself changes no data.
