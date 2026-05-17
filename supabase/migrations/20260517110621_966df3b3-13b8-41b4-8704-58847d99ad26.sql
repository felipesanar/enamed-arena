-- Postgres requires DROPping the function before changing its return signature.
DROP FUNCTION IF EXISTS public.finalize_attempt_with_results(uuid);

CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(p_attempt_id uuid)
 RETURNS TABLE(
   score_percentage numeric,
   total_correct integer,
   total_answered integer,
   total_questions integer,
   is_within_window boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_total_questions INTEGER := 0;
  v_total_answered INTEGER := 0;
  v_total_correct INTEGER := 0;
  v_score NUMERIC(5,2) := 0;
  v_finished_at TIMESTAMPTZ := now();
  v_unanswered INTEGER := 0;
BEGIN
  SELECT *
  INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found for current user';
  END IF;

  IF v_attempt.status = 'submitted' AND v_attempt.score_percentage IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_attempt.score_percentage,
      COALESCE(v_attempt.total_correct, 0),
      COALESCE(v_attempt.total_answered, 0),
      COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM public.questions q
        WHERE q.simulado_id = v_attempt.simulado_id
      ), 0),
      COALESCE(v_attempt.is_within_window, false);
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total_questions
  FROM public.questions q
  WHERE q.simulado_id = v_attempt.simulado_id;

  SELECT COUNT(*)::INTEGER
  INTO v_unanswered
  FROM public.questions q
  LEFT JOIN public.answers a
    ON a.question_id = q.id AND a.attempt_id = v_attempt.id
  WHERE q.simulado_id = v_attempt.simulado_id
    AND (a.selected_option_id IS NULL);

  IF v_unanswered > 0 THEN
    RAISE EXCEPTION 'Cannot submit: % question(s) unanswered', v_unanswered;
  END IF;

  INSERT INTO public.attempt_question_results (
    attempt_id,
    question_id,
    selected_option_id,
    correct_option_id,
    is_correct,
    was_answered
  )
  SELECT
    v_attempt.id,
    q.id AS question_id,
    a.selected_option_id,
    qo_correct.id AS correct_option_id,
    CASE
      WHEN a.selected_option_id IS NOT NULL AND a.selected_option_id = qo_correct.id THEN true
      ELSE false
    END AS is_correct,
    (a.selected_option_id IS NOT NULL) AS was_answered
  FROM public.questions q
  LEFT JOIN public.answers a
    ON a.question_id = q.id
   AND a.attempt_id = v_attempt.id
  LEFT JOIN public.question_options qo_correct
    ON qo_correct.question_id = q.id
   AND qo_correct.is_correct = true
  WHERE q.simulado_id = v_attempt.simulado_id
  ON CONFLICT (attempt_id, question_id) DO UPDATE
  SET
    selected_option_id = EXCLUDED.selected_option_id,
    correct_option_id = EXCLUDED.correct_option_id,
    is_correct = EXCLUDED.is_correct,
    was_answered = EXCLUDED.was_answered;

  SELECT COUNT(*)::INTEGER
  INTO v_total_answered
  FROM public.attempt_question_results aqr
  WHERE aqr.attempt_id = v_attempt.id
    AND aqr.was_answered = true;

  SELECT COUNT(*)::INTEGER
  INTO v_total_correct
  FROM public.attempt_question_results aqr
  WHERE aqr.attempt_id = v_attempt.id
    AND aqr.is_correct = true;

  v_score := CASE
    WHEN v_total_questions > 0 THEN ROUND((v_total_correct::NUMERIC * 100) / v_total_questions, 2)
    ELSE 0
  END;

  UPDATE public.attempts
  SET
    status = 'submitted',
    finished_at = COALESCE(finished_at, v_finished_at),
    score_percentage = v_score,
    total_correct = v_total_correct,
    total_answered = v_total_answered,
    last_saved_at = now()
  WHERE id = v_attempt.id;

  SELECT * INTO v_attempt FROM public.attempts WHERE id = v_attempt.id;

  INSERT INTO public.user_performance_history (
    user_id,
    attempt_id,
    simulado_id,
    score_percentage,
    total_correct,
    total_answered,
    total_questions,
    finished_at
  )
  VALUES (
    v_attempt.user_id,
    v_attempt.id,
    v_attempt.simulado_id,
    v_score,
    v_total_correct,
    v_total_answered,
    v_total_questions,
    COALESCE(v_attempt.finished_at, v_finished_at)
  )
  ON CONFLICT (attempt_id) DO UPDATE
  SET
    score_percentage = EXCLUDED.score_percentage,
    total_correct = EXCLUDED.total_correct,
    total_answered = EXCLUDED.total_answered,
    total_questions = EXCLUDED.total_questions,
    finished_at = EXCLUDED.finished_at;

  PERFORM public.recalculate_user_performance(v_attempt.user_id);

  DELETE FROM public.attempt_processing_queue
  WHERE attempt_id = v_attempt.id;

  RETURN QUERY
  SELECT
    v_score,
    v_total_correct,
    v_total_answered,
    v_total_questions,
    COALESCE(v_attempt.is_within_window, false);
END;
$function$;