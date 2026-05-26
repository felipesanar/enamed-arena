-- Migration 1: Structured AI review fields
ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS ai_practice jsonb,
  ADD COLUMN IF NOT EXISTS ai_option_rationales jsonb;

-- Migration 2: SRS snooze
ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_error_notebook_next_review_at
  ON public.error_notebook (user_id, next_review_at)
  WHERE deleted_at IS NULL AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.snooze_error_notebook_entry(
  p_entry_id uuid,
  p_days integer DEFAULT 3
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_clamped_days integer;
  v_next timestamptz;
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
  v_next := now() + (v_clamped_days || ' days')::interval;

  UPDATE public.error_notebook
     SET next_review_at = v_next
   WHERE id = p_entry_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.snooze_error_notebook_entry(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snooze_error_notebook_entry(uuid, integer) TO authenticated;