-- F1-7: read-only edition scope. Source: sanitized production-schema.json,
-- F0 exam integrity ranking, and F1 edition model/target (2026-11-04).
BEGIN;

-- Inspected pg_depend on the target clone: no incoming dependencies for these
-- old signatures. RESTRICT (the default), never CASCADE: unexpected dependencies
-- abort the transaction instead of deleting their objects. Remove old defaults
-- with their signatures so PostgREST sees exactly one candidate per RPC.
DROP FUNCTION IF EXISTS public.get_user_performance_summary(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.get_user_performance_history(uuid,integer) RESTRICT;

CREATE OR REPLACE FUNCTION public.get_user_performance_history(
 p_user_id uuid DEFAULT auth.uid(),
 p_limit integer DEFAULT NULL,
 p_edition_id uuid DEFAULT NULL,
 p_include_training boolean DEFAULT true,
 p_offset integer DEFAULT 0
)
RETURNS TABLE(attempt_id uuid, simulado_id uuid, score_percentage numeric,
 total_correct integer, total_answered integer, total_questions integer,
 finished_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
 WITH best AS (
   -- Choose from attempts BEFORE joining history: a missing cached row must
   -- not silently substitute a worse attempt than the one selected by F0.
   SELECT DISTINCT ON (a.user_id,a.simulado_id)
     a.id,a.user_id,a.simulado_id
   FROM public.attempts a
   JOIN public.simulados s ON s.id=a.simulado_id
   WHERE p_user_id=auth.uid() AND a.user_id=p_user_id
     AND (p_edition_id IS NOT NULL OR NOT coalesce(p_include_training,true))
     AND (p_edition_id IS NULL OR s.edition_id=p_edition_id)
     AND s.results_release_at<=now()
     AND a.status IN ('submitted','expired')
     AND a.score_percentage IS NOT NULL
     AND (coalesce(p_include_training,true) OR a.is_within_window=true)
   ORDER BY a.user_id,a.simulado_id,a.score_percentage DESC NULLS LAST,
     a.finished_at ASC NULLS LAST,a.id
 ), released AS (
   -- Preserve legacy row semantics (including training and duplicate modes).
   SELECT h.attempt_id,h.simulado_id,h.score_percentage,h.total_correct,
     h.total_answered,h.total_questions,h.finished_at
   FROM public.user_performance_history h
   JOIN public.simulados s ON s.id=h.simulado_id
   WHERE p_user_id=auth.uid() AND h.user_id=p_user_id
     AND p_edition_id IS NULL AND coalesce(p_include_training,true)
     AND s.results_release_at<=now()
   UNION ALL
   SELECT h.attempt_id,h.simulado_id,h.score_percentage,h.total_correct,
     h.total_answered,h.total_questions,h.finished_at
   FROM best b
   JOIN public.user_performance_history h
     ON h.attempt_id=b.id AND h.user_id=b.user_id AND h.simulado_id=b.simulado_id
   WHERE p_user_id=auth.uid() AND h.user_id=p_user_id
 )
 SELECT r.attempt_id,r.simulado_id,r.score_percentage,r.total_correct,
   r.total_answered,r.total_questions,r.finished_at
 FROM released r
 ORDER BY r.finished_at DESC,r.simulado_id DESC,r.attempt_id DESC
 -- Keep the historical clamp for explicit nonpositive limits; NULL is unbounded.
 LIMIT CASE WHEN p_limit IS NULL THEN NULL ELSE greatest(p_limit,1) END
 OFFSET greatest(coalesce(p_offset,0),0)
$function$;

CREATE OR REPLACE FUNCTION public.get_user_performance_summary(
 p_user_id uuid DEFAULT auth.uid(),
 p_edition_id uuid DEFAULT NULL,
 p_include_training boolean DEFAULT true
)
RETURNS TABLE(user_id uuid,total_attempts integer,avg_score numeric,
 best_score numeric,last_score numeric,last_simulado_id uuid,
 last_finished_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
 WITH released AS (
   SELECT h.* FROM public.get_user_performance_history(
     p_user_id=>p_user_id,p_limit=>NULL,p_edition_id=>p_edition_id,
     p_include_training=>p_include_training,p_offset=>0) h
   WHERE p_user_id=auth.uid()
 ), last_released AS (
   SELECT r.simulado_id,r.score_percentage,r.finished_at
   FROM released r
   ORDER BY r.finished_at DESC,r.simulado_id DESC,r.attempt_id DESC LIMIT 1
 )
 SELECT p_user_id,count(*)::integer,coalesce(round(avg(r.score_percentage),2),0),
   coalesce(max(r.score_percentage),0),coalesce(l.score_percentage,0),
   l.simulado_id,l.finished_at
 FROM released r LEFT JOIN last_released l ON true
 GROUP BY l.simulado_id,l.score_percentage,l.finished_at
 HAVING count(*)>0
$function$;

-- Preserve the actual production ACL explicitly, including PUBLIC/anon execute.
-- Execution is not data access: invoker RLS + auth.uid ownership remain required.
ALTER FUNCTION public.get_user_performance_history(uuid,integer,uuid,boolean,integer) OWNER TO postgres;
ALTER FUNCTION public.get_user_performance_summary(uuid,uuid,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_user_performance_history(uuid,integer,uuid,boolean,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_user_performance_summary(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_user_performance_history(uuid,integer,uuid,boolean,integer) TO PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_user_performance_summary(uuid,uuid,boolean) TO PUBLIC,anon,authenticated,service_role;
COMMIT;

-- Manual rollback (coordinate clients first; never CASCADE):
-- BEGIN;
-- DROP FUNCTION public.get_user_performance_summary(uuid,uuid,boolean) RESTRICT;
-- DROP FUNCTION public.get_user_performance_history(uuid,integer,uuid,boolean,integer) RESTRICT;
-- Restore ONLY the two read RPC definitions from
-- 20260405000000_gate_performance_by_release.sql, with OWNER TO postgres and
-- GRANT EXECUTE TO PUBLIC,anon,authenticated,service_role for both old signatures.
-- COMMIT;
-- No data rollback, finalizer execution, cache rebuild or backlog recomputation.
