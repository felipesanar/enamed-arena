-- Persist per-question correction and reprocessing queue

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'attempt_processing_status'
  ) THEN
    CREATE TYPE public.attempt_processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.attempt_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.question_options(id),
  correct_option_id UUID REFERENCES public.question_options(id),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  was_answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_question_results_attempt
  ON public.attempt_question_results(attempt_id);

CREATE TABLE IF NOT EXISTS public.attempt_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attempt_processing_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_attempt_processing_queue_status
  ON public.attempt_processing_queue(status, created_at ASC);

CREATE TRIGGER update_attempt_question_results_updated_at
  BEFORE UPDATE ON public.attempt_question_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_attempt_processing_queue_updated_at
  BEFORE UPDATE ON public.attempt_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.attempt_question_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own attempt question results"
  ON public.attempt_question_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.attempts a
      WHERE a.id = attempt_question_results.attempt_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "No direct writes on attempt question results"
  ON public.attempt_question_results
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct updates on attempt question results"
  ON public.attempt_question_results
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Users can read own attempt queue"
  ON public.attempt_processing_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can enqueue own attempts"
  ON public.attempt_processing_queue
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users cannot directly update queue"
  ON public.attempt_processing_queue
  FOR UPDATE TO authenticated
  USING (false);

-- Replace authoritative finalization to also persist per-question correction
CREATE OR REPLACE FUNCTION public.finalize_attempt_with_results(p_attempt_id uuid)
RETURNS TABLE (
  score_percentage numeric,
  total_correct integer,
  total_answered integer,
  total_questions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_total_questions INTEGER := 0;
  v_total_answered INTEGER := 0;
  v_total_correct INTEGER := 0;
  v_score NUMERIC(5,2) := 0;
  v_finished_at TIMESTAMPTZ := now();
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
  INTO v_total_questions
  FROM public.questions q
  WHERE q.simulado_id = v_attempt.simulado_id;

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
$$;

CREATE OR REPLACE FUNCTION public.enqueue_attempt_reprocessing(
  p_attempt_id uuid,
  p_reason text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_queue_id uuid;
BEGIN
  SELECT *
  INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found for current user';
  END IF;

  INSERT INTO public.attempt_processing_queue (
    attempt_id,
    user_id,
    status,
    attempt_count,
    last_error
  )
  VALUES (
    v_attempt.id,
    v_attempt.user_id,
    'pending',
    0,
    p_reason
  )
  ON CONFLICT (attempt_id) DO UPDATE
  SET
    status = 'pending',
    last_error = EXCLUDED.last_error,
    processed_at = null,
    updated_at = now()
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_attempt_reprocessing_queue(p_limit integer DEFAULT 20)
RETURNS TABLE (
  processed_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT q.id, q.attempt_id
    FROM public.attempt_processing_queue q
    WHERE q.status IN ('pending', 'failed')
    ORDER BY q.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 20), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.attempt_processing_queue
      SET status = 'processing', attempt_count = attempt_count + 1
      WHERE id = v_row.id;

      PERFORM public.finalize_attempt_with_results(v_row.attempt_id);

      UPDATE public.attempt_processing_queue
      SET status = 'completed', processed_at = now(), last_error = null
      WHERE id = v_row.id;

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.attempt_processing_queue
      SET status = 'failed', last_error = SQLERRM
      WHERE id = v_row.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attempt_question_results(p_attempt_id uuid)
RETURNS TABLE (
  question_id uuid,
  selected_option_id uuid,
  correct_option_id uuid,
  is_correct boolean,
  was_answered boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    aqr.question_id,
    aqr.selected_option_id,
    aqr.correct_option_id,
    aqr.is_correct,
    aqr.was_answered
  FROM public.attempt_question_results aqr
  JOIN public.attempts a ON a.id = aqr.attempt_id
  WHERE aqr.attempt_id = p_attempt_id
    AND a.user_id = auth.uid()
$$;
