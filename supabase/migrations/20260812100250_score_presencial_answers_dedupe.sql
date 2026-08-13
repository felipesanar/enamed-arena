-- Fix round 1/5 (review Critical + Important) da score_presencial_answers.
--
-- Critical: o LEFT JOIN de question_options filtrado por is_correct=true produz uma linha
-- por opção correta. Se uma questão tiver 2+ alternativas marcadas is_correct (não há unique
-- parcial em question_options que impeça isso), aquela questão contava 2x em `graded`,
-- inflando total_questions/by_area e distorcendo a nota. Troca por subquery escalar
-- (ORDER BY qo.id LIMIT 1) que por construção devolve no máximo 1 linha.
--
-- Important: `marked` não deduplicava question_id — payload de p_answers com a mesma
-- questão duas vezes também multiplicava a linha via o LEFT JOIN. Dedup com
-- DISTINCT ON (question_id).
--
-- Efeito: `graded` passa a ter exatamente 1 linha por questão do simulado, não importa
-- o estado dos dados de entrada (p_answers) nem de question_options.

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
    SELECT DISTINCT ON (question_id)
           question_id,
           selected_option_id
    FROM (
      SELECT (e->>'question_id')::uuid                     AS question_id,
             NULLIF(e->>'selected_option_id','')::uuid      AS selected_option_id
      FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) e
    ) raw_answers
    ORDER BY question_id
  ),
  graded AS (
    SELECT
      q.id,
      COALESCE(NULLIF(btrim(q.area), ''), 'Sem Especialidade') AS area,
      (m.selected_option_id IS NOT NULL
        AND m.selected_option_id = (
          SELECT qo.id
          FROM public.question_options qo
          WHERE qo.question_id = q.id AND qo.is_correct = true
          ORDER BY qo.id
          LIMIT 1
        )) AS is_correct
    FROM public.questions q
    LEFT JOIN marked m ON m.question_id = q.id
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
