-- Align the F0 edition catalog with the application's authenticated-only reads.
-- Preserve authenticated/service grants, write policies and the INVOKER RPC body.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
REVOKE ALL ON TABLE public.exam_editions FROM PUBLIC,anon;
GRANT SELECT ON TABLE public.exam_editions TO authenticated;
DROP POLICY IF EXISTS exam_editions_read ON public.exam_editions;
CREATE POLICY exam_editions_read ON public.exam_editions FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE EXECUTE ON FUNCTION public.get_exam_editions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_exam_editions() TO authenticated;
COMMIT;

-- Manual rollback ONLY with explicit approval of the anonymous-read regression.
-- Exact previous F0/F1 read surface; PUBLIC remains denied. Do not restore F0
-- authenticated INSERT/UPDATE/DELETE grants removed by the F1 admin migration.
-- BEGIN;
-- DROP POLICY exam_editions_read ON public.exam_editions;
-- CREATE POLICY exam_editions_read ON public.exam_editions FOR SELECT TO anon,authenticated USING (true);
-- GRANT SELECT ON TABLE public.exam_editions TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_exam_editions() TO anon;
-- COMMIT;
