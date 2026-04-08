-- Admin-only ranking preview: same shape as get_ranking_for_simulado, optional inclusion of
-- out-of-window (treino) attempts. Listing simulados for selector without results_release_at gate.

CREATE OR REPLACE FUNCTION public.admin_get_ranking_for_simulado(
  p_simulado_id uuid,
  p_include_train boolean DEFAULT false
)
RETURNS TABLE(
  user_id uuid,
  simulado_id uuid,
  nota_final numeric,
  total_correct integer,
  total_answered integer,
  finished_at timestamp with time zone,
  full_name text,
  segment user_segment,
  especialidade text,
  instituicoes_alvo text[],
  posicao bigint,
  total_candidatos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    op.specialty AS especialidade,
    op.target_institutions AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    )::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM public.attempts a
  JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.onboarding_profiles op ON op.user_id = a.user_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND (p_include_train OR a.is_within_window = true)
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_simulados_for_ranking_preview()
RETURNS TABLE(
  id uuid,
  title text,
  sequence_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  SELECT s.id, s.title::text, s.sequence_number
  FROM public.simulados s
  WHERE s.status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.attempts a
      WHERE a.simulado_id = s.id
        AND a.status IN ('submitted', 'expired')
        AND a.score_percentage IS NOT NULL
    )
  ORDER BY s.sequence_number ASC;
END;
$function$;
