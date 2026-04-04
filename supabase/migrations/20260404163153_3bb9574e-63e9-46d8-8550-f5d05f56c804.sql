DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'attempt_status'
      AND e.enumlabel = 'offline_pending'
  ) THEN
    ALTER TYPE public.attempt_status ADD VALUE 'offline_pending';
  END IF;
END
$$;