-- =====================================================================
-- Caderno de Erros v2 — Lacuna lesson-gating trigger (plano 08 §3.5)
-- =====================================================================
-- Dependências:
--   20260606120001_caderno_v2_schema.sql  (colunas SRS, last_review_outcome)
--   20260606120002_caderno_v2_rpcs.sql    (versão anterior desta função)
--
-- PROBLEMA QUE ESTA MIGRATION RESOLVE
-- -----------------------------------
-- O schema, os RPCs, o LessonUnlockDialog e clear_awaiting_lesson_guarded já
-- existem. schedule_next_review_guarded JÁ BLOQUEIA o re-teste quando
-- last_review_outcome = 'awaiting_lesson'. Porém NADA setava esse estado, então
-- o gating de Lacuna nunca era acionado.
--
-- MUDANÇA
-- -------
-- Esta migration faz CREATE OR REPLACE de add_to_notebook_bulk_guarded
-- preservando TODO o comportamento existente (dedup por (user_id, question_id),
-- ressurreição de soft-delete, limite de 100, defaults SRS, retorno), mas
-- adiciona UMA regra: ao INSERIR uma nova entrada cujo reason = 'did_not_know'
-- (Lacuna), o campo last_review_outcome nasce como 'awaiting_lesson', de modo
-- que a entrada já começa GATED e o re-teste fica bloqueado até o aluno estudar.
--
-- SEGURANÇA / IDEMPOTÊNCIA
-- ------------------------
--   * Só afeta INSERTs de entradas NOVAS. Linhas existentes (ativas ou
--     soft-deleted/ressuscitadas) NÃO são tocadas — não clobbera estado SRS
--     já evoluído de quem já revisou.
--   * Entradas com reason != 'did_not_know' continuam com last_review_outcome
--     NULL (comportamento anterior, default da coluna).
--   * CREATE OR REPLACE → re-execução é segura.
--
-- CAMINHO DE DESBLOQUEIO (UNLOCK)
-- -------------------------------
-- A entrada sai do estado 'awaiting_lesson' via clear_awaiting_lesson_guarded
-- (chamado pela UI quando o aluno confirma "Já estudei isso" ou abre a aula).
-- Esta função apenas SETA o gate na criação; nunca o remove.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.add_to_notebook_bulk_guarded(
  p_entries jsonb   -- array de objetos (schema documentado abaixo)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
/*
  Schema de cada objeto em p_entries:
  {
    "simulado_id":          uuid   | null,
    "question_id":          uuid,          -- obrigatório (chave de dedup)
    "area":                 text   | null,
    "theme":                text   | null,
    "reason":               error_reason,  -- enum do banco
    "learning_text":        text   | null, -- truncado em 300 chars
    "was_correct":          boolean,
    "question_number":      int    | null,
    "question_text":        text   | null, -- truncado em 500 chars
    "simulado_title":       text   | null,
    "confidence_at_answer": text   | null  -- 'baixa' | 'media' | 'alta'
  }
*/
DECLARE
  v_uid         uuid := auth.uid();
  v_item        jsonb;
  v_question_id uuid;
  v_reason      error_reason;
  v_entry_id    uuid;
  v_inserted    int  := 0;
  v_skipped     int  := 0;
  v_entry_ids   uuid[] := '{}';
BEGIN
  -- ── Autenticação ─────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- ── Proteção de tamanho (100 entradas máximo) ────────────────────
  IF jsonb_array_length(p_entries) > 100 THEN
    RAISE EXCEPTION 'too_many_entries: máximo 100 entradas por chamada';
  END IF;

  -- ── Iterar sobre cada item do array ──────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_question_id := (v_item->>'question_id')::uuid;
    v_reason      := (v_item->>'reason')::error_reason;  -- cast valida o enum automaticamente

    -- Verificar existência (ativa ou soft-deleted)
    SELECT id INTO v_entry_id
      FROM public.error_notebook
     WHERE user_id     = v_uid
       AND question_id = v_question_id
     LIMIT 1;

    IF FOUND THEN
      -- Ressuscitar soft-delete se aplicável
      -- NOTA: não alteramos last_review_outcome aqui — preservamos o estado
      -- SRS já evoluído da entrada existente (não re-gating de Lacuna).
      UPDATE public.error_notebook
         SET deleted_at = NULL,
             updated_at = now()
       WHERE id = v_entry_id
         AND deleted_at IS NOT NULL;

      -- Conta como skipped (mesmo ressuscitado a semântica é "já existia")
      v_skipped   := v_skipped + 1;
      v_entry_ids := array_append(v_entry_ids, v_entry_id);
    ELSE
      -- Inserir nova entrada com defaults SRS
      INSERT INTO public.error_notebook (
        user_id,
        simulado_id,
        question_id,
        area,
        theme,
        reason,
        learning_text,
        was_correct,
        question_number,
        question_text,
        simulado_title,
        confidence_at_answer,
        srs_ease,
        srs_interval,
        srs_reps,
        srs_lapses,
        srs_due_at,
        last_review_outcome
      ) VALUES (
        v_uid,
        (v_item->>'simulado_id')::uuid,
        v_question_id,
        v_item->>'area',
        v_item->>'theme',
        v_reason,
        LEFT(v_item->>'learning_text', 300),
        COALESCE((v_item->>'was_correct')::boolean, false),
        (v_item->>'question_number')::int,
        LEFT(v_item->>'question_text', 500),
        v_item->>'simulado_title',
        CASE
          WHEN v_item->>'confidence_at_answer' IN ('baixa', 'media', 'alta')
          THEN v_item->>'confidence_at_answer'
          ELSE NULL
        END,
        2.5,    -- srs_ease default
        1,      -- srs_interval default (1 dia)
        0,      -- srs_reps
        0,      -- srs_lapses
        now(),  -- srs_due_at: devida imediatamente
        -- ── Lacuna gating ───────────────────────────────────────────
        -- reason = 'did_not_know' (Lacuna) nasce GATED em 'awaiting_lesson';
        -- demais reasons mantêm NULL (comportamento anterior). Desbloqueio
        -- via clear_awaiting_lesson_guarded.
        CASE
          WHEN v_reason = 'did_not_know'::error_reason THEN 'awaiting_lesson'
          ELSE NULL
        END
      )
      RETURNING id INTO v_entry_id;

      v_inserted  := v_inserted + 1;
      v_entry_ids := array_append(v_entry_ids, v_entry_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'added',      v_inserted,
    'skipped',    v_skipped,
    'entry_ids',  v_entry_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_to_notebook_bulk_guarded(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_to_notebook_bulk_guarded(jsonb) TO authenticated;
