-- RPC: get_user_cutoff_context
-- Retorna o contexto de "meta" do aluno baseado no onboarding e na tabela
-- enamed_cutoff_scores. Usado pela IA do Prof. Sanor (Comparativo e Desempenho)
-- pra falar sobre nota de corte REAL e granular em vez de chute genérico.
--
-- Comportamento:
--  - has_target_cutoff = true SE houver match (specialty + institution) em enamed_cutoff_scores
--  - has_target_cutoff = false caso contrário (aluno deve ser direcionado a configurar onboarding)
--  - Quando há multiple matches (várias instituições ou cenários por instituição),
--    retornamos a estatística agregada (min/max/median/avg) e a lista detalhada.
--  - "general" e "quota" são tracks distintos. Default reporta general; mostramos quota se houver.

CREATE OR REPLACE FUNCTION public.get_user_cutoff_context(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_onboarding RECORD;
  v_matches jsonb;
  v_unmatched_institutions text[];
  v_stats jsonb;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object(
      'has_target_cutoff', false,
      'reason', 'unauthorized'
    );
  END IF;

  SELECT specialty, target_institutions, status
    INTO v_onboarding
    FROM public.onboarding_profiles
   WHERE user_id = p_user_id
   LIMIT 1;

  IF NOT FOUND OR v_onboarding.status <> 'completed' THEN
    RETURN jsonb_build_object(
      'has_target_cutoff', false,
      'reason', 'no_onboarding',
      'specialty', NULL,
      'target_institutions', NULL
    );
  END IF;

  IF v_onboarding.specialty IS NULL OR v_onboarding.specialty = ''
     OR v_onboarding.target_institutions IS NULL OR array_length(v_onboarding.target_institutions, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'has_target_cutoff', false,
      'reason', 'incomplete_onboarding',
      'specialty', v_onboarding.specialty,
      'target_institutions', to_jsonb(v_onboarding.target_institutions)
    );
  END IF;

  WITH user_targets AS (
    SELECT
      v_onboarding.specialty AS specialty,
      unnest(v_onboarding.target_institutions) AS institution
  ),
  matched AS (
    SELECT
      ut.institution AS user_institution,
      cs.institution_name,
      cs.practice_scenario,
      cs.specialty_name,
      cs.cutoff_score_general,
      cs.cutoff_score_quota
    FROM user_targets ut
    JOIN public.enamed_cutoff_scores cs
      ON UPPER(cs.specialty_name) = UPPER(ut.specialty)
     AND (
       cs.institution_name ILIKE ut.institution
       OR ut.institution ILIKE cs.institution_name
       OR cs.institution_name ILIKE '%' || ut.institution || '%'
       OR ut.institution ILIKE '%' || cs.institution_name || '%'
       OR cs.practice_scenario ILIKE '%' || ut.institution || '%'
     )
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'user_institution', user_institution,
      'matched_institution', institution_name,
      'practice_scenario', practice_scenario,
      'specialty', specialty_name,
      'cutoff_general', cutoff_score_general,
      'cutoff_quota', cutoff_score_quota
    )), '[]'::jsonb)
  INTO v_matches
  FROM matched;

  v_unmatched_institutions := ARRAY(
    SELECT ut.institution
      FROM unnest(v_onboarding.target_institutions) ut(institution)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.enamed_cutoff_scores cs
        WHERE UPPER(cs.specialty_name) = UPPER(v_onboarding.specialty)
          AND (
            cs.institution_name ILIKE ut.institution
            OR ut.institution ILIKE cs.institution_name
            OR cs.institution_name ILIKE '%' || ut.institution || '%'
            OR ut.institution ILIKE '%' || cs.institution_name || '%'
            OR cs.practice_scenario ILIKE '%' || ut.institution || '%'
          )
     )
  );

  IF jsonb_array_length(v_matches) > 0 THEN
    WITH g AS (
      SELECT (m->>'cutoff_general')::numeric AS v
        FROM jsonb_array_elements(v_matches) m
       WHERE m->>'cutoff_general' IS NOT NULL
    ),
    sorted AS (
      SELECT v, row_number() OVER (ORDER BY v) AS rn, count(*) OVER () AS cnt FROM g
    )
    SELECT jsonb_build_object(
      'count',  (SELECT count(*) FROM g),
      'min',    (SELECT MIN(v) FROM g),
      'max',    (SELECT MAX(v) FROM g),
      'avg',    (SELECT ROUND(AVG(v), 1) FROM g),
      'median', (
        SELECT ROUND(AVG(v), 1) FROM sorted
         WHERE rn IN (FLOOR((cnt + 1) / 2.0)::int, CEIL((cnt + 1) / 2.0)::int)
      )
    ) INTO v_stats;
  ELSE
    v_stats := jsonb_build_object('count', 0);
  END IF;

  v_result := jsonb_build_object(
    'has_target_cutoff', jsonb_array_length(v_matches) > 0,
    'reason', CASE WHEN jsonb_array_length(v_matches) > 0 THEN 'matched' ELSE 'no_match' END,
    'specialty', v_onboarding.specialty,
    'target_institutions', to_jsonb(v_onboarding.target_institutions),
    'matches', v_matches,
    'unmatched_institutions', to_jsonb(v_unmatched_institutions),
    'stats', v_stats
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cutoff_context(uuid) TO authenticated;
