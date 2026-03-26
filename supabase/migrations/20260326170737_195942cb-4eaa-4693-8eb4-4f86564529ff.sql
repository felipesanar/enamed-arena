-- Server-authoritative finalization and consolidated performance

-- 1) Dedicated performance tables
CREATE TABLE IF NOT EXISTS public.user_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.attempts(id) ON DELETE CASCADE,
  simulado_id UUID NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  score_percentage NUMERIC(5,2) NOT NULL,
  total_correct INTEGER NOT NULL,
  total_answered INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_performance_history_user_finished
  ON public.user_performance_history(user_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS public.user_performance_summary (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  best_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_simulado_id UUID REFERENCES public.simulados(id) ON DELETE SET NULL,
  last_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_user_performance_summary_updated_at
  BEFORE UPDATE ON public.user_performance_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 2) RLS
ALTER TABLE public.user_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_performance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own performance history"
  ON public.user_performance_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own performance summary"
  ON public.user_performance_summary
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct insert on performance history"
  ON public.user_performance_history
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update on performance history"
  ON public.user_performance_history
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No direct insert on performance summary"
  ON public.user_performance_summary
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct update on performance summary"
  ON public.user_performance_summary
  FOR UPDATE TO authenticated
  USING (false);

-- 3) Recalculate summary helper
CREATE OR REPLACE FUNCTION public.recalculate_user_performance(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_attempts INTEGER := 0;
  v_avg_score NUMERIC(5,2) := 0;
  v_best_score NUMERIC(5,2) := 0;
  v_last_score NUMERIC(5,2) := 0;
  v_last_simulado_id UUID := NULL;
  v_last_finished_at TIMESTAMPTZ := NULL;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(ROUND(AVG(score_percentage), 2), 0)::NUMERIC(5,2),
    COALESCE(MAX(score_percentage), 0)::NUMERIC(5,2)
  INTO
    v_total_attempts,
    v_avg_score,
    v_best_score
  FROM public.user_performance_history
  WHERE user_id = p_user_id;

  SELECT score_percentage, simulado_id, finished_at
  INTO v_last_score, v_last_simulado_id, v_last_finished_at
  FROM public.user_performance_history
  WHERE user_id = p_user_id
  ORDER BY finished_at DESC
  LIMIT 1;

  INSERT INTO public.user_performance_summary (
    user_id,
    total_attempts,
    avg_score,
    best_score,
    last_score,
    last_simulado_id,
    last_finished_at
  )
  VALUES (
    p_user_id,
    v_total_attempts,
    v_avg_score,
    v_best_score,
    COALESCE(v_last_score, 0),
    v_last_simulado_id,
    v_last_finished_at
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_attempts = EXCLUDED.total_attempts,
    avg_score = EXCLUDED.avg_score,
    best_score = EXCLUDED.best_score,
    last_score = EXCLUDED.last_score,
    last_simulado_id = EXCLUDED.last_simulado_id,
    last_finished_at = EXCLUDED.last_finished_at,
    updated_at = now();
END;
$$;

-- 4) Server-side authoritative finalization
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

  SELECT COUNT(*)::INTEGER
  INTO v_total_questions
  FROM public.questions q
  WHERE q.simulado_id = v_attempt.simulado_id;

  SELECT COUNT(*)::INTEGER
  INTO v_total_answered
  FROM public.answers a
  WHERE a.attempt_id = v_attempt.id
    AND a.selected_option_id IS NOT NULL;

  SELECT COUNT(*)::INTEGER
  INTO v_total_correct
  FROM public.answers a
  JOIN public.question_options qo
    ON qo.id = a.selected_option_id
   AND qo.is_correct = true
  WHERE a.attempt_id = v_attempt.id;

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

  RETURN QUERY
  SELECT v_score, v_total_correct, v_total_answered, v_total_questions;
END;
$$;

-- 5) Read functions for dashboard/performance screens
CREATE OR REPLACE FUNCTION public.get_user_performance_summary(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  user_id uuid,
  total_attempts integer,
  avg_score numeric,
  best_score numeric,
  last_score numeric,
  last_simulado_id uuid,
  last_finished_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ups.user_id,
    ups.total_attempts,
    ups.avg_score,
    ups.best_score,
    ups.last_score,
    ups.last_simulado_id,
    ups.last_finished_at
  FROM public.user_performance_summary ups
  WHERE ups.user_id = p_user_id
    AND p_user_id = auth.uid()
$$;

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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
  WHERE uph.user_id = p_user_id
    AND p_user_id = auth.uid()
  ORDER BY uph.finished_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
$$;