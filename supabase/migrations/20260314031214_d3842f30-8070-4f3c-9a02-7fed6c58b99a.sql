
-- Create a view that composes ranking data from real attempts, profiles, and onboarding
-- Mirrors the ranking_public view pattern from Ranking ENAMED
CREATE OR REPLACE VIEW public.ranking_simulado WITH (security_invoker = on) AS
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
  -- Position will be computed client-side per filter context, but we provide a global one
  ROW_NUMBER() OVER (
    PARTITION BY a.simulado_id
    ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
  ) AS posicao,
  COUNT(*) OVER (PARTITION BY a.simulado_id) AS total_candidatos
FROM attempts a
JOIN profiles p ON p.id = a.user_id
LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
WHERE a.status IN ('submitted', 'expired')
  AND a.score_percentage IS NOT NULL;

-- RLS: The view uses security_invoker=on, so it respects existing RLS on attempts/profiles/onboarding_profiles.
-- However, we need attempts to be readable for ranking purposes.
-- Create a function to check if a simulado has results available (submitted attempts exist).

-- We need to allow reading OTHER users' attempt data for ranking purposes.
-- Create a security definer function that returns ranking data for a given simulado.
CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE (
  user_id uuid,
  simulado_id uuid,
  nota_final numeric,
  total_correct integer,
  total_answered integer,
  finished_at timestamptz,
  full_name text,
  segment public.user_segment,
  especialidade text,
  instituicoes_alvo text[],
  posicao bigint,
  total_candidatos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ) AS posicao,
    COUNT(*) OVER () AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
$$;
