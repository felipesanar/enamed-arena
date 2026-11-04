-- D-11 / A-09: preserve attempts, answers and performance when removing content.
-- Local migration only. Deployment/application requires explicit approval.
BEGIN;

ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_simulado_id_fkey;
ALTER TABLE public.attempts ADD CONSTRAINT attempts_simulado_id_fkey
  FOREIGN KEY (simulado_id) REFERENCES public.simulados(id) ON DELETE RESTRICT;

ALTER TABLE public.user_performance_history DROP CONSTRAINT IF EXISTS user_performance_history_simulado_id_fkey;
ALTER TABLE public.user_performance_history ADD CONSTRAINT user_performance_history_simulado_id_fkey
  FOREIGN KEY (simulado_id) REFERENCES public.simulados(id) ON DELETE RESTRICT;

ALTER TABLE public.answers DROP CONSTRAINT IF EXISTS answers_question_id_fkey;
ALTER TABLE public.answers ADD CONSTRAINT answers_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE RESTRICT;

-- attempt_question_results has no simulado_id. Its existing question_id RESTRICT
-- and attempt_id -> attempts -> simulados path remain untouched.

-- A content editor may not have SELECT over all attempts. Never use an RLS-filtered
-- zero as evidence that destructive actions are safe. Gate this aggregate by JWT
-- identity and content.manage, not by user-editable profile metadata.
CREATE OR REPLACE FUNCTION public.admin_simulado_attempt_counts(p_simulado_id uuid DEFAULT NULL)
RETURNS TABLE (simulado_id uuid, attempts_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_capability('content.manage') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Permissão de gerenciamento de conteúdo necessária.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT s.id, count(a.id)
    FROM public.simulados s
    LEFT JOIN public.attempts a ON a.simulado_id = s.id
    WHERE p_simulado_id IS NULL OR s.id = p_simulado_id
    GROUP BY s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_simulado_attempt_counts(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_simulado_attempt_counts(uuid) TO authenticated;
-- No new table grants; all existing RLS policies stay in force.

COMMIT;

-- Rollback (manual and intentionally unsafe for history; obtain approval first):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.admin_simulado_attempt_counts(uuid);
-- ALTER TABLE public.attempts DROP CONSTRAINT attempts_simulado_id_fkey;
-- ALTER TABLE public.attempts ADD CONSTRAINT attempts_simulado_id_fkey
--   FOREIGN KEY (simulado_id) REFERENCES public.simulados(id) ON DELETE CASCADE;
-- ALTER TABLE public.user_performance_history DROP CONSTRAINT user_performance_history_simulado_id_fkey;
-- ALTER TABLE public.user_performance_history ADD CONSTRAINT user_performance_history_simulado_id_fkey
--   FOREIGN KEY (simulado_id) REFERENCES public.simulados(id) ON DELETE CASCADE;
-- ALTER TABLE public.answers DROP CONSTRAINT answers_question_id_fkey;
-- ALTER TABLE public.answers ADD CONSTRAINT answers_question_id_fkey
--   FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
-- COMMIT;
