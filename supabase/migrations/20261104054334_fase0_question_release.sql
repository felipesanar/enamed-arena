-- S-06: public exam payload and released correction have separate access paths.
BEGIN;

-- Column REVOKE alone cannot override an existing table SELECT grant.
REVOKE SELECT ON public.questions, public.question_options FROM PUBLIC, anon, authenticated;
REVOKE SELECT (explanation, explanation_image_url) ON public.questions FROM PUBLIC, anon, authenticated;
REVOKE SELECT (is_correct) ON public.question_options FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, simulado_id, question_number, text, area, theme, difficulty,
  image_url, image_url_2, created_at) ON public.questions TO authenticated;
GRANT SELECT (id, question_id, label, text, created_at) ON public.question_options TO authenticated;
-- Server jobs keep full access. An admin JWT still uses role authenticated and
-- must use admin_get_simulado_questions for restricted columns.
GRANT SELECT ON public.questions, public.question_options TO service_role;

DROP POLICY IF EXISTS "Anyone can read questions" ON public.questions;
DROP POLICY IF EXISTS "fase0_questions_release" ON public.questions;
CREATE POLICY "fase0_questions_release" ON public.questions
  FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      (SELECT public.has_capability('content.manage'))
      OR EXISTS (
        SELECT 1 FROM public.simulados s WHERE s.id = questions.simulado_id
          AND s.status IN ('published', 'test')
          AND s.execution_window_start <= now()
      )
    )
  );

DROP POLICY IF EXISTS "Anyone can read options" ON public.question_options;
DROP POLICY IF EXISTS "Authenticated can read options from published simulados" ON public.question_options;
DROP POLICY IF EXISTS "Authenticated can read options from published or test simulados" ON public.question_options;
DROP POLICY IF EXISTS "fase0_options_release" ON public.question_options;
-- One-way dependency: options -> questions -> simulados (no recursion).
CREATE POLICY "fase0_options_release" ON public.question_options
  FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.questions q WHERE q.id = question_options.question_id
    )
  );

CREATE OR REPLACE FUNCTION public.get_question_explanations(p_simulado_id uuid)
RETURNS TABLE(question_id uuid, explanation text, explanation_image_url text, correct_option_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF public.has_capability('content.manage') IS DISTINCT FROM true AND NOT EXISTS (
    SELECT 1 FROM public.simulados s
    WHERE s.id = p_simulado_id
      AND s.status IN ('published', 'test')
      AND s.execution_window_start <= now()
      AND s.results_release_at <= now()
      AND EXISTS (
        SELECT 1 FROM public.attempts a
        WHERE a.simulado_id = s.id AND a.user_id = v_user_id
          AND a.status IN ('submitted', 'expired') AND a.finished_at IS NOT NULL
      )
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT q.id, q.explanation, q.explanation_image_url,
      (SELECT o.id FROM public.question_options o
       WHERE o.question_id = q.id AND o.is_correct ORDER BY o.id LIMIT 1)
    FROM public.questions q WHERE q.simulado_id = p_simulado_id
    ORDER BY q.question_number;
END;
$$;
REVOKE ALL ON FUNCTION public.get_question_explanations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_explanations(uuid) TO authenticated, service_role;

COMMIT;

-- Rollback (manual, security regression; coordinate with frontend rollback):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.get_question_explanations(uuid);
-- DROP POLICY IF EXISTS "fase0_options_release" ON public.question_options;
-- DROP POLICY IF EXISTS "fase0_questions_release" ON public.questions;
-- CREATE POLICY "Anyone can read questions" ON public.questions FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated can read options from published or test simulados"
-- ON public.question_options FOR SELECT TO authenticated USING (EXISTS (
--   SELECT 1 FROM public.questions q JOIN public.simulados s ON s.id = q.simulado_id
--   WHERE q.id = question_options.question_id AND s.status IN ('published', 'test')));
-- GRANT SELECT ON public.questions, public.question_options TO anon, authenticated;
-- COMMIT;
