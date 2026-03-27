CREATE OR REPLACE FUNCTION public.get_onboarding_edit_guard_state()
RETURNS TABLE(can_edit boolean, reason text, next_edit_available_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    true AS can_edit,
    NULL::text AS reason,
    NULL::timestamptz AS next_edit_available_at;
$$;