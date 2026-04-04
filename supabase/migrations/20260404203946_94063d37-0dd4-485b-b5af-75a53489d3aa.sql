-- Revoke direct SELECT on question_options from authenticated role
-- Then grant only safe columns (excluding is_correct)
REVOKE SELECT ON public.question_options FROM authenticated;
GRANT SELECT (id, question_id, label, text, created_at) ON public.question_options TO authenticated;