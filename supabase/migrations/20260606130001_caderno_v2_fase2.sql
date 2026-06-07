-- ============================================================
-- MIGRAÇÃO: Caderno de Erros v2 — Fase 2
-- Arquivo:  20260606130001_caderno_v2_fase2.sql
-- Projeto:  enamed-arena (SanarFlix PRO Simulados / ENAMED)
-- Data:     2026-06-06
-- Dependências:
--   20260606120001_caderno_v2_schema.sql  (error_notebook SRS, decks, flashcards)
--   20260606120002_caderno_v2_rpcs.sql    (schedule_next_review_guarded, etc.)
-- Idempotente: seguro re-executar (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT)
-- Fonte da verdade: docs/specs/00-contratos-canonicos.md §12
--                   docs/specs/06-pattern-engine-telemetry.md §A.2
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 1: Tabela caderno_pattern_insights_cache
-- ────────────────────────────────────────────────────────────────────────────
-- Cache de 24h dos insights gerados pela edge function caderno-pattern-insights.
-- Invalidação: TTL 24h OU entry_count diferente do atual no caderno.
-- RLS: dono lê, insere e atualiza apenas a própria linha.

CREATE TABLE IF NOT EXISTS public.caderno_pattern_insights_cache (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload      jsonb       NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  entry_count  int         NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.caderno_pattern_insights_cache IS
  'Cache de 24h dos insights macro gerados por caderno-pattern-insights (edge fn).
   TTL: 24h OU entry_count != contagem atual do caderno.
   Fonte da verdade: 00-contratos-canonicos.md §12, spec 06 §A.3.';

CREATE INDEX IF NOT EXISTS idx_caderno_pattern_insights_cache_user_id
  ON public.caderno_pattern_insights_cache (user_id);

ALTER TABLE public.caderno_pattern_insights_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'caderno_pattern_insights_cache'
       AND policyname = 'caderno_pattern_insights_cache_select_own'
  ) THEN
    CREATE POLICY "caderno_pattern_insights_cache_select_own"
      ON public.caderno_pattern_insights_cache FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'caderno_pattern_insights_cache'
       AND policyname = 'caderno_pattern_insights_cache_insert_own'
  ) THEN
    CREATE POLICY "caderno_pattern_insights_cache_insert_own"
      ON public.caderno_pattern_insights_cache FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'caderno_pattern_insights_cache'
       AND policyname = 'caderno_pattern_insights_cache_update_own'
  ) THEN
    CREATE POLICY "caderno_pattern_insights_cache_update_own"
      ON public.caderno_pattern_insights_cache FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.caderno_pattern_insights_cache TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 2: Tabela user_notes (Aba Anotações)
-- ────────────────────────────────────────────────────────────────────────────
-- Anotações livres do aluno, opcionalmente vinculadas a uma questão/simulado.
-- Soft-delete via deleted_at. CRUD direto pelo cliente (RLS é a barreira).

CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT '',
  body_md     text        NOT NULL DEFAULT '',
  question_id uuid        NULL REFERENCES public.questions(id) ON DELETE SET NULL,
  simulado_id uuid        NULL REFERENCES public.simulados(id) ON DELETE SET NULL,
  area        text        NULL,
  theme       text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

COMMENT ON TABLE public.user_notes IS
  'Anotações livres do aluno (aba Anotações no Caderno de Erros v2).
   Vinculação opcional a questão/simulado. Soft-delete via deleted_at.
   Fonte da verdade: 00-contratos-canonicos.md §12.';

-- Índice principal: listagem de anotações ativas do usuário
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id_active
  ON public.user_notes (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_notes'
       AND policyname = 'user_notes_select_own'
  ) THEN
    CREATE POLICY "user_notes_select_own"
      ON public.user_notes FOR SELECT
      USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_notes'
       AND policyname = 'user_notes_insert_own'
  ) THEN
    CREATE POLICY "user_notes_insert_own"
      ON public.user_notes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_notes'
       AND policyname = 'user_notes_update_own'
  ) THEN
    CREATE POLICY "user_notes_update_own"
      ON public.user_notes FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
  -- DELETE: bloqueado por padrão — soft-delete via deleted_at
END $$;

GRANT SELECT, INSERT, UPDATE ON public.user_notes TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 3: Tabela question_favorites (Aba Favoritos)
-- ────────────────────────────────────────────────────────────────────────────
-- Questões favoritadas pelo aluno. Sem soft-delete: favorito pode ser removido
-- fisicamente (DELETE via RLS). Deduplicação via UNIQUE(user_id, question_id).

CREATE TABLE IF NOT EXISTS public.question_favorites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  simulado_id uuid        NULL REFERENCES public.simulados(id) ON DELETE SET NULL,
  area        text        NULL,
  theme       text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_question_favorites_user_question UNIQUE (user_id, question_id)
);

COMMENT ON TABLE public.question_favorites IS
  'Questões favoritadas pelo aluno (aba Favoritos no Caderno de Erros v2).
   Exclusão física permitida (sem soft-delete). UNIQUE(user_id, question_id).
   Fonte da verdade: 00-contratos-canonicos.md §12.';

CREATE INDEX IF NOT EXISTS idx_question_favorites_user_id
  ON public.question_favorites (user_id);

ALTER TABLE public.question_favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'question_favorites'
       AND policyname = 'question_favorites_select_own'
  ) THEN
    CREATE POLICY "question_favorites_select_own"
      ON public.question_favorites FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'question_favorites'
       AND policyname = 'question_favorites_insert_own'
  ) THEN
    CREATE POLICY "question_favorites_insert_own"
      ON public.question_favorites FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- DELETE físico permitido (favorito pode ser removido de fato)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'question_favorites'
       AND policyname = 'question_favorites_delete_own'
  ) THEN
    CREATE POLICY "question_favorites_delete_own"
      ON public.question_favorites FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.question_favorites TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 4: Storage bucket flashcard-images (privado)
-- ────────────────────────────────────────────────────────────────────────────
-- Bucket privado para imagens de flashcards.
-- Policy: acesso restrito ao prefixo de path user_id/ do próprio usuário.
-- ON CONFLICT (id) DO NOTHING garante idempotência.

INSERT INTO storage.buckets (id, name, public)
VALUES ('flashcard-images', 'flashcard-images', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage.objects (via DO-block idempotente)
DO $$ BEGIN
  -- SELECT: usuário lê apenas objetos em seu próprio prefixo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND policyname = 'flashcard_images_select_own'
  ) THEN
    CREATE POLICY "flashcard_images_select_own"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'flashcard-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- INSERT: usuário sobe arquivos apenas em seu próprio prefixo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND policyname = 'flashcard_images_insert_own'
  ) THEN
    CREATE POLICY "flashcard_images_insert_own"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'flashcard-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- UPDATE: usuário atualiza apenas objetos em seu próprio prefixo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND policyname = 'flashcard_images_update_own'
  ) THEN
    CREATE POLICY "flashcard_images_update_own"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'flashcard-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'flashcard-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- DELETE: usuário remove apenas objetos em seu próprio prefixo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND policyname = 'flashcard_images_delete_own'
  ) THEN
    CREATE POLICY "flashcard_images_delete_own"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'flashcard-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;


COMMIT;

-- ============================================================
-- RPCs SECURITY DEFINER (fora da transação DDL para evitar
-- conflito com CREATE OR REPLACE em PG15+)
-- ============================================================


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 5: RPC clear_awaiting_lesson_guarded
-- ────────────────────────────────────────────────────────────────────────────
-- Limpa o estado awaiting_lesson de uma entry do caderno.
-- Disparado pelo botão "Já estudei isso" ou deep-link de aula (Fase 2).
-- Valida auth.uid() e ownership. Seguro re-executar (UPDATE idempotente).

CREATE OR REPLACE FUNCTION public.clear_awaiting_lesson_guarded(
  p_entry_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Autenticação
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- UPDATE: só afeta a própria entry do usuário, apenas se estiver em awaiting_lesson
  -- Se a entry não existir, ou não for do usuário, ou não estiver em awaiting_lesson,
  -- o UPDATE simplesmente afeta 0 linhas — comportamento silencioso (idempotente).
  UPDATE public.error_notebook
     SET last_review_outcome = NULL,
         updated_at          = now()
   WHERE id                  = p_entry_id
     AND user_id             = v_uid
     AND last_review_outcome = 'awaiting_lesson'
     AND deleted_at IS NULL;

  -- Validação de ownership explícita para retornar erro correto
  -- (caso a entry exista mas não seja do usuário)
  IF NOT EXISTS (
    SELECT 1 FROM public.error_notebook
     WHERE id = p_entry_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.error_notebook
     WHERE id = p_entry_id AND user_id = v_uid AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_awaiting_lesson_guarded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_awaiting_lesson_guarded(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 6: RPC schedule_flashcard_review_guarded
-- ────────────────────────────────────────────────────────────────────────────
-- Motor SM-2-lite SIMPLIFICADO para flashcards.
-- Sem reason/confidence: p_outcome ∈ errei|dificil|bom|facil.
-- Mapeamento de quality: errei→0, dificil→2, bom→3, facil→4.
-- Lapso (q=0): reps=0, lapses++, ease=max(1.3, ease-0.2),
--              interval=max(1, round(interval*0.2)).
-- Acerto: reps++, delta_ease=0.1-(4-q)*(0.08+(4-q)*0.02),
--         ease clamp[1.3,3.5], interval reps=1→1, reps=2→4,
--         else round(interval*ease), clamp[1,365].
-- Mastered: reps>=3 AND interval>=21 AND outcome in (bom,facil).
-- Leech: lapses>=4.
-- Retorna: jsonb {srs_due_at, srs_interval, srs_reps, srs_ease, mastered, is_leech}.

CREATE OR REPLACE FUNCTION public.schedule_flashcard_review_guarded(
  p_flashcard_id uuid,
  p_outcome      text   -- 'errei' | 'dificil' | 'bom' | 'facil'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_fc         public.flashcards%ROWTYPE;

  -- Constantes SM-2
  c_ease_min   CONSTANT float8 := 1.3;
  c_ease_max   CONSTANT float8 := 3.5;
  c_leech_thr  CONSTANT int4   := 4;
  c_mast_reps  CONSTANT int4   := 3;
  c_mast_itvl  CONSTANT int4   := 21;

  -- Estado calculado
  v_q           int4;
  v_was_correct boolean;
  v_new_ease    float8;
  v_new_reps    int4;
  v_new_lapses  int4;
  v_new_interval int4;
  v_new_due_at  timestamptz;
  v_mastered_at timestamptz;
  v_is_leech    boolean := false;
  v_delta_ease  float8;
BEGIN
  -- Autenticação
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Validar outcome
  IF p_outcome NOT IN ('errei', 'dificil', 'bom', 'facil') THEN
    RAISE EXCEPTION 'invalid_outcome: %', p_outcome;
  END IF;

  -- Carregar flashcard e validar ownership
  SELECT * INTO v_fc
    FROM public.flashcards
   WHERE id      = p_flashcard_id
     AND user_id = v_uid
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'flashcard_not_found_or_forbidden';
  END IF;

  -- Mapear outcome → quality q (SM-2)
  v_q := CASE p_outcome
           WHEN 'errei'   THEN 0
           WHEN 'dificil' THEN 2
           WHEN 'bom'     THEN 3
           WHEN 'facil'   THEN 4
         END;

  v_was_correct := (v_q > 0);
  v_new_lapses  := v_fc.srs_lapses;

  IF v_q = 0 THEN
    -- ── Lapso ──────────────────────────────────────────────────────────
    v_new_lapses   := v_fc.srs_lapses + 1;
    v_new_reps     := 0;
    v_new_ease     := GREATEST(c_ease_min, v_fc.srs_ease - 0.20);
    v_new_interval := GREATEST(1, ROUND(v_fc.srs_interval * 0.20)::int4);
  ELSE
    -- ── Acerto ─────────────────────────────────────────────────────────
    v_new_reps := v_fc.srs_reps + 1;

    -- delta_ease = 0.1 - (4-q) * (0.08 + (4-q)*0.02)
    v_delta_ease := 0.1 - (4 - v_q)::float8 * (0.08 + (4 - v_q)::float8 * 0.02);
    v_new_ease   := GREATEST(c_ease_min, LEAST(c_ease_max, v_fc.srs_ease + v_delta_ease));

    -- Intervalo por reps
    v_new_interval := CASE v_new_reps
                        WHEN 1 THEN 1
                        WHEN 2 THEN 4
                        ELSE ROUND(v_fc.srs_interval * v_new_ease)::int4
                      END;
  END IF;

  -- Clamp intervalo [1, 365]
  v_new_interval := GREATEST(1, LEAST(365, v_new_interval));
  v_new_due_at   := now() + (v_new_interval || ' days')::interval;

  -- Detecção de leech (lapses >= 4)
  IF v_new_lapses >= c_leech_thr THEN
    v_is_leech := true;
  END IF;

  -- Domínio automático (simplificado para flashcards — sem checagem de confiança)
  v_mastered_at := v_fc.mastered_at;
  IF v_was_correct AND NOT v_is_leech
     AND v_new_reps >= c_mast_reps
     AND v_new_interval >= c_mast_itvl
     AND p_outcome IN ('bom', 'facil')
  THEN
    v_mastered_at := COALESCE(v_fc.mastered_at, now());
  ELSIF NOT v_was_correct THEN
    -- Lapso reverte domínio
    v_mastered_at := NULL;
  END IF;

  -- Persistir
  UPDATE public.flashcards
     SET srs_ease            = v_new_ease,
         srs_interval        = v_new_interval,
         srs_reps            = v_new_reps,
         srs_lapses          = v_new_lapses,
         srs_due_at          = v_new_due_at,
         last_review_outcome = p_outcome,
         mastered_at         = v_mastered_at,
         updated_at          = now()
   WHERE id      = p_flashcard_id
     AND user_id = v_uid;

  RETURN jsonb_build_object(
    'srs_due_at',   v_new_due_at,
    'srs_interval', v_new_interval,
    'srs_reps',     v_new_reps,
    'srs_ease',     v_new_ease,
    'srs_lapses',   v_new_lapses,
    'mastered',     (v_mastered_at IS NOT NULL),
    'is_leech',     v_is_leech
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_flashcard_review_guarded(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_flashcard_review_guarded(uuid, text) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 7: RPC get_caderno_pattern_data
-- ────────────────────────────────────────────────────────────────────────────
-- Agrega dados para os 5 tipos de insight (spec 06 §A.2).
-- Read-only; SECURITY DEFINER com check auth.uid() = p_user_id.
-- Cache obrigatório no cliente (query custosa — ROI usa attempt_question_results).
--
-- Retorno jsonb:
-- {
--   "total_entries":  int,
--   "total_mastered": int,
--   "area_cause_dist": [                       -- INSIGHTs 1 e 2
--     { area, reason, cnt, mastered_cnt }
--   ],
--   "overconf": [                              -- INSIGHT 4
--     { area, high_conf_wrong, high_conf_total }
--   ],
--   "roi_data": [                              -- INSIGHT 5
--     { area, first_mastered_at, score_before, score_after }
--   ],
--   "recurring_confusion_candidates": [       -- INSIGHT 3 (candidatos para IA)
--     { area, theme, cnt }
--   ],
--   "question_samples": [                     -- INSIGHT 3 (textos para IA)
--     { area, theme, question_text, reason }
--   ]
-- }

CREATE OR REPLACE FUNCTION public.get_caderno_pattern_data(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();

  -- Resultados intermediários
  v_total_entries  bigint;
  v_total_mastered bigint;
  v_area_cause     jsonb;
  v_overconf       jsonb;
  v_roi_data       jsonb;
  v_confusion_cand jsonb;
  v_q_samples      jsonb;
BEGIN
  -- Autenticação e autorização: só o próprio usuário pode ver seus dados
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_uid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ── Contagens totais ─────────────────────────────────────────────────────
  SELECT
    COUNT(*)                                                    AS total_entries,
    COUNT(*) FILTER (WHERE mastered_at IS NOT NULL)             AS total_mastered
  INTO v_total_entries, v_total_mastered
    FROM public.error_notebook
   WHERE user_id    = v_uid
     AND deleted_at IS NULL;

  -- ── INSIGHT 1 + 2: distribuição por área × causa ─────────────────────────
  -- Agrega contagem de entradas e entradas dominadas por (area, reason).
  -- Alimenta weak_area (acerto por área no caderno) e dominant_cause.
  SELECT jsonb_agg(row_to_json(t))
  INTO v_area_cause
  FROM (
    SELECT
      area,
      reason::text                                               AS reason,
      COUNT(*)                                                   AS cnt,
      COUNT(*) FILTER (WHERE mastered_at IS NOT NULL)            AS mastered_cnt
    FROM public.error_notebook
   WHERE user_id    = v_uid
     AND deleted_at IS NULL
   GROUP BY area, reason
   ORDER BY area, cnt DESC
  ) t;

  -- ── INSIGHT 4: overconfidence ─────────────────────────────────────────────
  -- Questões respondidas com alta confiança (answers.high_confidence=true OU
  -- answers.confidence='alta') que estão no caderno como erradas.
  -- Join: error_notebook → attempt_question_results → answers
  -- (um attempt por user_id para evitar duplicação de linhas).
  SELECT jsonb_agg(row_to_json(t))
  INTO v_overconf
  FROM (
    SELECT
      en.area,
      COUNT(*) FILTER (
        WHERE (a.high_confidence = true OR a.confidence = 'alta')
          AND aqr.is_correct = false
      )                                                          AS high_conf_wrong,
      COUNT(*) FILTER (
        WHERE (a.high_confidence = true OR a.confidence = 'alta')
      )                                                          AS high_conf_total
    FROM public.error_notebook en
    -- Pegar o attempt mais recente por questão para este usuário
    JOIN LATERAL (
      SELECT aqr_inner.is_correct, aqr_inner.attempt_id
        FROM public.attempt_question_results aqr_inner
        JOIN public.attempts att ON att.id = aqr_inner.attempt_id
       WHERE aqr_inner.question_id = en.question_id
         AND att.user_id = v_uid
       ORDER BY att.finished_at DESC NULLS LAST
       LIMIT 1
    ) aqr ON true
    JOIN public.answers a
      ON a.question_id = en.question_id
     AND a.attempt_id  = aqr.attempt_id
   WHERE en.user_id    = v_uid
     AND en.deleted_at IS NULL
   GROUP BY en.area
   HAVING COUNT(*) FILTER (
     WHERE (a.high_confidence = true OR a.confidence = 'alta')
   ) > 0
   ORDER BY high_conf_wrong DESC
  ) t;

  -- ── INSIGHT 5: ROI — score por área antes e depois de mastered_at ─────────
  -- Agrupa por área as entries dominadas, calcula score antes e depois
  -- do primeiro mastered_at usando attempt_question_results + attempts.
  -- Requer ao menos 2 attempts distintos por área para aparecer no resultado.
  SELECT jsonb_agg(row_to_json(t))
  INTO v_roi_data
  FROM (
    SELECT
      en_area.area,
      en_area.first_mastered_at,
      -- Score (proporção de acerto) em attempts ANTERIORES ao domínio
      AVG(aqr.is_correct::int)
        FILTER (WHERE att.finished_at < en_area.first_mastered_at)  AS score_before,
      -- Score em attempts POSTERIORES ao domínio
      AVG(aqr.is_correct::int)
        FILTER (WHERE att.finished_at > en_area.first_mastered_at)  AS score_after,
      COUNT(DISTINCT att.id)
        FILTER (WHERE att.finished_at < en_area.first_mastered_at)  AS attempts_before,
      COUNT(DISTINCT att.id)
        FILTER (WHERE att.finished_at > en_area.first_mastered_at)  AS attempts_after
    FROM (
      -- Uma linha por área: primeira vez que o usuário dominou algo nessa área
      SELECT
        area,
        MIN(mastered_at) AS first_mastered_at
      FROM public.error_notebook
     WHERE user_id     = v_uid
       AND deleted_at  IS NULL
       AND mastered_at IS NOT NULL
       AND area        IS NOT NULL
     GROUP BY area
    ) en_area
    -- Todas as questões desta área em todos os attempts do usuário
    JOIN public.questions q
      ON q.area = en_area.area
    JOIN public.attempt_question_results aqr
      ON aqr.question_id = q.id
    JOIN public.attempts att
      ON att.id      = aqr.attempt_id
     AND att.user_id = v_uid
     AND att.status  = 'submitted'
   GROUP BY en_area.area, en_area.first_mastered_at
  HAVING
    -- Apenas áreas com pelo menos 1 attempt antes E 1 depois do domínio
    COUNT(DISTINCT att.id) FILTER (WHERE att.finished_at < en_area.first_mastered_at) >= 1
    AND COUNT(DISTINCT att.id) FILTER (WHERE att.finished_at > en_area.first_mastered_at) >= 1
   ORDER BY (
     AVG(aqr.is_correct::int) FILTER (WHERE att.finished_at > en_area.first_mastered_at)
     - AVG(aqr.is_correct::int) FILTER (WHERE att.finished_at < en_area.first_mastered_at)
   ) DESC NULLS LAST
  ) t;

  -- ── INSIGHT 3: candidatos de confusão recorrente ─────────────────────────
  -- Pares (area, theme) com causa=confused_alternatives e >= 3 entradas.
  -- A edge function de IA identifica o par de condições a partir dos textos.
  SELECT jsonb_agg(row_to_json(t))
  INTO v_confusion_cand
  FROM (
    SELECT
      area,
      theme,
      COUNT(*) AS cnt
    FROM public.error_notebook
   WHERE user_id    = v_uid
     AND deleted_at IS NULL
     AND reason     = 'confused_alternatives'
     AND theme      IS NOT NULL
   GROUP BY area, theme
  HAVING COUNT(*) >= 3
   ORDER BY cnt DESC
  ) t;

  -- ── Amostras de texto para INSIGHT 3 (IA) ────────────────────────────────
  -- Máximo 30 entradas; apenas primeiros 300 chars do question_text.
  SELECT jsonb_agg(row_to_json(t))
  INTO v_q_samples
  FROM (
    SELECT
      area,
      theme,
      LEFT(question_text, 300) AS question_text,
      reason::text             AS reason
    FROM public.error_notebook
   WHERE user_id       = v_uid
     AND deleted_at    IS NULL
     AND question_text IS NOT NULL
     AND reason        = 'confused_alternatives'
   ORDER BY created_at DESC
   LIMIT 30
  ) t;

  -- ── Montar e retornar payload final ─────────────────────────────────────
  RETURN jsonb_build_object(
    'total_entries',                 COALESCE(v_total_entries, 0),
    'total_mastered',                COALESCE(v_total_mastered, 0),
    'area_cause_dist',               COALESCE(v_area_cause, '[]'::jsonb),
    'overconf',                      COALESCE(v_overconf, '[]'::jsonb),
    'roi_data',                      COALESCE(v_roi_data, '[]'::jsonb),
    'recurring_confusion_candidates', COALESCE(v_confusion_cand, '[]'::jsonb),
    'question_samples',              COALESCE(v_q_samples, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_caderno_pattern_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_caderno_pattern_data(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 8: RPC get_area_score_history
-- ────────────────────────────────────────────────────────────────────────────
-- Histórico de aproveitamento por área ao longo dos simulados concluídos.
-- Alimenta o painel de ROI: sparkline de evolução de score por área.
-- Read-only; SECURITY DEFINER com check auth.uid() = p_user_id.
--
-- Retorno jsonb:
-- {
--   "by_area": {
--     "<area_name>": [
--       { attempt_id, finished_at, score, questions_total, questions_correct }
--     ]
--   },
--   "global": [
--     { attempt_id, finished_at, score_global }
--   ]
-- }

CREATE OR REPLACE FUNCTION public.get_area_score_history(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_by_area jsonb;
  v_global  jsonb;
BEGIN
  -- Autenticação e autorização
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_uid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ── Score por área por attempt (base do sparkline de ROI) ─────────────────
  -- Agrega attempt_question_results × questions.area × attempts
  -- ordenado por data de finalização do attempt.
  SELECT jsonb_object_agg(area, scores_json)
  INTO v_by_area
  FROM (
    SELECT
      area_scores.area,
      jsonb_agg(
        jsonb_build_object(
          'attempt_id',         area_scores.attempt_id,
          'finished_at',        area_scores.finished_at,
          'score',              area_scores.score,
          'questions_total',    area_scores.questions_total,
          'questions_correct',  area_scores.questions_correct
        )
        ORDER BY area_scores.finished_at ASC
      ) AS scores_json
    FROM (
      SELECT
        q.area,
        att.id                                               AS attempt_id,
        att.finished_at,
        -- Proporção de acerto (0.0–1.0)
        ROUND(
          AVG(aqr.is_correct::int)::numeric, 4
        )::float8                                            AS score,
        COUNT(*)                                             AS questions_total,
        COUNT(*) FILTER (WHERE aqr.is_correct = true)       AS questions_correct
      FROM public.attempts att
      JOIN public.attempt_question_results aqr
        ON aqr.attempt_id = att.id
      JOIN public.questions q
        ON q.id = aqr.question_id
       AND q.area IS NOT NULL
     WHERE att.user_id  = v_uid
       AND att.status   = 'submitted'
       AND att.finished_at IS NOT NULL
     GROUP BY q.area, att.id, att.finished_at
    ) area_scores
   GROUP BY area_scores.area
  ) agg;

  -- ── Score global por attempt ───────────────────────────────────────────────
  -- Fonte: attempt_question_results (re-calcula para consistência com by_area).
  SELECT jsonb_agg(
    jsonb_build_object(
      'attempt_id',   att.id,
      'finished_at',  att.finished_at,
      'score_global', ROUND(AVG(aqr.is_correct::int)::numeric, 4)::float8
    )
    ORDER BY att.finished_at ASC
  )
  INTO v_global
  FROM public.attempts att
  JOIN public.attempt_question_results aqr ON aqr.attempt_id = att.id
 WHERE att.user_id    = v_uid
   AND att.status     = 'submitted'
   AND att.finished_at IS NOT NULL
 GROUP BY att.id, att.finished_at;

  RETURN jsonb_build_object(
    'by_area', COALESCE(v_by_area, '{}'::jsonb),
    'global',  COALESCE(v_global, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_area_score_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_area_score_history(uuid) TO authenticated;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
--
-- NOTAS DE ROLLBACK (executar fora de transação se necessário)
-- ============================================================
--
-- -- Tabelas novas
-- DROP TABLE IF EXISTS public.question_favorites;
-- DROP TABLE IF EXISTS public.user_notes;
-- DROP TABLE IF EXISTS public.caderno_pattern_insights_cache;
--
-- -- Bucket de storage (via dashboard ou API do Supabase):
-- DELETE FROM storage.buckets WHERE id = 'flashcard-images';
--
-- -- Policies de storage.objects
-- DROP POLICY IF EXISTS "flashcard_images_select_own" ON storage.objects;
-- DROP POLICY IF EXISTS "flashcard_images_insert_own" ON storage.objects;
-- DROP POLICY IF EXISTS "flashcard_images_update_own" ON storage.objects;
-- DROP POLICY IF EXISTS "flashcard_images_delete_own" ON storage.objects;
--
-- -- RPCs novas
-- DROP FUNCTION IF EXISTS public.clear_awaiting_lesson_guarded(uuid);
-- DROP FUNCTION IF EXISTS public.schedule_flashcard_review_guarded(uuid, text);
-- DROP FUNCTION IF EXISTS public.get_caderno_pattern_data(uuid);
-- DROP FUNCTION IF EXISTS public.get_area_score_history(uuid);
-- ============================================================
