
CREATE OR REPLACE FUNCTION public.is_any_simulado_window_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.simulados
    WHERE status = 'published'
      AND execution_window_start <= p_now
      AND execution_window_end >= p_now
  );
$$;
