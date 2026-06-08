-- ────────────────────────────────────────────────────────────
-- enamed-arena — flashcards: adiciona coluna question_id
-- ────────────────────────────────────────────────────────────
-- Data:     2026-06-07
-- Contexto: A tabela public.flashcards foi criada em
--           20260606120001_caderno_v2_schema.sql apenas com o link de origem
--           `entry_id` (→ error_notebook). O design (spec bulk-flashcards),
--           o tipo de domínio Flashcard, CreateFlashcardPayload e o mapper
--           mapGeneratedCardsToPayloads também referenciam um segundo link de
--           origem `question_id` (→ questions), usado quando o card é gerado a
--           partir de uma questão sem entrada no caderno (modos `questions`/
--           pontos fracos). A coluna nunca foi criada, então qualquer insert
--           com `question_id` falhava com PGRST204 ("column not found").
--
-- Fix:      Adiciona `question_id` espelhando o padrão de `entry_id`:
--           uuid NULL, FK para questions(id) ON DELETE SET NULL.
-- Idempotente: seguro re-executar (ADD COLUMN IF NOT EXISTS).
-- Reverter:  ALTER TABLE public.flashcards DROP COLUMN IF EXISTS question_id;

BEGIN;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS question_id uuid NULL
  REFERENCES public.questions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.flashcards.question_id IS
  'Link opcional à questão de origem do flashcard (modos questions / pontos fracos). Complementar a entry_id.';

COMMIT;
