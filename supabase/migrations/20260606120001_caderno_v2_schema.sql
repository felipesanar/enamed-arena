-- ============================================================
-- MIGRAÇÃO: Caderno de Erros v2 — Schema Foundation
-- Arquivo:  20260606120001_caderno_v2_schema.sql
-- Projeto:  enamed-arena (SanarFlix PRO Simulados / ENAMED)
-- Data:     2026-06-06
-- Fase:     0 (schema) + Fase 2 (decks/flashcards criados agora)
-- Idempotente: seguro re-executar (IF NOT EXISTS / IF EXISTS em tudo)
-- Fonte da verdade: docs/specs/00-contratos-canonicos.md
--                   docs/specs/01-data-model-migration.md
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- BLOCO 1: Novas colunas em error_notebook (motor SRS + estado)
-- ────────────────────────────────────────────────────────────
-- Notas:
--   srs_interval: default 1 conforme SM-2-lite (spec 01 §2.1); a
--     spec 00 menciona DEFAULT 0 para backfill — usamos 1 (correto
--     para novas entradas; entradas históricas recebem o mesmo valor
--     pois ainda não foram revisadas).
--   srs_due_at: nullable aqui para o backfill do BLOCO 2 funcionar
--     (UPDATE WHERE srs_due_at IS NULL). Entradas novas inseridas
--     via add_to_notebook_bulk_guarded sempre chegam com now().
--   confidence_at_answer e last_review_outcome: nullable por design
--     (capturado só no contexto do motor SRS / RPC).

ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS srs_ease             float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval         int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps             int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses           int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at           timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confidence_at_answer text        NULL
    CHECK (confidence_at_answer IS NULL OR confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text        NULL
    CHECK (last_review_outcome IS NULL OR last_review_outcome IN
           ('errei','dificil','bom','facil','snoozed','awaiting_lesson','leech_blocked')),
  ADD COLUMN IF NOT EXISTS mastered_at          timestamptz NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 2: Backfill de srs_due_at em entradas existentes
-- ────────────────────────────────────────────────────────────
-- Regras (spec 01 §8, BLOCO 2):
--   1. Resolvidas (resolved_at IS NOT NULL)  → srs_due_at = NULL (fora da fila)
--   2. Com snooze ativo (next_review_at NOT NULL) → srs_due_at = next_review_at
--   3. Sem snooze e sem resolução             → srs_due_at = now() (devida imediatamente)
-- Aplicado apenas onde srs_due_at ainda é NULL (idempotência).

UPDATE public.error_notebook
SET srs_due_at = CASE
  WHEN resolved_at IS NOT NULL     THEN NULL
  WHEN next_review_at IS NOT NULL  THEN next_review_at
  ELSE now()
END
WHERE srs_due_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 3: Backfill de mastered_at a partir de resolved_at
-- ────────────────────────────────────────────────────────────
-- Entradas autodeclaradas "Já dominei" (resolved_at) recebem
-- mastered_at = resolved_at como heurística histórica (spec 01 §8, §2.3).
-- Apenas entradas não soft-deletadas e sem mastered_at são afetadas.

UPDATE public.error_notebook
SET mastered_at = resolved_at
WHERE resolved_at IS NOT NULL
  AND mastered_at IS NULL
  AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 4: Índices em error_notebook
-- ────────────────────────────────────────────────────────────

-- Fila de revisão SRS (query principal da sessão de recall ativo)
CREATE INDEX IF NOT EXISTS idx_error_notebook_srs_due
  ON public.error_notebook (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;

-- Fila de dominadas (tela Dominadas / badge)
CREATE INDEX IF NOT EXISTS idx_error_notebook_mastered
  ON public.error_notebook (user_id, mastered_at)
  WHERE mastered_at IS NOT NULL AND deleted_at IS NULL;

-- Detecção de leech (srs_lapses >= 4) — intervenção pedagógica
CREATE INDEX IF NOT EXISTS idx_error_notebook_leech
  ON public.error_notebook (user_id)
  WHERE srs_lapses >= 4 AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 5: Nova coluna em answers — confiança trifásica
-- ────────────────────────────────────────────────────────────
-- O campo legado high_confidence (boolean) é mantido para
-- compatibilidade com get_user_attempt_behavior_stats e dashboards.
-- O novo campo confidence coexiste com semântica mais granular.

ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS confidence text NULL
    CHECK (confidence IS NULL OR confidence IN ('baixa', 'media', 'alta'));

COMMENT ON COLUMN public.answers.confidence IS
  'Nível de confiança trifásico capturado no momento da resposta durante o simulado.
   Valores: baixa | media | alta. NULL para respostas anteriores à feature.
   Substitui a semântica de high_confidence (mantido por compatibilidade).
   Fonte da verdade: 00-contratos-canonicos.md §2.';

-- ────────────────────────────────────────────────────────────
-- BLOCO 6: Backfill conservador de answers.confidence
-- ────────────────────────────────────────────────────────────
-- Mapeamento do boolean legado (spec 00 §2, 01 §5.2):
--   high_confidence = true  → 'alta'
--   high_confidence = false → NULL  (não sabemos se baixa ou média — conservador)
-- Só afeta linhas onde confidence ainda é NULL (idempotência).

UPDATE public.answers
SET confidence = 'alta'
WHERE high_confidence = true
  AND confidence IS NULL;

-- ────────────────────────────────────────────────────────────
-- BLOCO 7: Nova coluna em attempt_question_results
-- ────────────────────────────────────────────────────────────
-- Cache do motivo de erro sugerido pela IA de triagem.
-- Se preenchido, o cliente não chama a edge function classify-exam-errors
-- para este resultado (evita chamada redundante).

ALTER TABLE public.attempt_question_results
  ADD COLUMN IF NOT EXISTS ai_suggested_reason text NULL;

COMMENT ON COLUMN public.attempt_question_results.ai_suggested_reason IS
  'Motivo de erro sugerido pela triagem IA (edge function classify-exam-errors).
   Se preenchido, o cliente não precisa chamar a edge function para este item.
   Valores válidos: enum error_reason. NULL = ainda não triado.';

-- ────────────────────────────────────────────────────────────
-- BLOCO 8: Feature flag em profiles
-- ────────────────────────────────────────────────────────────
-- Flag de rollout gradual para o motor Caderno v2.
-- Rota /caderno (nova) roda em paralelo à /caderno-erros (atual)
-- durante a transição, controlada por este flag (spec 00 §11).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS caderno_v2_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.caderno_v2_enabled IS
  'Feature flag de rollout gradual do Caderno de Erros v2.
   Quando true, o frontend exibe /caderno (motor SRS) em vez de /caderno-erros.
   Ativação: server-side por segmento (PRO) antes do rollout completo.';

-- ────────────────────────────────────────────────────────────
-- BLOCO 9: Nova tabela review_attempts
-- ────────────────────────────────────────────────────────────
-- Log imutável de cada re-resolução numa sessão de recall ativo.
-- Inserção exclusiva via RPC record_review_attempt_guarded.
-- ON DELETE CASCADE em entry_id: para hard-delete administrativo apenas
-- (soft-delete de error_notebook não remove review_attempts — spec 01 §3.1).

CREATE TABLE IF NOT EXISTS public.review_attempts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id            uuid        NOT NULL REFERENCES public.error_notebook(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_option_id  uuid        NULL REFERENCES public.question_options(id) ON DELETE SET NULL,
  was_correct         boolean     NOT NULL,
  confidence          text        NOT NULL CHECK (confidence IN ('baixa', 'media', 'alta')),
  self_grade          text        NOT NULL CHECK (self_grade IN ('errei', 'dificil', 'bom', 'facil')),
  reviewed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Histórico de revisões por entrada (tela de detalhes, insight por entrada)
CREATE INDEX IF NOT EXISTS idx_review_attempts_entry_id
  ON public.review_attempts (entry_id, reviewed_at DESC);

-- Todas as revisões de um usuário (insights macro, streak, ROI)
CREATE INDEX IF NOT EXISTS idx_review_attempts_user_id
  ON public.review_attempts (user_id, reviewed_at DESC);

-- ────────────────────────────────────────────────────────────
-- BLOCO 10: RLS de review_attempts
-- ────────────────────────────────────────────────────────────
-- Sem acesso anônimo. INSERT bloqueado para o cliente — apenas via RPC.
-- UPDATE e DELETE bloqueados: review_attempts é log imutável.

ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'review_attempts'
       AND policyname = 'review_attempts_select_own'
  ) THEN
    CREATE POLICY "review_attempts_select_own"
      ON public.review_attempts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- INSERT bloqueado para cliente direto; apenas RPCs SECURITY DEFINER inserem
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'review_attempts'
       AND policyname = 'review_attempts_insert_via_rpc_only'
  ) THEN
    CREATE POLICY "review_attempts_insert_via_rpc_only"
      ON public.review_attempts FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- BLOCO 11: Nova tabela decks (Fase 2 — schema criado agora)
-- ────────────────────────────────────────────────────────────
-- Schema fixado antecipadamente para que a migração de schema
-- seja feita uma única vez. Implementação de UI é Fase 2.
-- Soft-delete via deleted_at; sem política DELETE física.

CREATE TABLE IF NOT EXISTS public.decks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text        NULL CHECK (description IS NULL OR char_length(description) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id
  ON public.decks (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'decks'
       AND policyname = 'decks_select_own'
  ) THEN
    CREATE POLICY "decks_select_own"
      ON public.decks FOR SELECT
      USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'decks'
       AND policyname = 'decks_insert_own'
  ) THEN
    CREATE POLICY "decks_insert_own"
      ON public.decks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'decks'
       AND policyname = 'decks_update_own'
  ) THEN
    CREATE POLICY "decks_update_own"
      ON public.decks FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- BLOCO 12: Nova tabela flashcards (Fase 2 — schema criado agora)
-- ────────────────────────────────────────────────────────────
-- Motor SRS compartilhado com error_notebook (mesmos campos e semântica).
-- entry_id: link opcional à entrada do caderno de origem.
-- Imagens: paths relativos ao bucket flashcard-images no Supabase Storage.

CREATE TABLE IF NOT EXISTS public.flashcards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id             uuid        NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id            uuid        NULL REFERENCES public.error_notebook(id) ON DELETE SET NULL,
  front_md            text        NOT NULL CHECK (char_length(front_md) BETWEEN 1 AND 2000),
  back_md             text        NOT NULL CHECK (char_length(back_md) BETWEEN 1 AND 4000),
  -- Paths relativos ao bucket flashcard-images; URL construída no cliente via storage.getPublicUrl()
  front_image_path    text        NULL,
  back_image_path     text        NULL,
  -- Motor SRS (mesmos campos e semântica de error_notebook)
  srs_ease            float8      NOT NULL DEFAULT 2.5,
  srs_interval        int4        NOT NULL DEFAULT 1,
  srs_reps            int4        NOT NULL DEFAULT 0,
  srs_lapses          int4        NOT NULL DEFAULT 0,
  srs_due_at          timestamptz NOT NULL DEFAULT now(),
  last_review_outcome text        NULL
    CHECK (last_review_outcome IS NULL OR
           last_review_outcome IN ('errei', 'dificil', 'bom', 'facil')),
  mastered_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL
);

-- Busca de flashcards por deck
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id
  ON public.flashcards (deck_id)
  WHERE deleted_at IS NULL;

-- Fila SRS de flashcards (sessão de revisão de flashcards)
CREATE INDEX IF NOT EXISTS idx_flashcards_srs_due
  ON public.flashcards (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'flashcards'
       AND policyname = 'flashcards_select_own'
  ) THEN
    CREATE POLICY "flashcards_select_own"
      ON public.flashcards FOR SELECT
      USING (auth.uid() = user_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'flashcards'
       AND policyname = 'flashcards_insert_own'
  ) THEN
    CREATE POLICY "flashcards_insert_own"
      ON public.flashcards FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'flashcards'
       AND policyname = 'flashcards_update_own'
  ) THEN
    CREATE POLICY "flashcards_update_own"
      ON public.flashcards FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- BLOCO 13: Grants — tabelas novas acessíveis a authenticated
-- ────────────────────────────────────────────────────────────
-- RLS é a barreira real; os grants apenas permitem que o role
-- authenticated veja as tabelas (padrão do projeto).

GRANT SELECT, INSERT, UPDATE ON public.review_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.decks            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.flashcards       TO authenticated;

COMMIT;

-- ============================================================
-- NOTAS DE ROLLBACK (executar fora de transação se necessário)
-- ============================================================
--
-- Para reverter COMPLETAMENTE esta migração:
--
--   BEGIN;
--
--   -- Tabelas novas
--   DROP TABLE IF EXISTS public.flashcards;
--   DROP TABLE IF EXISTS public.decks;
--   DROP TABLE IF EXISTS public.review_attempts;
--
--   -- Colunas novas em error_notebook
--   ALTER TABLE public.error_notebook
--     DROP COLUMN IF EXISTS srs_ease,
--     DROP COLUMN IF EXISTS srs_interval,
--     DROP COLUMN IF EXISTS srs_reps,
--     DROP COLUMN IF EXISTS srs_lapses,
--     DROP COLUMN IF EXISTS srs_due_at,
--     DROP COLUMN IF EXISTS confidence_at_answer,
--     DROP COLUMN IF EXISTS last_review_outcome,
--     DROP COLUMN IF EXISTS mastered_at;
--
--   -- Colunas novas em answers
--   ALTER TABLE public.answers
--     DROP COLUMN IF EXISTS confidence;
--
--   -- Coluna nova em attempt_question_results
--   ALTER TABLE public.attempt_question_results
--     DROP COLUMN IF EXISTS ai_suggested_reason;
--
--   -- Feature flag em profiles
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS caderno_v2_enabled;
--
--   COMMIT;
--
-- ATENÇÃO — pontos de regressão após rollback:
--   • snooze_error_notebook_entry: se o BLOCO da migração seguinte
--     (RPCs) já foi aplicado, a alteração que adiciona srs_due_at ao
--     UPDATE dessa RPC também deve ser revertida.
--   • Dados de backfill (srs_due_at / mastered_at) não são reversíveis
--     automaticamente — em ambiente de produção, guardar snapshot antes.
--   • RPCs novas (schedule_next_review_guarded, record_review_attempt_guarded,
--     add_to_notebook_bulk_guarded) são dropadas junto com a migração de RPCs
--     (arquivo separado, timestamp > 20260606120001).
--
-- COMPATIBILIDADE RETROATIVA:
--   Todas as colunas novas têm DEFAULT ou são nullable → INSERTs e
--   SELECTs existentes no código atual não quebram. O TypeScript é
--   relaxado (noImplicitAny: false) e ignora colunas desconhecidas.
--   O campo answers.confidence é NULL até a UI do simulado ser atualizada.
-- ============================================================
