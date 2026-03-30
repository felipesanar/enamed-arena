
-- Step 1: Add is_within_window column to attempts
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS is_within_window boolean NOT NULL DEFAULT true;

-- Step 2: Update create_attempt_guarded to allow attempts outside window
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
  -- Fetch simulado
  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = p_simulado_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  -- Determine if within execution window
  v_in_window := (v_now >= v_simulado.execution_window_start AND v_now <= v_simulado.execution_window_end);

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
  IF v_in_window THEN
    v_effective_deadline := LEAST(v_personal_deadline, v_simulado.execution_window_end);
  ELSE
    v_effective_deadline := v_personal_deadline;
  END IF;

  -- Create attempt
  INSERT INTO public.attempts (
    simulado_id,
    user_id,
    status,
    started_at,
    effective_deadline,
    current_question_index,
    tab_exit_count,
    fullscreen_exit_count,
    is_within_window
  )
  VALUES (
    p_simulado_id,
    auth.uid(),
    'in_progress',
    v_now,
    v_effective_deadline,
    0,
    0,
    0,
    v_in_window
  )
  RETURNING * INTO v_new_attempt;

  RETURN v_new_attempt;
END;
$function$;

-- Step 3: Update get_ranking_for_simulado to filter only in-window attempts
CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
 RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamp with time zone, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    op.specialty AS especialidade,
    op.target_institutions AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    ) AS posicao,
    COUNT(*) OVER () AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND a.is_within_window = true
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
$function$;
