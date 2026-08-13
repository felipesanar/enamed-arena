-- Fix crítico (Task 1, round 1): 'presencial_pending' precisa existir no enum
-- public.attempt_status (não é text/CHECK). Mesmo padrão guardado usado para
-- 'offline_pending' em 20260404163153_3bb9574e-63e9-46d8-8550-f5d05f56c804.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'attempt_status'
      AND e.enumlabel = 'presencial_pending'
  ) THEN
    ALTER TYPE public.attempt_status ADD VALUE 'presencial_pending';
  END IF;
END
$$;
