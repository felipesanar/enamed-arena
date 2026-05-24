-- RPC: get_user_attempt_behavior_stats
-- Returns per-attempt behavior aggregates for the authenticated user.
-- Used by ComparativoPage to render the "Comportamento" section.

CREATE OR REPLACE FUNCTION public.get_user_attempt_behavior_stats(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  attempt_id uuid,
  simulado_id uuid,
  total_questions integer,
  total_answered integer,
  total_correct integer,
  total_marked_for_review integer,
  total_high_confidence integer,
  high_confidence_correct integer,
  high_confidence_wrong integer,
  tab_exit_count integer,
  fullscreen_exit_count integer,
  duration_seconds integer,
  started_at timestamptz,
  finished_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH attempt_scope AS (
    SELECT a.id, a.simulado_id, a.tab_exit_count, a.fullscreen_exit_count,
           a.started_at, a.finished_at
    FROM public.attempts a
    WHERE a.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND a.status IN ('submitted', 'expired')
  ),
  answer_stats AS (
    SELECT
      ans.attempt_id,
      COUNT(*)::int AS total_answered,
      COUNT(*) FILTER (WHERE ans.marked_for_review)::int AS total_marked_for_review,
      COUNT(*) FILTER (WHERE ans.high_confidence)::int AS total_high_confidence,
      COUNT(*) FILTER (
        WHERE ans.high_confidence
          AND aqr.is_correct = true
      )::int AS high_confidence_correct,
      COUNT(*) FILTER (
        WHERE ans.high_confidence
          AND aqr.is_correct = false
      )::int AS high_confidence_wrong
    FROM public.answers ans
    LEFT JOIN public.attempt_question_results aqr
      ON aqr.attempt_id = ans.attempt_id AND aqr.question_id = ans.question_id
    WHERE ans.attempt_id IN (SELECT id FROM attempt_scope)
      AND ans.selected_option_id IS NOT NULL
    GROUP BY ans.attempt_id
  ),
  result_stats AS (
    SELECT aqr.attempt_id,
           COUNT(*)::int AS total_questions,
           COUNT(*) FILTER (WHERE aqr.is_correct)::int AS total_correct
    FROM public.attempt_question_results aqr
    WHERE aqr.attempt_id IN (SELECT id FROM attempt_scope)
    GROUP BY aqr.attempt_id
  )
  SELECT
    s.id AS attempt_id,
    s.simulado_id,
    COALESCE(rs.total_questions, 0) AS total_questions,
    COALESCE(ans.total_answered, 0) AS total_answered,
    COALESCE(rs.total_correct, 0) AS total_correct,
    COALESCE(ans.total_marked_for_review, 0) AS total_marked_for_review,
    COALESCE(ans.total_high_confidence, 0) AS total_high_confidence,
    COALESCE(ans.high_confidence_correct, 0) AS high_confidence_correct,
    COALESCE(ans.high_confidence_wrong, 0) AS high_confidence_wrong,
    s.tab_exit_count,
    s.fullscreen_exit_count,
    CASE
      WHEN s.finished_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (s.finished_at - s.started_at))::int
    END AS duration_seconds,
    s.started_at,
    s.finished_at
  FROM attempt_scope s
  LEFT JOIN answer_stats ans ON ans.attempt_id = s.id
  LEFT JOIN result_stats rs ON rs.attempt_id = s.id
  ORDER BY s.started_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_attempt_behavior_stats(uuid) TO authenticated;
