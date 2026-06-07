-- =====================================================================
-- Caderno de Erros v2 — Fase 4: Calibração de Confiança Metacognitiva
-- =====================================================================
-- RPC read-only que cruza answers.confidence com
-- attempt_question_results.is_correct para revelar o grau de
-- alinhamento entre confiança declarada e desempenho real.
--
-- Dependências: error_notebook (v2 schema), answers, attempts,
--               attempt_question_results.
--
-- Idempotente: CREATE OR REPLACE.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_confidence_calibration(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();

  -- Bucket aggregates
  v_baixa_total   bigint := 0;
  v_baixa_correct bigint := 0;
  v_media_total   bigint := 0;
  v_media_correct bigint := 0;
  v_alta_total    bigint := 0;
  v_alta_correct  bigint := 0;

  -- Overall aggregates
  v_total_with_conf     bigint := 0;
  v_alta_but_wrong      bigint := 0;
  v_baixa_but_correct   bigint := 0;
BEGIN
  -- ── Autenticação ──────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_uid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: p_user_id does not match authenticated user';
  END IF;

  -- ── Agregar por bucket de confiança (uma query consolidada) ───────
  -- Join: answers → attempt_question_results → attempts
  -- Filtros: confidence IS NOT NULL, attempt status='submitted',
  --          attempt pertence ao usuário autenticado.
  SELECT
    COUNT(*) FILTER (WHERE a.confidence = 'baixa')                                       ,
    COUNT(*) FILTER (WHERE a.confidence = 'baixa'  AND aqr.is_correct = true)            ,
    COUNT(*) FILTER (WHERE a.confidence = 'media')                                       ,
    COUNT(*) FILTER (WHERE a.confidence = 'media'  AND aqr.is_correct = true)            ,
    COUNT(*) FILTER (WHERE a.confidence = 'alta')                                        ,
    COUNT(*) FILTER (WHERE a.confidence = 'alta'   AND aqr.is_correct = true)            ,
    COUNT(*)                                                                              ,
    COUNT(*) FILTER (WHERE a.confidence = 'alta'   AND aqr.is_correct = false)           ,
    COUNT(*) FILTER (WHERE a.confidence = 'baixa'  AND aqr.is_correct = true)
  INTO
    v_baixa_total,
    v_baixa_correct,
    v_media_total,
    v_media_correct,
    v_alta_total,
    v_alta_correct,
    v_total_with_conf,
    v_alta_but_wrong,
    v_baixa_but_correct
  FROM public.answers a
  JOIN public.attempt_question_results aqr
    ON aqr.attempt_id = a.attempt_id
   AND aqr.question_id = a.question_id
  JOIN public.attempts att
    ON att.id = a.attempt_id
   AND att.user_id = p_user_id
   AND att.status = 'submitted'
  WHERE a.confidence IS NOT NULL;

  -- ── Montar resposta ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'buckets', jsonb_build_array(
      jsonb_build_object(
        'confidence', 'baixa',
        'total',      v_baixa_total,
        'correct',    v_baixa_correct,
        'accuracy',   CASE WHEN v_baixa_total = 0 THEN NULL
                           ELSE ROUND((v_baixa_correct::numeric / v_baixa_total), 4)
                      END
      ),
      jsonb_build_object(
        'confidence', 'media',
        'total',      v_media_total,
        'correct',    v_media_correct,
        'accuracy',   CASE WHEN v_media_total = 0 THEN NULL
                           ELSE ROUND((v_media_correct::numeric / v_media_total), 4)
                      END
      ),
      jsonb_build_object(
        'confidence', 'alta',
        'total',      v_alta_total,
        'correct',    v_alta_correct,
        'accuracy',   CASE WHEN v_alta_total = 0 THEN NULL
                           ELSE ROUND((v_alta_correct::numeric / v_alta_total), 4)
                      END
      )
    ),
    'overall', jsonb_build_object(
      'total_answered_with_confidence', v_total_with_conf,
      'alta_but_wrong',                 v_alta_but_wrong,
      'baixa_but_correct',              v_baixa_but_correct
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_confidence_calibration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_confidence_calibration(uuid) TO authenticated;
