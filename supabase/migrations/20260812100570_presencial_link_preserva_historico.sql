-- Fix round 3/5 (Task 6): terceira instância da mesma classe de bug (campo
-- temporal gravado a partir de now() em vez do submitted_at real do aluno),
-- desta vez em user_performance_history/user_performance_summary em vez de
-- attempts.
--
-- finalize_attempt_with_results_for_user (chamada de dentro de
-- submit_presencial_answers, que continuamos sem tocar) grava
-- user_performance_history.finished_at = COALESCE(attempts.finished_at, now())
-- -- e nesse ponto attempts.finished_at já foi setado para now() pelo próprio
-- submit_presencial_answers, ANTES do UPDATE de correção que
-- link_presencial_submission faz depois (rounds 1/2). finalize também chama
-- recalculate_user_performance() uma vez, então user_performance_summary.
-- last_finished_at (e possivelmente last_score/last_simulado_id, se o
-- attempt recém-linkado -- com finished_at=now(), quase certamente o mais
-- recente possível -- vencer o ORDER BY finished_at DESC LIMIT 1) também
-- herdam o valor errado.
--
-- Impacto real: get_user_performance_history ordena por finished_at DESC e
-- alimenta o gráfico de evolução de notas que o PRÓPRIO ALUNO vê
-- (useRankingEvolution.ts) -- o presencial vinculado tarde apareceria fora
-- de ordem cronológica. last_finished_at aparece como "Última atividade" em
-- AdminUsuarioDetail.tsx.
--
-- Fix: mesma técnica dos rounds 1 e 2 (não tocar submit_presencial_answers),
-- estendida à cadeia de tabelas derivadas -- depois do UPDATE em attempts,
-- corrige user_performance_history.finished_at e chama
-- recalculate_user_performance de novo, agora sobre o histórico já correto.
-- Ordem importa: corrigir o histórico ANTES de recalcular o resumo.

CREATE OR REPLACE FUNCTION public.link_presencial_submission(
  p_submission_id uuid,
  p_user_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub       public.presencial_submissions%ROWTYPE;
  v_simulado  public.simulados%ROWTYPE;
  v_attempt   uuid;
  v_res       jsonb;
  v_is_within boolean;
BEGIN
  SELECT * INTO v_sub FROM public.presencial_submissions
  WHERE id = p_submission_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;
  IF v_sub.status = 'linked' THEN
    RAISE EXCEPTION 'SUBMISSION_ALREADY_LINKED';
  END IF;
  IF jsonb_array_length(COALESCE(v_sub.answers, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'SUBMISSION_HAS_NO_ANSWERS';
  END IF;

  v_attempt := public.create_or_convert_presencial_attempt(v_sub.simulado_id, p_user_id);
  v_res     := public.submit_presencial_answers(v_attempt, p_user_id, v_sub.answers);

  -- v_sub.submitted_at é garantidamente não-nulo neste ponto: a única forma
  -- de uma submissão chegar aqui com submitted_at nulo seria nunca ter sido
  -- enviada -- mas nesse caso `answers` também é '[]'::jsonb (default da
  -- coluna), e a guarda SUBMISSION_HAS_NO_ANSWERS acima já teria abortado.
  -- A edge function (supabase/functions/presencial/index.ts, handleSubmit)
  -- sempre grava `answers` e `submitted_at` na MESMA instrução UPDATE, nos
  -- dois ramos (linked e unlinked) -- não existe caminho de escrita que
  -- popule um sem o outro.
  SELECT * INTO v_simulado FROM public.simulados WHERE id = v_sub.simulado_id;
  v_is_within := (v_sub.submitted_at >= v_simulado.execution_window_start
              AND v_sub.submitted_at <= v_simulado.execution_window_end);

  -- Sobrescreve os campos que submit_presencial_answers calculou a partir de
  -- now() (o momento do VÍNCULO, não do ENVIO): is_within_window (round 1) e
  -- finished_at (round 2), unificados no mesmo UPDATE.
  UPDATE public.attempts SET
    is_within_window = v_is_within,
    finished_at      = v_sub.submitted_at
  WHERE id = v_attempt;
  v_res := jsonb_set(v_res, '{is_within_window}', to_jsonb(v_is_within));

  -- Round 3: a mesma correção precisa alcançar a tabela de histórico (que
  -- finalize_attempt_with_results_for_user já gravou com o finished_at
  -- errado, antes do UPDATE acima existir) e o resumo agregado, que já foi
  -- recalculado uma vez em cima do valor errado. Corrige o histórico
  -- primeiro, recalcula o resumo depois -- a ordem importa.
  UPDATE public.user_performance_history SET finished_at = v_sub.submitted_at
  WHERE attempt_id = v_attempt;
  PERFORM public.recalculate_user_performance(p_user_id);

  UPDATE public.presencial_submissions SET
    linked_user_id    = p_user_id,
    linked_attempt_id = v_attempt,
    status            = 'linked',
    linked_at         = now()
  WHERE id = p_submission_id;

  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_presencial_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_presencial_submission(uuid, uuid) TO service_role;
