
-- RLS policy: admins can see test simulados
CREATE POLICY "Admins can read test simulados"
ON public.simulados FOR SELECT TO authenticated
USING (status = 'test' AND has_role(auth.uid(), 'admin'::app_role));

-- Update create_attempt_guarded to accept 'test' status simulados
CREATE OR REPLACE FUNCTION public.create_attempt_guarded(p_simulado_id uuid)
 RETURNS attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_effective_deadline TIMESTAMPTZ;
  v_personal_deadline TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_new_attempt public.attempts%ROWTYPE;
  v_in_window BOOLEAN;
BEGIN
  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = p_simulado_id AND status IN ('published', 'test');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  v_in_window := (v_now >= v_simulado.execution_window_start AND v_now <= v_simulado.execution_window_end);

  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status IN ('submitted', 'expired');

  IF FOUND THEN
    RAISE EXCEPTION 'Attempt already submitted for this simulado';
  END IF;

  v_personal_deadline := v_now + (v_simulado.duration_minutes || ' minutes')::interval;
  IF v_in_window THEN
    v_effective_deadline := LEAST(v_personal_deadline, v_simulado.execution_window_end);
  ELSE
    v_effective_deadline := v_personal_deadline;
  END IF;

  INSERT INTO public.attempts (
    simulado_id, user_id, status, started_at, effective_deadline,
    current_question_index, tab_exit_count, fullscreen_exit_count, is_within_window
  )
  VALUES (
    p_simulado_id, auth.uid(), 'in_progress', v_now, v_effective_deadline,
    0, 0, 0, v_in_window
  )
  RETURNING * INTO v_new_attempt;

  RETURN v_new_attempt;
END;
$function$;
