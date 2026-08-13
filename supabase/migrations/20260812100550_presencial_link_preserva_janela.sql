-- Fix round 1/5 (Task 6): vínculo tardio não pode custar o ranking do aluno.
--
-- submit_presencial_answers calcula is_within_window a partir de now() — bug
-- para link_presencial_submission: a fila de identidade do admin existe
-- justamente para ser resolvida DEPOIS do evento, então now() no momento do
-- vínculo não tem relação com o momento real do envio do aluno. Isso fazia
-- o aluno perder o ranking por um atraso administrativo que não é dele,
-- quebrando a promessa da spec ("um clique vincula e a nota entra no
-- histórico E NO RANKING dele").
--
-- Abordagem: NÃO se altera a assinatura nem o corpo de
-- submit_presencial_answers. Testado empiricamente (funções descartáveis em
-- sandbox, criadas e removidas nesta sessão, fora deste arquivo) que
-- adicionar um 4º parâmetro com DEFAULT a essa função, mantendo a versão de
-- 3 argumentos existente viva ao lado dela, cria AMBIGUIDADE DE OVERLOAD
-- real: uma chamada com exatamente 3 argumentos (exatamente como a edge
-- function `supabase/functions/presencial/index.ts` já chama, no fluxo em
-- tempo real) passa a bater com as DUAS funções e falha em runtime com
-- `42725: function ... is not unique`. Substituir a função de 3 argumentos
-- por uma única versão de 4 (via DROP + CREATE) eliminaria a ambiguidade,
-- mas muda a assinatura de uma função hoje usada só pelo fluxo em tempo
-- real — fora do escopo desta correção sem validação explícita do
-- orquestrador.
--
-- Fix aplicado só em link_presencial_submission: depois de chamar
-- submit_presencial_answers (inalterada — ainda calcula is_within_window a
-- partir de now(), irrelevante aqui porque o valor é IMEDIATAMENTE
-- recalculado e sobrescrito a seguir), recalcula is_within_window usando
-- v_sub.submitted_at (o momento real do ENVIO do aluno) contra a janela de
-- execução do simulado, e sobrescreve tanto attempts.is_within_window
-- quanto o campo correspondente no jsonb de retorno. finished_at/answered_at
-- continuam refletindo o momento real da gravação (não tocados).

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
  -- enviada — mas nesse caso `answers` também é '[]'::jsonb (default da
  -- coluna), e a guarda SUBMISSION_HAS_NO_ANSWERS acima já teria abortado.
  -- A edge function (supabase/functions/presencial/index.ts, handleSubmit)
  -- sempre grava `answers` e `submitted_at` na MESMA instrução UPDATE, nos
  -- dois ramos (linked e unlinked) — não existe caminho de escrita que
  -- popule um sem o outro.
  SELECT * INTO v_simulado FROM public.simulados WHERE id = v_sub.simulado_id;
  v_is_within := (v_sub.submitted_at >= v_simulado.execution_window_start
              AND v_sub.submitted_at <= v_simulado.execution_window_end);

  UPDATE public.attempts SET is_within_window = v_is_within WHERE id = v_attempt;
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
