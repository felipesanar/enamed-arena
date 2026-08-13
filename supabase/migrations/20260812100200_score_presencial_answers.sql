-- Correção agregada de um gabarito presencial, sem depender de attempt.
-- Fonte única da Tela 3: o finalize devolve totais mas não a quebra por área.

CREATE OR REPLACE FUNCTION public.score_presencial_answers(
  p_simulado_id uuid,
  p_answers     jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH marked AS (
    SELECT (e->>'question_id')::uuid                     AS question_id,
           NULLIF(e->>'selected_option_id','')::uuid      AS selected_option_id
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) e
  ),
  graded AS (
    SELECT
      q.id,
      COALESCE(NULLIF(btrim(q.area), ''), 'Sem Especialidade') AS area,
      (m.selected_option_id IS NOT NULL
        AND m.selected_option_id = qo.id) AS is_correct
    FROM public.questions q
    LEFT JOIN marked m ON m.question_id = q.id
    LEFT JOIN public.question_options qo
      ON qo.question_id = q.id AND qo.is_correct = true
    WHERE q.simulado_id = p_simulado_id
  ),
  by_area AS (
    SELECT area,
           COUNT(*)::int                          AS total,
           COUNT(*) FILTER (WHERE is_correct)::int AS correct
    FROM graded GROUP BY area
  )
  SELECT jsonb_build_object(
    'total_questions', (SELECT COUNT(*)::int FROM graded),
    'total_correct',   (SELECT COUNT(*) FILTER (WHERE is_correct)::int FROM graded),
    'score_percentage', (
      SELECT CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric * 100 / COUNT(*), 2)
        ELSE 0 END
      FROM graded
    ),
    'by_area', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'area', area, 'total', total, 'correct', correct,
        'percentage', CASE WHEN total > 0
          THEN ROUND(correct::numeric * 100 / total, 2) ELSE 0 END
      ) ORDER BY area), '[]'::jsonb)
      FROM by_area
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.score_presencial_answers(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_presencial_answers(uuid, jsonb) TO service_role;
