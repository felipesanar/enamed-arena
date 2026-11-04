-- Quem fez a prova PRESENCIALMENTE entra no ranking mesmo enviando o gabarito
-- depois do fechamento da janela.
--
-- Contexto: no S7 o resultado foi liberado antes do fim da janela, e para
-- fechar a brecha (113 gabaritos pendentes poderiam consultar o gabarito e
-- so depois preencher) a janela foi encerrada mais cedo. Isso deixaria de
-- fora do ranking os alunos que ainda estavam TRANSCREVENDO o gabarito na
-- sala, com o fiscal do lado -- gente que nao tem nenhuma culpa no cartorio.
--
-- A regra e estreita e se auto-limita: so vale quando o attempt tem
-- `caderno_id`, e caderno so existe para prova aplicada presencialmente, com
-- caderno impresso entregue na sala. O caderno e, na pratica, a prova de que
-- aquela pessoa estava numa aplicacao supervisionada -- que e exatamente o
-- que a janela de execucao tenta garantir. Ninguem consegue se atribuir um
-- caderno sem passar por `set_attempt_caderno_guarded`, que exige ser dono do
-- attempt e o caderno estar ativo.
--
-- Alternativa descartada: recolocar essas pessoas no ranking com UPDATE
-- manual depois. Funciona, mas depende de alguem lembrar -- e o custo de
-- esquecer e um aluno que fez a prova e ficou fora do ranking sem entender
-- por que.
--
-- O resto da funcao e identico ao que estava em producao.

CREATE OR REPLACE FUNCTION public.submit_offline_answers_guarded(p_attempt_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt   public.attempts%ROWTYPE;
  v_simulado  public.simulados%ROWTYPE;
  v_now       TIMESTAMPTZ := now();
  v_is_within BOOLEAN;
  v_ans       jsonb;
  v_q_id      uuid;
  v_opt_id    uuid;
BEGIN
  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND attempt_type = 'offline'
    AND status = 'offline_pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offline attempt not found or already submitted';
  END IF;

  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = v_attempt.simulado_id;

  -- Ranking: envio do gabarito dentro da janela de execucao do simulado, OU
  -- aplicacao presencial (attempt com caderno). Ver cabecalho.
  v_is_within := (
    v_now >= v_simulado.execution_window_start
    AND v_now <= v_simulado.execution_window_end
  ) OR v_attempt.caderno_id IS NOT NULL;

  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id := (v_ans->>'question_id')::uuid;

    IF (v_ans->>'selected_option_id') IS NOT NULL THEN
      v_opt_id := (v_ans->>'selected_option_id')::uuid;
    ELSE
      v_opt_id := NULL;
    END IF;

    INSERT INTO public.answers (
      attempt_id, question_id, selected_option_id,
      marked_for_review, high_confidence, eliminated_options, answered_at
    )
    VALUES (
      p_attempt_id, v_q_id, v_opt_id,
      false, false, '{}',
      CASE WHEN v_opt_id IS NOT NULL THEN v_now ELSE NULL END
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      selected_option_id = EXCLUDED.selected_option_id,
      answered_at        = EXCLUDED.answered_at;
  END LOOP;

  UPDATE public.attempts SET
    offline_answers_submitted_at = v_now,
    finished_at                  = v_now,
    is_within_window             = v_is_within
  WHERE id = p_attempt_id;

  PERFORM public.finalize_attempt_with_results(p_attempt_id);

  UPDATE public.attempts SET
    is_within_window = v_is_within
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id',       p_attempt_id,
    'is_within_window', v_is_within
  );
END;
$function$;
