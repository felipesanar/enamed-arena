-- RPC: get_user_area_scores_by_simulado
-- Returns per-(simulado, area) aggregated results for the authenticated user.
-- Used by ComparativoPage to render the cross-simulado specialty comparison table.

CREATE OR REPLACE FUNCTION public.get_user_area_scores_by_simulado(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  simulado_id uuid,
  area text,
  total integer,
  correct integer,
  score_percentage numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a.simulado_id,
    q.area,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE aqr.is_correct)::integer AS correct,
    ROUND(
      (COUNT(*) FILTER (WHERE aqr.is_correct))::numeric
        / NULLIF(COUNT(*), 0)::numeric * 100,
      0
    ) AS score_percentage
  FROM public.attempts a
  JOIN public.attempt_question_results aqr ON aqr.attempt_id = a.id
  JOIN public.questions q ON q.id = aqr.question_id
  WHERE a.user_id = p_user_id
    AND p_user_id = auth.uid()
    AND a.status IN ('submitted', 'expired')
  GROUP BY a.simulado_id, q.area
$$;

GRANT EXECUTE ON FUNCTION public.get_user_area_scores_by_simulado(uuid) TO authenticated;
