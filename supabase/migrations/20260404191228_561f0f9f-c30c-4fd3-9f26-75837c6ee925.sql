
CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(p_attempt_id uuid)
 RETURNS TABLE(score_percentage numeric, total_correct integer, total_answered integer, total_questions integer)
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
      ), 0);
    RETURN;
  END IF;

  -- Count total questions
  SELECT COUNT(*)::INTEGER
  INTO v_total_questions
  FROM public.questions q
  WHERE q.simulado_id = v_attempt.simulado_id;

  -- Count unanswered questions (no answer row or null selected_option_id)
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
    was_answered = EXCLUDED.was_answered,
    updated_at = now();

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
  SELECT v_score, v_total_correct, v_total_answered, v_total_questions;
END;
$function$;

-- Also guard submit_offline_answers_guarded
CREATE OR REPLACE FUNCTION public.submit_offline_answers_guarded(p_attempt_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt         public.attempts%ROWTYPE;
  v_simulado        public.simulados%ROWTYPE;
  v_now             TIMESTAMPTZ := now();
  v_elapsed_secs    DOUBLE PRECISION;
  v_exam_secs       INTEGER;
  v_in_time         BOOLEAN;
  v_in_window       BOOLEAN;
  v_is_within       BOOLEAN;
  v_ans             jsonb;
  v_q_id            uuid;
  v_opt_id          uuid;
  v_total_questions INTEGER;
  v_total_answered  INTEGER;
BEGIN
  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND attempt_type = 'offline'
    AND status = 'offline_pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offline attempt not found or already submitted';
  END IF;

  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = v_attempt.simulado_id;

  v_exam_secs    := v_simulado.duration_minutes * 60;
  v_elapsed_secs := EXTRACT(EPOCH FROM (v_now - v_attempt.started_at));
  v_in_time      := v_elapsed_secs <= v_exam_secs;

  v_in_window := (
    v_attempt.started_at >= v_simulado.execution_window_start
    AND v_attempt.started_at <= v_simulado.execution_window_end
  );

  v_is_within := v_in_window AND v_in_time;

  -- Upsert answers
  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id := (v_ans->>'question_id')::uuid;

    IF (v_ans->>'selected_option_id') IS NOT NULL THEN
      v_opt_id := (v_ans->>'selected_option_id')::uuid;
    ELSE
      v_opt_id := NULL;
    END IF;

    INSERT INTO public.answers (
      attempt_id, question_id, selected_option_id,
      marked_for_review, high_confidence, eliminated_options, answered_at
    )
    VALUES (
      p_attempt_id, v_q_id, v_opt_id,
      false, false, '{}',
      CASE WHEN v_opt_id IS NOT NULL THEN v_now ELSE NULL END
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      selected_option_id = EXCLUDED.selected_option_id,
      answered_at        = EXCLUDED.answered_at;
  END LOOP;

  -- Check all questions are answered
  SELECT COUNT(*)::INTEGER INTO v_total_questions
  FROM public.questions WHERE simulado_id = v_attempt.simulado_id;

  SELECT COUNT(*)::INTEGER INTO v_total_answered
  FROM public.answers
  WHERE attempt_id = p_attempt_id AND selected_option_id IS NOT NULL;

  IF v_total_answered < v_total_questions THEN
    RAISE EXCEPTION 'Cannot submit: % question(s) unanswered', (v_total_questions - v_total_answered);
  END IF;

  -- Set timing metadata before finalization
  UPDATE public.attempts SET
    offline_answers_submitted_at = v_now,
    finished_at                  = v_now,
    is_within_window             = v_is_within
  WHERE id = p_attempt_id;

  -- Finalize: calculates score, sets status = 'submitted'
  PERFORM public.finalize_attempt_with_results(p_attempt_id);

  -- Re-assert is_within_window after finalize
  UPDATE public.attempts SET
    is_within_window = v_is_within
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id',      p_attempt_id,
    'is_within_window', v_is_within
  );
END;
$function$;
