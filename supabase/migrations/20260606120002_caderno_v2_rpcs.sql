-- =====================================================================
-- Caderno de Erros v2 — RPCs SECURITY DEFINER
-- =====================================================================
-- Dependência: 20260606120001_caderno_v2_schema.sql
--   (colunas SRS em error_notebook, tabela review_attempts)
--
-- Funções entregues:
--   1. schedule_next_review_guarded   — motor SM-2-lite com modulação por reason
--   2. record_review_attempt_guarded  — log imutável de re-resolução
--   3. add_to_notebook_bulk_guarded   — inserção em lote idempotente (limite 100)
--   4. reset_leech_guarded            — desbloqueia entry leech
--   5. snooze_error_notebook_entry    — atualizado para setar srs_due_at (override)
--
-- Idempotente: CREATE OR REPLACE em todas as funções.
-- =====================================================================


-- =====================================================================
-- 1. schedule_next_review_guarded
-- =====================================================================
-- Aplica o algoritmo SM-2-lite após re-resolução em recall ativo.
-- Valida ownership, enums e bloqueios (awaiting_lesson, leech_blocked).
-- Modula ease inicial por reason (primeira revisão, srs_reps = 0).
-- Aplica override de confiança baixa (trata como q=2 "dificil").
-- Verifica e seta mastered_at quando todas as condições de domínio
-- são satisfeitas; reverte mastered_at em lapso.
-- Detecta leech (srs_lapses >= 4) e bloqueia via last_review_outcome.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,   -- 'errei' | 'dificil' | 'bom' | 'facil'
  p_confidence text    -- 'baixa' | 'media' | 'alta'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry          error_notebook%ROWTYPE;
  v_uid            uuid := auth.uid();

  -- Parâmetros SM-2 e de domínio (centralizados aqui para facilitar ajuste)
  c_ease_default   CONSTANT float8 := 2.5;
  c_ease_lacuna    CONSTANT float8 := 2.1;
  c_ease_diferencial CONSTANT float8 := 2.3;
  c_ease_atencao   CONSTANT float8 := 2.8;
  c_ease_min       CONSTANT float8 := 1.3;
  c_ease_max       CONSTANT float8 := 3.5;
  c_leech_threshold CONSTANT int4  := 4;
  c_mastery_reps   CONSTANT int4   := 3;
  c_mastery_interval CONSTANT int4 := 21;

  -- Estado calculado
  v_was_correct    boolean;
  v_q              int4;   -- SM-2 quality: 0/2/3/4
  v_ease_base      float8;
  v_delta_ease     float8;
  v_new_ease       float8;
  v_new_reps       int4;
  v_new_lapses     int4;
  v_new_interval   int4;
  v_new_outcome    text;
  v_new_due_at     timestamptz;
  v_new_mastered_at timestamptz;
  v_is_leech       boolean := false;

  -- Para checagem de domínio (últimas 2 revisões)
  v_last2_conf     text[];
  v_chute_promo    boolean := false;
BEGIN
  -- ── Autenticação ────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- ── Carregar e validar ownership ─────────────────────────────────
  SELECT * INTO v_entry
    FROM public.error_notebook
   WHERE id = p_entry_id
     AND user_id = v_uid
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found_or_forbidden';
  END IF;

  -- ── Validar enums de entrada ─────────────────────────────────────
  IF p_outcome NOT IN ('errei', 'dificil', 'bom', 'facil') THEN
    RAISE EXCEPTION 'invalid_outcome: %', p_outcome;
  END IF;
  IF p_confidence NOT IN ('baixa', 'media', 'alta') THEN
    RAISE EXCEPTION 'invalid_confidence: %', p_confidence;
  END IF;

  -- ── Checar bloqueios ─────────────────────────────────────────────
  IF v_entry.last_review_outcome = 'awaiting_lesson' THEN
    RAISE EXCEPTION 'review_blocked: awaiting_lesson — desbloqueie a entrada antes de revisar';
  END IF;
  IF v_entry.last_review_outcome = 'leech_blocked' THEN
    RAISE EXCEPTION 'review_blocked: leech_intervention_required — use reset_leech_guarded primeiro';
  END IF;

  -- ── Inferir was_correct e quality q ─────────────────────────────
  v_was_correct := (p_outcome <> 'errei');
  v_q := CASE p_outcome
           WHEN 'errei'   THEN 0
           WHEN 'dificil' THEN 2
           WHEN 'bom'     THEN 3
           WHEN 'facil'   THEN 4
         END;

  -- ── Override de confiança baixa (trata como q=2 independente da avaliação) ──
  IF p_confidence = 'baixa' AND v_q > 2 THEN
    v_q := 2;
  END IF;

  -- ── Ease base (modulado por reason apenas na primeira revisão) ────
  IF v_entry.srs_reps = 0 THEN
    v_ease_base := CASE v_entry.reason::text
                     WHEN 'did_not_know'          THEN c_ease_lacuna
                     WHEN 'guessed_correctly'     THEN c_ease_lacuna
                     WHEN 'confused_alternatives' THEN c_ease_diferencial
                     WHEN 'reading_error'         THEN c_ease_atencao
                     ELSE c_ease_default  -- did_not_remember, did_not_understand (legado)
                   END;
  ELSE
    v_ease_base := v_entry.srs_ease;
  END IF;

  -- ── Calcular novo estado SRS ─────────────────────────────────────
  IF v_q = 0 THEN
    -- Lapso
    v_new_reps     := 0;
    v_new_lapses   := v_entry.srs_lapses + 1;
    v_new_ease     := GREATEST(c_ease_min, v_ease_base - 0.20);
    v_new_interval := GREATEST(1, ROUND(v_entry.srs_interval * 0.20)::int4);
    v_new_outcome  := 'errei';
  ELSE
    -- Acerto
    v_new_reps   := v_entry.srs_reps + 1;
    v_new_lapses := v_entry.srs_lapses;  -- lapses não muda em acerto

    -- Delta ease pela fórmula SM-2: Δ = 0.1 - (4-q) * (0.08 + (4-q)*0.02)
    v_delta_ease := 0.1 - (4 - v_q)::float8 * (0.08 + (4 - v_q)::float8 * 0.02);
    v_new_ease   := GREATEST(c_ease_min, LEAST(c_ease_max, v_ease_base + v_delta_ease));

    -- Intervalo por número de reps (modulado por reason=reading_error)
    IF v_entry.reason::text = 'reading_error' THEN
      v_new_interval := CASE v_new_reps
                          WHEN 1 THEN 2
                          WHEN 2 THEN 6
                          ELSE ROUND(v_entry.srs_interval * v_new_ease)::int4
                        END;
    ELSE
      v_new_interval := CASE v_new_reps
                          WHEN 1 THEN 1
                          WHEN 2 THEN 4
                          ELSE ROUND(v_entry.srs_interval * v_new_ease)::int4
                        END;
    END IF;

    v_new_outcome := p_outcome;
  END IF;

  -- ── Clamp de intervalo [1, 365] ───────────────────────────────────
  v_new_interval := GREATEST(1, LEAST(365, v_new_interval));

  -- ── Promoção de Chute → Memória (reason=guessed_correctly) ───────
  IF v_entry.reason::text = 'guessed_correctly' AND v_new_reps >= 2 AND v_q > 0 THEN
    SELECT ARRAY_AGG(confidence ORDER BY reviewed_at DESC)
      INTO v_last2_conf
      FROM (
        SELECT confidence, reviewed_at
          FROM public.review_attempts
         WHERE entry_id = p_entry_id
         ORDER BY reviewed_at DESC
         LIMIT 2
      ) sub;

    v_chute_promo := (
      v_last2_conf IS NOT NULL
      AND array_length(v_last2_conf, 1) = 2
      AND v_last2_conf[1] IN ('media', 'alta')
      AND v_last2_conf[2] IN ('media', 'alta')
    );

    IF v_chute_promo AND v_new_ease < c_ease_default THEN
      v_new_ease := c_ease_default;
    END IF;
  END IF;

  -- ── Checar leech ─────────────────────────────────────────────────
  IF v_new_lapses >= c_leech_threshold THEN
    v_new_outcome := 'leech_blocked';
    v_is_leech    := true;
  END IF;

  -- ── Calcular srs_due_at ───────────────────────────────────────────
  v_new_due_at := now() + (v_new_interval || ' days')::interval;

  -- ── Verificar domínio automático ─────────────────────────────────
  -- Condições: srs_reps >= 3, srs_interval >= 21, last 2 revisões
  -- com confiança >= 'media', outcome IN ('bom','facil'), sem lapso
  -- na sequência atual (v_new_lapses = 0 não é útil — basta que
  -- a sequência atual não tenha lapso, i.e. v_was_correct = true)
  v_new_mastered_at := v_entry.mastered_at;

  IF v_was_correct AND NOT v_is_leech THEN
    IF v_new_reps >= c_mastery_reps
       AND v_new_interval >= c_mastery_interval
       AND v_new_outcome IN ('bom', 'facil')
       AND p_confidence IN ('media', 'alta')
    THEN
      -- Verificar confiança das 2 últimas revisões armazenadas
      SELECT ARRAY_AGG(confidence ORDER BY reviewed_at DESC)
        INTO v_last2_conf
        FROM (
          SELECT confidence, reviewed_at
            FROM public.review_attempts
           WHERE entry_id = p_entry_id
           ORDER BY reviewed_at DESC
           LIMIT 2
        ) sub;

      IF v_last2_conf IS NOT NULL
         AND array_length(v_last2_conf, 1) >= 2
         AND v_last2_conf[1] IN ('media', 'alta')
         AND v_last2_conf[2] IN ('media', 'alta')
      THEN
        v_new_mastered_at := COALESCE(v_entry.mastered_at, now());
      END IF;
    END IF;
  ELSIF NOT v_was_correct THEN
    -- Lapso reverte domínio
    v_new_mastered_at := NULL;
  END IF;

  -- ── Persistir ────────────────────────────────────────────────────
  UPDATE public.error_notebook
     SET srs_ease            = v_new_ease,
         srs_interval        = v_new_interval,
         srs_reps            = v_new_reps,
         srs_lapses          = v_new_lapses,
         srs_due_at          = v_new_due_at,
         last_review_outcome = v_new_outcome,
         mastered_at         = v_new_mastered_at,
         updated_at          = now()
   WHERE id = p_entry_id
     AND user_id = v_uid;

  -- ── Retornar estado SRS atualizado ───────────────────────────────
  RETURN jsonb_build_object(
    'srs_due_at',    v_new_due_at,
    'srs_interval',  v_new_interval,
    'srs_reps',      v_new_reps,
    'srs_ease',      v_new_ease,
    'srs_lapses',    v_new_lapses,
    'mastered',      (v_new_mastered_at IS NOT NULL),
    'mastered_at',   v_new_mastered_at,
    'is_leech',      v_is_leech
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_next_review_guarded(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_next_review_guarded(uuid, text, text) TO authenticated;


-- =====================================================================
-- 2. record_review_attempt_guarded
-- =====================================================================
-- Registra uma re-resolução em review_attempts.
-- NÃO calcula SRS — isso é responsabilidade de schedule_next_review_guarded.
-- Valida ownership da entry e enums de confidence/self_grade.
-- Retorna o uuid do review_attempt criado.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.record_review_attempt_guarded(
  p_entry_id           uuid,
  p_selected_option_id uuid,    -- NULL se não respondeu (timeout / saída)
  p_was_correct        boolean,
  p_confidence         text,    -- 'baixa' | 'media' | 'alta'
  p_self_grade         text     -- 'errei' | 'dificil' | 'bom' | 'facil'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_review_id uuid;
BEGIN
  -- ── Autenticação ─────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- ── Validar ownership da entrada ─────────────────────────────────
  IF NOT EXISTS (
    SELECT 1
      FROM public.error_notebook
     WHERE id = p_entry_id
       AND user_id = v_uid
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'entry_not_found_or_forbidden';
  END IF;

  -- ── Validar enums ────────────────────────────────────────────────
  IF p_confidence NOT IN ('baixa', 'media', 'alta') THEN
    RAISE EXCEPTION 'invalid_confidence: %', p_confidence;
  END IF;
  IF p_self_grade NOT IN ('errei', 'dificil', 'bom', 'facil') THEN
    RAISE EXCEPTION 'invalid_self_grade: %', p_self_grade;
  END IF;

  -- ── Inserir log de revisão (imutável após criação) ────────────────
  INSERT INTO public.review_attempts
    (entry_id, user_id, selected_option_id, was_correct, confidence, self_grade)
  VALUES
    (p_entry_id, v_uid, p_selected_option_id, p_was_correct, p_confidence, p_self_grade)
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_review_attempt_guarded(uuid, uuid, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_review_attempt_guarded(uuid, uuid, boolean, text, text) TO authenticated;


-- =====================================================================
-- 3. add_to_notebook_bulk_guarded
-- =====================================================================
-- Insere múltiplas entradas ao caderno em lote (triagem pós-prova).
-- Limite: 100 entradas por chamada.
-- Chave de dedup: (user_id, question_id).
--   - Não existe     → insere, conta em added
--   - Existe ativo   → pula, conta em skipped
--   - Existe deletado (soft) → ressuscita (deleted_at = NULL), conta em added
-- user_id é sempre auth.uid() — nunca aceito no payload do cliente.
-- Retorna: { added: int, skipped: int, entry_ids: uuid[] }
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

    -- Verificar existência (ativa ou soft-deleted)
    SELECT id INTO v_entry_id
      FROM public.error_notebook
     WHERE user_id     = v_uid
       AND question_id = v_question_id
     LIMIT 1;

    IF FOUND THEN
      -- Ressuscitar soft-delete se aplicável
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
        srs_due_at
      ) VALUES (
        v_uid,
        (v_item->>'simulado_id')::uuid,
        v_question_id,
        v_item->>'area',
        v_item->>'theme',
        (v_item->>'reason')::error_reason,          -- cast valida o enum automaticamente
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
        now()   -- srs_due_at: devida imediatamente
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


-- =====================================================================
-- 4. reset_leech_guarded
-- =====================================================================
-- Desbloqueio manual de entry marcada como leech_blocked.
-- Mantém srs_lapses acumulado (histórico — não zera).
-- Redefine srs_interval = 1, srs_ease = 1.3 (mínimo), srs_reps = 0.
-- Limpa last_review_outcome para NULL (saindo do estado bloqueado).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reset_leech_guarded(
  p_entry_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_owner uuid;
BEGIN
  -- ── Autenticação ─────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- ── Validar ownership e existência ───────────────────────────────
  SELECT user_id INTO v_owner
    FROM public.error_notebook
   WHERE id = p_entry_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ── Resetar para parâmetros mínimos (conservador) ─────────────────
  -- srs_lapses NÃO é zerado — é histórico imutável
  UPDATE public.error_notebook
     SET srs_interval        = 1,
         srs_ease            = 1.3,   -- mínimo absoluto
         srs_reps            = 0,
         last_review_outcome = NULL,  -- remove bloqueio leech_blocked
         srs_due_at          = now() + INTERVAL '1 day',
         updated_at          = now()
   WHERE id = p_entry_id
     AND user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_leech_guarded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_leech_guarded(uuid) TO authenticated;


-- =====================================================================
-- 5. snooze_error_notebook_entry (RPC existente — atualizada)
-- =====================================================================
-- Comportamento anterior: atualizava apenas next_review_at.
-- Comportamento novo: atualiza TAMBÉM srs_due_at (fonte de verdade SRS)
-- para que o filtro SRS respeite o adiamento manual.
-- NÃO altera srs_reps, srs_ease, srs_lapses (override de data apenas).
-- Assinatura pública inalterada — compatibilidade retroativa total.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.snooze_error_notebook_entry(
  p_entry_id uuid,
  p_days     integer DEFAULT 3
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_owner        uuid;
  v_clamped_days integer;
  v_next         timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT user_id INTO v_owner
    FROM public.error_notebook
   WHERE id = p_entry_id
     AND deleted_at IS NULL;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_clamped_days := GREATEST(1, LEAST(30, COALESCE(p_days, 3)));
  v_next         := now() + (v_clamped_days || ' days')::interval;

  UPDATE public.error_notebook
     SET next_review_at      = v_next,   -- mantido para compatibilidade retroativa
         srs_due_at          = v_next,   -- NOVO: override do agendamento SRS
         last_review_outcome = 'snoozed',
         updated_at          = now()
   WHERE id = p_entry_id
     AND user_id = v_uid;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.snooze_error_notebook_entry(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snooze_error_notebook_entry(uuid, integer) TO authenticated;
