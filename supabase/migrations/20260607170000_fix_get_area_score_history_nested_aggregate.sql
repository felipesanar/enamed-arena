-- Fix: get_area_score_history quebrava com 42803 "aggregate function calls
-- cannot be nested" no bloco `global` (jsonb_agg envolvendo AVG no mesmo nível
-- de SELECT). Isso quebrava o histórico de score por área e o sparkline de ROI
-- nos Insights do Caderno.
--
-- Correção: calcular o AVG por attempt numa subquery e só então aplicar
-- jsonb_agg, espelhando o padrão já correto do bloco `by_area`. Restante
-- idêntico. Aplicado no remoto via migration
-- `fix_get_area_score_history_nested_aggregate`.
CREATE OR REPLACE FUNCTION public.get_area_score_history(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_by_area jsonb;
  v_global jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_uid <> p_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_object_agg(area, scores_json) INTO v_by_area
  FROM (
    SELECT area_scores.area,
      jsonb_agg(jsonb_build_object(
        'attempt_id', area_scores.attempt_id, 'finished_at', area_scores.finished_at,
        'score', area_scores.score, 'questions_total', area_scores.questions_total,
        'questions_correct', area_scores.questions_correct
      ) ORDER BY area_scores.finished_at ASC) AS scores_json
    FROM (
      SELECT q.area, att.id AS attempt_id, att.finished_at,
        ROUND(AVG(aqr.is_correct::int)::numeric, 4)::float8 AS score,
        COUNT(*) AS questions_total,
        COUNT(*) FILTER (WHERE aqr.is_correct = true) AS questions_correct
      FROM public.attempts att
      JOIN public.attempt_question_results aqr ON aqr.attempt_id = att.id
      JOIN public.questions q ON q.id = aqr.question_id AND q.area IS NOT NULL
     WHERE att.user_id = v_uid AND att.status = 'submitted' AND att.finished_at IS NOT NULL
     GROUP BY q.area, att.id, att.finished_at
    ) area_scores
   GROUP BY area_scores.area
  ) agg;

  SELECT jsonb_agg(jsonb_build_object(
    'attempt_id', g.attempt_id, 'finished_at', g.finished_at, 'score_global', g.score_global
  ) ORDER BY g.finished_at ASC)
  INTO v_global
  FROM (
    SELECT att.id AS attempt_id, att.finished_at,
      ROUND(AVG(aqr.is_correct::int)::numeric, 4)::float8 AS score_global
    FROM public.attempts att
    JOIN public.attempt_question_results aqr ON aqr.attempt_id = att.id
   WHERE att.user_id = v_uid AND att.status = 'submitted' AND att.finished_at IS NOT NULL
   GROUP BY att.id, att.finished_at
  ) g;

  RETURN jsonb_build_object('by_area', COALESCE(v_by_area, '{}'::jsonb), 'global', COALESCE(v_global, '[]'::jsonb));
END;
$function$;
