-- Fix round 1/5 do review da Task 4 (presencial_attempt_rpcs).
--
-- 1) Important — corrida no check-in de aluno SEM attempt prévio: os dois
--    `SELECT ... FOR UPDATE` não travam nada quando não há linha nenhuma para
--    o par (simulado, usuário), então dois check-ins concorrentes chegam os
--    dois ao INSERT. A UNIQUE (simulado_id, user_id, attempt_type) impede
--    duplicata (não há risco de dado corrompido/nota dobrada), mas o perdedor
--    recebia um 23505 cru em vez do retorno idempotente do vencedor — em uma
--    sala com ~100 check-ins simultâneos por celular/rede instável, duplo
--    toque e retry são o caso comum. Fix: INSERT envolvido por
--    `EXCEPTION WHEN unique_violation`, relendo o attempt presencial do
--    vencedor e devolvendo o mesmo id (ou levantando
--    PRESENCIAL_ALREADY_SUBMITTED se ele já foi enviado).
--    A corrida de CONVERSÃO (attempt online/offline já existente) já estava
--    corretamente protegida pelo FOR UPDATE + reavaliação do WHERE — não
--    mexida aqui.
--
-- 2) Minor — comentário morto/errado em submit_presencial_answers: o UPDATE
--    dentro de finalize_attempt_with_results_for_user nunca toca
--    is_within_window (só status/finished_at/score_percentage/total_correct/
--    total_answered/last_saved_at), então o segundo UPDATE de
--    is_within_window era redundante e o comentário afirmava algo falso
--    sobre outra função. Removido.
--
-- 3) Minor — is_within_window não era zerado na conversão in-place, ficando
--    com o valor herdado do attempt online/offline enquanto presencial_pending
--    (inerte na prática, mas inconsistente com o resto do zeramento). Zerado
--    junto de score/total_correct/total_answered/finished_at.
--
-- Não mexido (observação diferida, fora de escopo): effective_deadline
-- calculado de duration_minutes mesmo sem sessão cronometrada, e herdado
-- (não recalculado) na conversão.

CREATE OR REPLACE FUNCTION public.create_or_convert_presencial_attempt(
  p_simulado_id uuid,
  p_user_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_simulado public.simulados%ROWTYPE;
  v_existing public.attempts%ROWTYPE;
  v_now      timestamptz := now();
  v_new      public.attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_simulado FROM public.simulados
  WHERE id = p_simulado_id AND status IN ('published','test');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  -- Já é presencial? Idempotente enquanto pendente; bloqueado depois de enviado.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = p_user_id
    AND attempt_type = 'presencial'
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'presencial_pending' THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'PRESENCIAL_ALREADY_SUBMITTED';
  END IF;

  -- Existe attempt online/offline? Converte in-place, com snapshot.
  SELECT * INTO v_existing FROM public.attempts
  WHERE simulado_id = p_simulado_id AND user_id = p_user_id
    AND attempt_type IN ('online','offline')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    INSERT INTO backup.presencial_superseded_answers (
      attempt_id, user_id, simulado_id, answers, previous_status, previous_score
    )
    SELECT
      v_existing.id, p_user_id, p_simulado_id,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'question_id', a.question_id, 'selected_option_id', a.selected_option_id))
        FROM public.answers a WHERE a.attempt_id = v_existing.id
      ), '[]'::jsonb),
      v_existing.status, v_existing.score_percentage;

    -- Zera a nota (e is_within_window, herdado e sem sentido em pending) para
    -- que o finalize não caia no early-return.
    UPDATE public.attempts SET
      attempt_type     = 'presencial',
      status           = 'presencial_pending',
      score_percentage = NULL,
      total_correct    = NULL,
      total_answered   = NULL,
      finished_at      = NULL,
      is_within_window = false,
      started_at       = v_now,
      last_saved_at    = v_now
    WHERE id = v_existing.id;

    -- A linha de histórico da tentativa antiga é sobrescrita no finalize
    -- (ON CONFLICT (attempt_id)); remover aqui evita nota velha visível
    -- na janela entre a conversão e o envio.
    DELETE FROM public.user_performance_history WHERE attempt_id = v_existing.id;
    PERFORM public.recalculate_user_performance(p_user_id);

    RETURN v_existing.id;
  END IF;

  -- Sem attempt nenhum: cria. Dois check-ins concorrentes para o mesmo aluno
  -- (duplo toque, retry de rede) não têm nada para os FOR UPDATE acima
  -- travarem, então os dois chegam aqui; a UNIQUE (simulado_id, user_id,
  -- attempt_type) barra o perdedor — que é tratado abaixo em vez de estourar
  -- um 23505 cru para o aluno.
  BEGIN
    INSERT INTO public.attempts (
      simulado_id, user_id, status, attempt_type, started_at, effective_deadline,
      current_question_index, tab_exit_count, fullscreen_exit_count, is_within_window
    )
    VALUES (
      p_simulado_id, p_user_id, 'presencial_pending', 'presencial', v_now,
      v_now + (v_simulado.duration_minutes || ' minutes')::interval,
      0, 0, 0, false
    )
    RETURNING * INTO v_new;

    RETURN v_new.id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.attempts
    WHERE simulado_id = p_simulado_id AND user_id = p_user_id
      AND attempt_type = 'presencial';

    IF NOT FOUND THEN
      RAISE;
    END IF;

    IF v_existing.status = 'presencial_pending' THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'PRESENCIAL_ALREADY_SUBMITTED';
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_convert_presencial_attempt(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_convert_presencial_attempt(uuid, uuid)
  TO service_role;

-- ─── Gravação + finalização ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_presencial_answers(
  p_attempt_id uuid,
  p_user_id    uuid,
  p_answers    jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt   public.attempts%ROWTYPE;
  v_simulado  public.simulados%ROWTYPE;
  v_now       timestamptz := now();
  v_is_within boolean;
  v_ans       jsonb;
  v_q_id      uuid;
  v_opt_id    uuid;
BEGIN
  SELECT * INTO v_attempt FROM public.attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
    AND attempt_type = 'presencial' AND status = 'presencial_pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRESENCIAL_ATTEMPT_NOT_PENDING';
  END IF;

  SELECT * INTO v_simulado FROM public.simulados WHERE id = v_attempt.simulado_id;

  -- Mesma regra do offline: vale para ranking se o envio cai dentro da janela.
  v_is_within := (v_now >= v_simulado.execution_window_start
              AND v_now <= v_simulado.execution_window_end);

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id   := (v_ans->>'question_id')::uuid;
    v_opt_id := NULLIF(v_ans->>'selected_option_id','')::uuid;

    INSERT INTO public.answers (
      attempt_id, question_id, selected_option_id,
      marked_for_review, high_confidence, eliminated_options, answered_at
    )
    VALUES (
      p_attempt_id, v_q_id, v_opt_id, false, false, '{}',
      CASE WHEN v_opt_id IS NOT NULL THEN v_now ELSE NULL END
    )
    ON CONFLICT (attempt_id, question_id) DO UPDATE
    SET selected_option_id = EXCLUDED.selected_option_id,
        answered_at        = EXCLUDED.answered_at;
  END LOOP;

  UPDATE public.attempts SET
    finished_at      = v_now,
    is_within_window = v_is_within
  WHERE id = p_attempt_id;

  -- finalize_attempt_with_results_for_user só toca status/finished_at/
  -- score_percentage/total_correct/total_answered/last_saved_at — nunca
  -- is_within_window — então o UPDATE acima não precisa ser reafirmado depois.
  PERFORM public.finalize_attempt_with_results_for_user(p_attempt_id, p_user_id);

  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'is_within_window', v_is_within);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_presencial_answers(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_presencial_answers(uuid, uuid, jsonb)
  TO service_role;
