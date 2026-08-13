-- Task 5 (aplicação presencial do Simulado 7): create_attempt_guarded bloqueia
-- a prova online quando o aluno já tem um attempt presencial para o mesmo
-- simulado (pendente ou enviado). Hoje a função só considera
-- attempt_type='online' nos checks de "já enviado", então quem fez a prova
-- presencialmente ainda conseguiria abrir a versão online.
--
-- CREATE OR REPLACE sobre a definição capturada em produção via
-- pg_get_functiondef (retorno `attempts`, inalterado). Único bloco novo:
-- checar attempt presencial (qualquer status) logo após a validação de
-- simulado publicado, e antes de qualquer outro check de attempt existente.
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

  -- Presencial tem precedência: uma vez enviado o gabarito presencial,
  -- o simulado está feito e a prova online fica fechada.
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND attempt_type = 'presencial';

  IF FOUND THEN
    RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_EXISTS';
  END IF;

  v_in_window := (v_now >= v_simulado.execution_window_start AND v_now <= v_simulado.execution_window_end);

  -- Only check online attempts (ignore offline_pending)
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND attempt_type = 'online'
    AND status = 'in_progress';

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Only check online submitted/expired (ignore offline)
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND attempt_type = 'online'
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
    simulado_id, user_id, status, attempt_type, started_at, effective_deadline,
    current_question_index, tab_exit_count, fullscreen_exit_count, is_within_window
  )
  VALUES (
    p_simulado_id, auth.uid(), 'in_progress', 'online', v_now, v_effective_deadline,
    0, 0, 0, v_in_window
  )
  RETURNING * INTO v_new_attempt;

  RETURN v_new_attempt;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_attempt_guarded(uuid) TO authenticated, service_role;
