-- Gate performance read RPCs by results_release_at
-- Prevents students from seeing scores before official release.
-- The write path (recalculate_user_performance, user_performance_summary table) is unchanged.
-- Only the two read RPCs are rewritten.

-- ─── get_user_performance_history (rewritten) ────────────────────────────────
-- Adds JOIN simulados WHERE results_release_at <= now().
-- Only returns rows for simulados whose results have been officially released.

CREATE OR REPLACE FUNCTION public.get_user_performance_history(
  p_user_id uuid DEFAULT auth.uid(),
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  attempt_id uuid,
  simulado_id uuid,
  score_percentage numeric,
  total_correct integer,
  total_answered integer,
  total_questions integer,
  finished_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    uph.attempt_id,
    uph.simulado_id,
    uph.score_percentage,
    uph.total_correct,
    uph.total_answered,
    uph.total_questions,
    uph.finished_at
  FROM public.user_performance_history uph
  JOIN public.simulados s ON s.id = uph.simulado_id
  WHERE uph.user_id = p_user_id
    AND p_user_id = auth.uid()
    AND s.results_release_at <= now()
  ORDER BY uph.finished_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
$$;

-- ─── get_user_performance_summary (rewritten) ────────────────────────────────
-- Bypasses the pre-aggregated user_performance_summary table for client reads.
-- Computes live from user_performance_history JOIN simulados WHERE results_release_at <= now().
-- When user has no released results this returns 0 rows (not a row with zeros).
-- Frontend already handles summary === null correctly.

CREATE OR REPLACE FUNCTION public.get_user_performance_summary(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  user_id uuid,
  total_attempts integer,
  avg_score numeric,
  best_score numeric,
  last_score numeric,
  last_simulado_id uuid,
  last_finished_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH released AS (
    SELECT
      uph.user_id,
      uph.simulado_id,
      uph.score_percentage,
      uph.finished_at
    FROM public.user_performance_history uph
    JOIN public.simulados s ON s.id = uph.simulado_id
    WHERE uph.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND s.results_release_at <= now()
  ),
  last_released AS (
    SELECT simulado_id, score_percentage, finished_at
    FROM released
    ORDER BY finished_at DESC, simulado_id DESC
    LIMIT 1
  )
  SELECT
    p_user_id                                            AS user_id,
    COUNT(*)::integer                                    AS total_attempts,
    COALESCE(ROUND(AVG(r.score_percentage), 2), 0)      AS avg_score,
    COALESCE(MAX(r.score_percentage), 0)                 AS best_score,
    COALESCE(lr.score_percentage, 0)                     AS last_score,
    lr.simulado_id                                       AS last_simulado_id,
    lr.finished_at                                       AS last_finished_at
  FROM released r
  LEFT JOIN last_released lr ON true
  GROUP BY lr.simulado_id, lr.score_percentage, lr.finished_at
  HAVING COUNT(*) > 0
$$;
