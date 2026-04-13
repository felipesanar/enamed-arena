
DROP FUNCTION IF EXISTS public.admin_simulado_question_stats(uuid);

CREATE OR REPLACE FUNCTION public.admin_simulado_question_stats(p_simulado_id uuid)
RETURNS TABLE(
  question_number integer,
  text text,
  correct_rate numeric,
  discrimination_index numeric,
  most_common_wrong_label text,
  most_common_wrong_pct numeric,
  area text,
  theme text,
  total_responses bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH submitted AS (
    SELECT id
    FROM attempts
    WHERE simulado_id = p_simulado_id
      AND status = 'submitted'
  ),
  results AS (
    SELECT
      aqr.question_id,
      aqr.is_correct,
      aqr.was_answered,
      aqr.selected_option_id
    FROM attempt_question_results aqr
    JOIN submitted s ON s.id = aqr.attempt_id
  ),
  per_question AS (
    SELECT
      r.question_id,
      count(*) FILTER (WHERE r.was_answered) AS total_answered,
      count(*) FILTER (WHERE r.is_correct)   AS total_correct
    FROM results r
    GROUP BY r.question_id
  ),
  wrong_options AS (
    SELECT
      r.question_id,
      qo.label,
      count(*) AS cnt,
      ROW_NUMBER() OVER (PARTITION BY r.question_id ORDER BY count(*) DESC) AS rn
    FROM results r
    JOIN question_options qo ON qo.id = r.selected_option_id
    WHERE r.is_correct = false AND r.was_answered = true
    GROUP BY r.question_id, qo.label
  ),
  top_wrong AS (
    SELECT question_id, label, cnt
    FROM wrong_options
    WHERE rn = 1
  ),
  top_bottom AS (
    SELECT
      aqr.question_id,
      aqr.is_correct,
      CASE
        WHEN a.score_percentage >= (
          SELECT PERCENTILE_CONT(0.73) WITHIN GROUP (ORDER BY a2.score_percentage)
          FROM attempts a2
          WHERE a2.simulado_id = p_simulado_id AND a2.status = 'submitted'
        ) THEN 'top'
        WHEN a.score_percentage <= (
          SELECT PERCENTILE_CONT(0.27) WITHIN GROUP (ORDER BY a2.score_percentage)
          FROM attempts a2
          WHERE a2.simulado_id = p_simulado_id AND a2.status = 'submitted'
        ) THEN 'bottom'
      END AS tier
    FROM attempt_question_results aqr
    JOIN attempts a ON a.id = aqr.attempt_id
    WHERE a.simulado_id = p_simulado_id AND a.status = 'submitted'
  ),
  disc AS (
    SELECT
      question_id,
      COALESCE(
        (count(*) FILTER (WHERE tier = 'top' AND is_correct)::numeric
         / NULLIF(count(*) FILTER (WHERE tier = 'top'), 0))
        -
        (count(*) FILTER (WHERE tier = 'bottom' AND is_correct)::numeric
         / NULLIF(count(*) FILTER (WHERE tier = 'bottom'), 0))
      , 0) AS discrimination_index
    FROM top_bottom
    WHERE tier IS NOT NULL
    GROUP BY question_id
  )
  SELECT
    q.question_number,
    q.text,
    COALESCE(ROUND(pq.total_correct::numeric / NULLIF(pq.total_answered, 0) * 100, 1), 0) AS correct_rate,
    COALESCE(ROUND(d.discrimination_index, 2), 0) AS discrimination_index,
    tw.label AS most_common_wrong_label,
    CASE WHEN tw.cnt IS NOT NULL AND pq.total_answered > 0
      THEN ROUND(tw.cnt::numeric / pq.total_answered * 100, 1)
      ELSE NULL
    END AS most_common_wrong_pct,
    q.area,
    q.theme,
    COALESCE(pq.total_answered, 0) AS total_responses
  FROM questions q
  LEFT JOIN per_question pq ON pq.question_id = q.id
  LEFT JOIN disc d ON d.question_id = q.id
  LEFT JOIN top_wrong tw ON tw.question_id = q.id
  WHERE q.simulado_id = p_simulado_id
  ORDER BY correct_rate ASC, q.question_number ASC;
$$;
