-- Create the missing create_attempt_guarded RPC
CREATE OR REPLACE FUNCTION public.create_attempt_guarded(p_simulado_id uuid)
 RETURNS public.attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_effective_deadline TIMESTAMPTZ;
  v_personal_deadline TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_new_attempt public.attempts%ROWTYPE;
BEGIN
  -- Fetch simulado
  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = p_simulado_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  -- Check window
  IF v_now < v_simulado.execution_window_start THEN
    RAISE EXCEPTION 'Simulado execution window has not started yet';
  END IF;

  IF v_now > v_simulado.execution_window_end THEN
    RAISE EXCEPTION 'Simulado execution window has ended';
  END IF;

  -- Check for existing in_progress attempt
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Check for already submitted attempt
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status IN ('submitted', 'expired');

  IF FOUND THEN
    RAISE EXCEPTION 'Attempt already submitted for this simulado';
  END IF;

  -- Calculate effective deadline
  v_personal_deadline := v_now + (v_simulado.duration_minutes || ' minutes')::interval;
  v_effective_deadline := LEAST(v_personal_deadline, v_simulado.execution_window_end);

  -- Create attempt
  INSERT INTO public.attempts (
    simulado_id,
    user_id,
    status,
    started_at,
    effective_deadline,
    current_question_index,
    tab_exit_count,
    fullscreen_exit_count
  )
  VALUES (
    p_simulado_id,
    auth.uid(),
    'in_progress',
    v_now,
    v_effective_deadline,
    0,
    0,
    0
  )
  RETURNING * INTO v_new_attempt;

  RETURN v_new_attempt;
END;
$$;

-- Create the missing update_attempt_progress_guarded RPC
CREATE OR REPLACE FUNCTION public.update_attempt_progress_guarded(
  p_attempt_id uuid,
  p_current_question_index integer,
  p_tab_exit_count integer DEFAULT 0,
  p_fullscreen_exit_count integer DEFAULT 0
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.attempts
  SET
    current_question_index = p_current_question_index,
    tab_exit_count = p_tab_exit_count,
    fullscreen_exit_count = p_fullscreen_exit_count,
    last_saved_at = now()
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found, not owned by user, or not in progress';
  END IF;
END;
$$;