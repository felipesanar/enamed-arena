-- Criacao da tentativa do aluno que fez a prova PRESENCIALMENTE, no papel.
--
-- Por que nao usar create_offline_attempt_guarded direto: ela RECUSA quem tem
-- uma tentativa online 'in_progress' ("An online attempt is already in
-- progress"). No S7 havia 74 attempts nesse estado no dia do evento. Quem
-- comecou a prova online, abandonou, e fez no papel ficaria travado na sala,
-- sem caminho -- e o fiscal nao tem como destravar. Aqui aplicamos a regra que
-- ja tinha sido decidida para o presencial na v1: PRESENCIAL GANHA,
-- convertendo a tentativa online abandonada in-place em offline_pending.
--
-- Converter in-place (em vez de criar outra e arquivar a antiga) mantem UMA
-- linha por aluno por simulado, invariante que ranking, historico e admin ja
-- assumem. As respostas online originais vao para
-- backup.presencial_superseded_answers antes de qualquer coisa -- nada e
-- descartado em silencio.
--
-- Devolve o MESMO shape de create_offline_attempt_guarded (o front reusa o
-- caminho existente), mais `converted_from_online`, para a tela poder avisar
-- o aluno de que a tentativa online anterior foi substituida.

CREATE OR REPLACE FUNCTION public.create_presencial_attempt_guarded(p_simulado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_simulado  public.simulados%ROWTYPE;
  v_existing  public.attempts%ROWTYPE;
  v_now       timestamptz := now();
  v_in_window boolean;
  v_exam_secs integer;
  v_new       public.attempts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_simulado FROM public.simulados
  WHERE id = p_simulado_id AND status IN ('published', 'test');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  v_exam_secs := v_simulado.duration_minutes * 60;
  v_in_window := (v_now >= v_simulado.execution_window_start
              AND v_now <= v_simulado.execution_window_end);

  -- 1) Ja existe offline_pending? Idempotente -- e o mesmo gabarito.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = auth.uid()
    AND status = 'offline_pending'
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id', v_existing.id,
      'started_at', v_existing.started_at,
      'exam_duration_seconds', v_exam_secs,
      'simulado_slug', v_simulado.slug,
      'converted_from_online', false
    );
  END IF;

  -- 2) Ja enviou? Tentativa unica continua valendo.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = auth.uid()
    AND status IN ('submitted', 'expired');

  IF FOUND THEN
    RAISE EXCEPTION 'Attempt already submitted for this simulado';
  END IF;

  -- 3) Online abandonada: converte in-place. Backup ANTES de mexer.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = auth.uid()
    AND status = 'in_progress'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    INSERT INTO backup.presencial_superseded_answers (
      attempt_id, user_id, simulado_id, answers, previous_status, previous_score
    )
    SELECT
      v_existing.id, auth.uid(), p_simulado_id,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'question_id', a.question_id, 'selected_option_id', a.selected_option_id))
        FROM public.answers a WHERE a.attempt_id = v_existing.id
      ), '[]'::jsonb),
      v_existing.status, v_existing.score_percentage;

    UPDATE public.attempts SET
      attempt_type     = 'offline',
      status           = 'offline_pending',
      score_percentage = NULL,
      total_correct    = NULL,
      total_answered   = NULL,
      finished_at      = NULL,
      is_within_window = v_in_window,
      started_at       = v_now,
      last_saved_at    = v_now
    WHERE id = v_existing.id;

    -- A linha de historico da tentativa antiga e reescrita no finalize
    -- (ON CONFLICT (attempt_id)); remove-la aqui evita nota velha visivel na
    -- janela entre a conversao e o envio do gabarito.
    DELETE FROM public.user_performance_history WHERE attempt_id = v_existing.id;
    PERFORM public.recalculate_user_performance(auth.uid());

    RETURN jsonb_build_object(
      'attempt_id', v_existing.id,
      'started_at', v_now,
      'exam_duration_seconds', v_exam_secs,
      'simulado_slug', v_simulado.slug,
      'converted_from_online', true
    );
  END IF;

  -- 4) Sem tentativa nenhuma: cria.
  INSERT INTO public.attempts (
    simulado_id, user_id, status, attempt_type, started_at, effective_deadline,
    current_question_index, tab_exit_count, fullscreen_exit_count, is_within_window
  )
  VALUES (
    p_simulado_id, auth.uid(), 'offline_pending', 'offline', v_now,
    v_now + (v_simulado.duration_minutes || ' minutes')::interval,
    0, 0, 0, v_in_window
  )
  RETURNING * INTO v_new;

  RETURN jsonb_build_object(
    'attempt_id', v_new.id,
    'started_at', v_new.started_at,
    'exam_duration_seconds', v_exam_secs,
    'simulado_slug', v_simulado.slug,
    'converted_from_online', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_presencial_attempt_guarded(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_presencial_attempt_guarded(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_presencial_attempt_guarded(uuid) TO authenticated, service_role;
