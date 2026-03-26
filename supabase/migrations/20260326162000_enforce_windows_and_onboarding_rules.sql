-- Enforce execution-window rules in server-side mutations
-- and centralize onboarding validation rules.

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS notify_result_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_result_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_result_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_any_simulado_window_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.simulados s
    WHERE s.status = 'published'
      AND p_now >= s.execution_window_start
      AND p_now <= s.execution_window_end
  );
$$;

CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty text,
  p_target_institutions text[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_segment public.user_segment := 'guest';
  v_existing public.onboarding_profiles%ROWTYPE;
  v_now timestamptz := now();
  v_min_institutions integer := 1;
  v_result public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_specialty IS NULL OR btrim(p_specialty) = '' THEN
    RAISE EXCEPTION 'Especialidade obrigatoria';
  END IF;

  SELECT p.segment
  INTO v_segment
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_segment = 'guest' THEN
    v_min_institutions := 3;
  END IF;

  IF COALESCE(array_length(p_target_institutions, 1), 0) < v_min_institutions THEN
    RAISE EXCEPTION 'Quantidade minima de instituicoes nao atingida';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.onboarding_profiles o
  WHERE o.user_id = v_user_id;

  IF FOUND THEN
    IF public.is_any_simulado_window_open(v_now) THEN
      RAISE EXCEPTION 'Perfil so pode ser editado entre janelas de execucao';
    END IF;

    UPDATE public.onboarding_profiles
    SET
      specialty = btrim(p_specialty),
      target_institutions = p_target_institutions,
      status = 'completed',
      completed_at = COALESCE(completed_at, v_now),
      updated_at = v_now
    WHERE user_id = v_user_id
    RETURNING *
    INTO v_result;
  ELSE
    INSERT INTO public.onboarding_profiles (
      user_id,
      specialty,
      target_institutions,
      status,
      completed_at
    ) VALUES (
      v_user_id,
      btrim(p_specialty),
      p_target_institutions,
      'completed',
      v_now
    )
    RETURNING *
    INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_onboarding_edit_guard_state()
RETURNS TABLE (
  can_edit boolean,
  reason text,
  next_edit_available_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_active_end timestamptz;
BEGIN
  SELECT MIN(s.execution_window_end)
  INTO v_active_end
  FROM public.simulados s
  WHERE s.status = 'published'
    AND v_now >= s.execution_window_start
    AND v_now <= s.execution_window_end;

  IF v_active_end IS NOT NULL THEN
    RETURN QUERY
    SELECT false, 'edicao_bloqueada_janela_aberta'::text, v_active_end;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, 'ok'::text, NULL::timestamptz;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_attempt_guarded(p_simulado_id uuid)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_effective_deadline timestamptz;
  v_result public.attempts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT *
  INTO v_simulado
  FROM public.simulados s
  WHERE s.id = p_simulado_id
    AND s.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado nao encontrado';
  END IF;

  IF v_now < v_simulado.execution_window_start OR v_now > v_simulado.execution_window_end THEN
    RAISE EXCEPTION 'Simulado fora da janela de execucao';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.attempts a
  WHERE a.simulado_id = p_simulado_id
    AND a.user_id = v_user_id;

  IF FOUND THEN
    IF v_existing.status IN ('submitted', 'expired') THEN
      RAISE EXCEPTION 'Tentativa ja finalizada';
    END IF;

    RETURN v_existing;
  END IF;

  v_effective_deadline := LEAST(
    v_now + make_interval(mins => GREATEST(v_simulado.duration_minutes, 1)),
    v_simulado.execution_window_end
  );

  INSERT INTO public.attempts (
    simulado_id,
    user_id,
    status,
    effective_deadline
  ) VALUES (
    p_simulado_id,
    v_user_id,
    'in_progress',
    v_effective_deadline
  )
  RETURNING *
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_attempt_progress_guarded(
  p_attempt_id uuid,
  p_current_question_index integer,
  p_tab_exit_count integer,
  p_fullscreen_exit_count integer
)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_attempt public.attempts%ROWTYPE;
  v_result public.attempts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.attempts a
  WHERE a.id = p_attempt_id
    AND a.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa nao encontrada';
  END IF;

  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Tentativa nao esta em andamento';
  END IF;

  IF v_now > (v_attempt.effective_deadline + interval '30 seconds') THEN
    UPDATE public.attempts a
    SET
      status = 'expired',
      finished_at = COALESCE(a.finished_at, v_now),
      last_saved_at = v_now
    WHERE a.id = v_attempt.id;
    RAISE EXCEPTION 'Tempo de prova encerrado';
  END IF;

  UPDATE public.attempts a
  SET
    current_question_index = GREATEST(COALESCE(p_current_question_index, 0), 0),
    tab_exit_count = GREATEST(COALESCE(p_tab_exit_count, a.tab_exit_count), 0),
    fullscreen_exit_count = GREATEST(COALESCE(p_fullscreen_exit_count, a.fullscreen_exit_count), 0),
    last_saved_at = v_now
  WHERE a.id = p_attempt_id
  RETURNING *
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attempt_result_notification(
  p_attempt_id uuid,
  p_enabled boolean
)
RETURNS public.attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result public.attempts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  UPDATE public.attempts a
  SET
    notify_result_email = COALESCE(p_enabled, false),
    notify_result_requested_at = CASE WHEN COALESCE(p_enabled, false) THEN now() ELSE NULL END,
    last_saved_at = now()
  WHERE a.id = p_attempt_id
    AND a.user_id = v_user_id
  RETURNING *
  INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa nao encontrada';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_result_notifications(p_limit integer DEFAULT 200)
RETURNS TABLE (
  attempt_id uuid,
  user_id uuid,
  simulado_id uuid,
  user_email text,
  user_name text,
  simulado_title text,
  results_release_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS attempt_id,
    a.user_id,
    a.simulado_id,
    p.email AS user_email,
    p.full_name AS user_name,
    s.title AS simulado_title,
    s.results_release_at
  FROM public.attempts a
  JOIN public.simulados s ON s.id = a.simulado_id
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.notify_result_email = true
    AND a.notify_result_sent_at IS NULL
    AND now() >= s.results_release_at
  ORDER BY s.results_release_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;

CREATE OR REPLACE FUNCTION public.mark_result_notification_sent(p_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.attempts
  SET
    notify_result_sent_at = now(),
    last_saved_at = now()
  WHERE id = p_attempt_id
    AND notify_result_email = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_attempt_with_guard(p_attempt_id uuid)
RETURNS TABLE (
  score_percentage numeric,
  total_correct integer,
  total_answered integer,
  total_questions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.attempts%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT *
  INTO v_attempt
  FROM public.attempts a
  WHERE a.id = p_attempt_id
    AND a.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa nao encontrada';
  END IF;

  IF v_attempt.status IN ('submitted', 'expired') AND v_attempt.score_percentage IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM public.finalize_attempt_with_results(p_attempt_id);
    RETURN;
  END IF;

  IF v_now > (v_attempt.effective_deadline + interval '30 seconds') THEN
    UPDATE public.attempts a
    SET
      status = 'expired',
      finished_at = COALESCE(a.finished_at, v_now),
      last_saved_at = v_now
    WHERE a.id = v_attempt.id;
    RAISE EXCEPTION 'Tempo de prova encerrado';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.finalize_attempt_with_results(p_attempt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_onboarding_guarded(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_edit_guard_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_attempt_progress_guarded(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_attempt_result_notification(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_attempt_with_guard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_result_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_result_notification_sent(uuid) TO service_role;
