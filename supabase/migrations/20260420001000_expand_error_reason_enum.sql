-- =====================================================================
-- Expand error_reason enum to match frontend's DbReason union
-- =====================================================================
-- The frontend (src/lib/errorNotebookReasons.ts) defines 6 reasons, but
-- the DB enum only had 4. Users picking "Desatenção" (reading_error) or
-- "Confundi com outra condição" (confused_alternatives) in the
-- AddToNotebookModal would fail on insert. This migration aligns the DB
-- with the frontend.
--
-- Note: Postgres does not allow removing enum values, and ALTER TYPE ...
-- ADD VALUE cannot run inside a transaction when applied to an enum
-- already in use. We use IF NOT EXISTS so re-runs are safe.
-- =====================================================================

ALTER TYPE public.error_reason ADD VALUE IF NOT EXISTS 'reading_error';
ALTER TYPE public.error_reason ADD VALUE IF NOT EXISTS 'confused_alternatives';
