-- Source: production-schema.json (selected real function definitions and unique index),
-- plus F0 integrity/finalization already on this branch. No remote SQL or backlog repair.
BEGIN;
-- First-definition checkpoint makes the commented rollback self-contained and data-preserving.
CREATE TABLE IF NOT EXISTS public._fase1_attempt_reliability_rollback (
  signature text PRIMARY KEY, definition text NOT NULL
);
ALTER TABLE public._fase1_attempt_reliability_rollback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._fase1_attempt_reliability_rollback FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public._fase1_attempt_reliability_rollback(signature,definition)
SELECT p.oid::regprocedure::text, pg_get_functiondef(p.oid) FROM pg_proc p
WHERE p.oid IN ('public.create_attempt_guarded(uuid)'::regprocedure,
 'public.update_attempt_progress_guarded(uuid,integer,integer,integer)'::regprocedure)
ON CONFLICT (signature) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_attempt_guarded(p_simulado_id uuid)
RETURNS public.attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_new_attempt public.attempts%ROWTYPE;
  v_now timestamptz := now();
  v_personal_deadline timestamptz;
  v_effective_deadline timestamptz;
  v_in_window boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_simulado FROM public.simulados
  WHERE id=p_simulado_id AND status IN ('published','test');
  IF NOT FOUND THEN RAISE EXCEPTION 'Simulado not found or not published'; END IF;
  IF EXISTS (SELECT 1 FROM public.attempts WHERE simulado_id=p_simulado_id
    AND user_id=auth.uid() AND attempt_type='presencial') THEN
    RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_EXISTS';
  END IF;
  IF v_now < v_simulado.execution_window_start THEN
    RAISE EXCEPTION 'Simulado execution window has not started';
  END IF;
  v_in_window := v_now >= v_simulado.execution_window_start AND v_now <= v_simulado.execution_window_end;
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id=p_simulado_id AND user_id=auth.uid() AND attempt_type='online'
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status='in_progress' THEN RETURN v_existing; END IF;
    RAISE EXCEPTION 'Attempt already submitted for this simulado';
  END IF;
  v_personal_deadline := v_now + (v_simulado.duration_minutes || ' minutes')::interval;
  v_effective_deadline := CASE WHEN v_in_window THEN LEAST(v_personal_deadline,v_simulado.execution_window_end)
    ELSE v_personal_deadline END;
  INSERT INTO public.attempts(simulado_id,user_id,status,attempt_type,started_at,effective_deadline,
    current_question_index,tab_exit_count,fullscreen_exit_count,is_within_window)
  VALUES(p_simulado_id,auth.uid(),'in_progress','online',v_now,v_effective_deadline,0,0,0,v_in_window)
  ON CONFLICT ON CONSTRAINT attempts_simulado_user_type_key DO NOTHING
  RETURNING * INTO v_new_attempt;
  IF FOUND THEN RETURN v_new_attempt; END IF;
  -- Separate statement: READ COMMITTED gets a fresh snapshot after waiting for
  -- the winning insert. A same-statement CTE may see the conflict but no row.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id=p_simulado_id AND user_id=auth.uid() AND attempt_type='online'
  FOR UPDATE;
  IF FOUND AND v_existing.status='in_progress' THEN RETURN v_existing; END IF;
  RAISE EXCEPTION 'Attempt already submitted for this simulado';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_attempt_progress_guarded(p_attempt_id uuid,
 p_current_question_index integer, p_tab_exit_count integer DEFAULT 0, p_fullscreen_exit_count integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  UPDATE public.attempts SET current_question_index=p_current_question_index,
    tab_exit_count=GREATEST(tab_exit_count,p_tab_exit_count),
    fullscreen_exit_count=GREATEST(fullscreen_exit_count,p_fullscreen_exit_count),
    last_saved_at=now()
  WHERE id=p_attempt_id AND user_id=auth.uid() AND status='in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found, not owned by user, or not in progress'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_attempt_guarded(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_attempt_progress_guarded(uuid,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_attempt_progress_guarded(uuid,integer,integer,integer) TO authenticated, service_role;
COMMIT;

-- ROLLBACK (manual, reviewed; never deletes attempts, answers or results):
-- BEGIN;
-- DO $rollback$ DECLARE r record; BEGIN
--   FOR r IN SELECT definition FROM public._fase1_attempt_reliability_rollback LOOP
--     EXECUTE r.definition;
--   END LOOP;
-- END $rollback$;
-- REVOKE ALL ON FUNCTION public.create_attempt_guarded(uuid) FROM PUBLIC, anon;
-- REVOKE ALL ON FUNCTION public.update_attempt_progress_guarded(uuid,integer,integer,integer) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO authenticated, service_role;
-- GRANT EXECUTE ON FUNCTION public.update_attempt_progress_guarded(uuid,integer,integer,integer) TO authenticated, service_role;
-- COMMIT;
-- Keep the private checkpoint until rollback is no longer needed.
