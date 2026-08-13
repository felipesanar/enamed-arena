-- Fix round 2/5 (Task 6): a mesma classe de bug do round 1, num campo
-- diferente. submit_presencial_answers (que continuamos sem tocar) grava
-- attempts.finished_at = now() -- correto no fluxo em tempo real, errado
-- quando link_presencial_submission chama a mesma função dias depois do
-- evento: finished_at passa a registrar o momento em que o ADMIN resolveu a
-- fila, não o momento em que o ALUNO enviou o gabarito.
--
-- Isso importa porque finished_at é o critério de DESEMPATE do ranking real
-- (get_ranking_for_simulado e admin_get_ranking_for_simulado ordenam por
-- score_percentage DESC, finished_at ASC; o dedupe de melhor tentativa em
-- admin_get_ranking_for_simulado usa o mesmo critério). O round 1 corrigiu a
-- ELEGIBILIDADE de entrada no ranking (is_within_window); este round corrige
-- a POSIÇÃO dentro dele -- sem isso, um aluno presencial vinculado pela fila
-- (o cenário normal) ficaria sistematicamente atrás de qualquer aluno com a
-- mesma nota, por causa de quando o time resolveu a fila, não da prova dele.
--
-- Mesma técnica já validada no round 1: não se altera submit_presencial_answers
-- (nem assinatura, nem corpo) -- link_presencial_submission recalcula e
-- sobrescreve finished_at usando v_sub.submitted_at, unificado no mesmo
-- UPDATE que já sobrescrevia is_within_window.

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

  -- Sobrescreve os dois campos que submit_presencial_answers calculou a
  -- partir de now() (o momento do VÍNCULO, não do ENVIO): is_within_window
  -- (round 1) e finished_at (round 2, este) -- unificados no mesmo UPDATE
  -- para não correr o risco de corrigir um e esquecer o outro no futuro.
  -- finished_at não é tocado dentro de submit_presencial_answers de novo
  -- (já rodou lá); aqui só substituímos o valor gravado por ela.
  UPDATE public.attempts SET
    is_within_window = v_is_within,
    finished_at      = v_sub.submitted_at
  WHERE id = v_attempt;
  v_res := jsonb_set(v_res, '{is_within_window}', to_jsonb(v_is_within));

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
