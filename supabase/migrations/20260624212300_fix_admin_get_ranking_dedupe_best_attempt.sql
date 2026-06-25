CREATE OR REPLACE FUNCTION public.admin_get_ranking_for_simulado(p_simulado_id uuid, p_include_train boolean DEFAULT false)
 RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamp with time zone, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  WITH best AS (
    SELECT DISTINCT ON (a.user_id)
      a.user_id, a.simulado_id, a.score_percentage, a.total_correct,
      a.total_answered, a.finished_at
    FROM public.attempts a
    WHERE a.simulado_id = p_simulado_id
      AND a.status IN ('submitted', 'expired')
      AND a.score_percentage IS NOT NULL
      AND (p_include_train OR a.is_within_window = true)
    ORDER BY a.user_id, a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
  )
  SELECT
    b.user_id,
    b.simulado_id,
    b.score_percentage AS nota_final,
    b.total_correct,
    b.total_answered,
    b.finished_at,
    p.full_name,
    p.segment,
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN public.enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY b.score_percentage DESC NULLS LAST, b.finished_at ASC NULLS LAST
    )::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.onboarding_profiles op ON op.user_id = b.user_id
  LEFT JOIN public.enamed_specialties es ON es.id = op.specialty_id
  ORDER BY b.score_percentage DESC NULLS LAST, b.finished_at ASC NULLS LAST;
END;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_get_ranking_for_simulado(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_ranking_for_simulado(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ranking_for_simulado(uuid, boolean) TO authenticated, service_role;
