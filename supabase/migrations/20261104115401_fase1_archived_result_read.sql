-- Forward-only read repair on the F0 + F1 + F2 catalog (not pre-F0 snapshots).
-- No learner data, column grants, write RPCs or edition flags are modified.
DO $migration$
DECLARE
 r record; f regprocedure; ddl text; original text; replacement text; n integer;
BEGIN
 CREATE SCHEMA IF NOT EXISTS archived_read_private;
 REVOKE ALL ON SCHEMA archived_read_private FROM PUBLIC,anon,authenticated,service_role;
 CREATE TABLE IF NOT EXISTS archived_read_private.checkpoints (
  object_key text PRIMARY KEY, kind text NOT NULL, original_definition text NOT NULL,
  applied_definition text, applied boolean NOT NULL DEFAULT false
 );
 ALTER TABLE archived_read_private.checkpoints ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON archived_read_private.checkpoints FROM PUBLIC,anon,authenticated,service_role;

 -- Same signatures + CREATE OR REPLACE retain owners/ACLs/security modes and
 -- all existing PRO guards. Reapply skips applied entries, including later edits.
 FOR r IN SELECT unnest(ARRAY[
  'public.get_question_explanations(uuid)',
  'public.get_area_score_history(uuid,uuid)',
  'public.get_user_attempt_behavior_stats(uuid,uuid)',
  'public.get_caderno_pattern_data(uuid,uuid)',
  'public.get_confidence_calibration(uuid,uuid)',
  'public.get_ranking_for_simulado(uuid)']) AS signature LOOP
  IF EXISTS(SELECT FROM archived_read_private.checkpoints WHERE object_key=r.signature AND applied) THEN
   CONTINUE;
  END IF;
  f:=to_regprocedure(r.signature);
  IF f IS NULL THEN RAISE EXCEPTION 'Apply current F2 analytics first: %',r.signature; END IF;
  ddl:=pg_get_functiondef(f);
  INSERT INTO archived_read_private.checkpoints(object_key,kind,original_definition)
   VALUES(r.signature,'function',ddl) ON CONFLICT DO NOTHING;
  IF ddl IS DISTINCT FROM (SELECT original_definition FROM archived_read_private.checkpoints WHERE object_key=r.signature) THEN
   RAISE EXCEPTION 'Source changed since rollback; review checkpoint: %',r.signature;
  END IF;
  IF r.signature='public.get_question_explanations(uuid)' THEN
   original:='s.status IN (''published'', ''test'')';
   replacement:='s.status IN (''published'', ''test'', ''archived'')';
  ELSIF r.signature='public.get_ranking_for_simulado(uuid)' THEN
   original:='s.status=''published''';
   replacement:=$gate$(s.status='published' OR (s.status='archived' AND EXISTS (
    SELECT 1 FROM public.attempts caller_attempt
    WHERE caller_attempt.simulado_id=s.id AND caller_attempt.user_id=auth.uid()
     AND caller_attempt.status IN ('submitted','expired') AND caller_attempt.finished_at IS NOT NULL)))
    AND s.execution_window_start<=now()$gate$;
  ELSE
   -- The existing attempt scopes already require a finalized own attempt.
   -- Notebook scopes also need that condition: a cached notebook row alone
   -- cannot authorize archived content. Manual cumulative entries stay intact.
   original:='scope_s.status=''published''';
   replacement:=$gate$(scope_s.status='published' OR (scope_s.status='archived' AND EXISTS (
    SELECT 1 FROM public.attempts caller_attempt
    WHERE caller_attempt.simulado_id=scope_s.id AND caller_attempt.user_id=auth.uid()
     AND caller_attempt.status IN ('submitted','expired') AND caller_attempt.finished_at IS NOT NULL)))
    AND scope_s.execution_window_start<=now()$gate$;
   IF position('p_edition_id' IN ddl)=0 OR position('p_user_id' IN ddl)=0 THEN
    RAISE EXCEPTION 'Unexpected non-F2 analytics definition: %',r.signature;
   END IF;
  END IF;
  n:=(length(ddl)-length(replace(ddl,original,'')))/length(original);
  IF n<>(CASE r.signature WHEN 'public.get_area_score_history(uuid,uuid)' THEN 2
   WHEN 'public.get_caderno_pattern_data(uuid,uuid)' THEN 8 ELSE 1 END) THEN
   RAISE EXCEPTION 'Unrecognized read source (% occurrences): %',n,r.signature;
  END IF;
  ddl:=replace(ddl,original,replacement);
  EXECUTE ddl;
  UPDATE archived_read_private.checkpoints SET applied=true,
   applied_definition=pg_get_functiondef(f) WHERE object_key=r.signature;
 END LOOP;

 FOR r IN SELECT * FROM (VALUES
  ('questions','fase0_questions_release'),
  ('attempt_question_results','Users can read own attempt question results')) v(tab,pol) LOOP
  IF EXISTS(SELECT FROM archived_read_private.checkpoints WHERE object_key=r.tab AND applied) THEN
   CONTINUE;
  END IF;
  SELECT format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
   policyname,tablename,qual) INTO original FROM pg_policies
   WHERE schemaname='public' AND tablename=r.tab AND policyname=r.pol
    AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[];
  IF original IS NULL THEN RAISE EXCEPTION 'Unexpected source policy: %',r.pol; END IF;
  INSERT INTO archived_read_private.checkpoints(object_key,kind,original_definition)
   VALUES(r.tab,'policy',original) ON CONFLICT DO NOTHING;
  IF original IS DISTINCT FROM (SELECT original_definition FROM archived_read_private.checkpoints WHERE object_key=r.tab) THEN
   RAISE EXCEPTION 'Policy changed since rollback: %',r.pol;
  END IF;
  IF r.tab='questions' THEN
   ddl:=$policy$CREATE POLICY fase0_questions_release ON public.questions FOR SELECT TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL AND (
     (SELECT public.has_capability('content.manage')) OR EXISTS (
      SELECT 1 FROM public.simulados s WHERE s.id=questions.simulado_id
       AND s.execution_window_start<=now() AND (
        s.status IN ('published','test') OR (s.status='archived'
         AND s.results_release_at<=now() AND EXISTS (
          SELECT 1 FROM public.attempts a WHERE a.simulado_id=s.id AND a.user_id=(SELECT auth.uid())
           AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL))))))$policy$;
  ELSE
   ddl:=$policy$CREATE POLICY "Users can read own attempt question results"
    ON public.attempt_question_results FOR SELECT TO authenticated USING (
     (SELECT auth.uid()) IS NOT NULL AND (
      (SELECT public.has_capability('results.view')) OR EXISTS (
       SELECT 1 FROM public.attempts a JOIN public.simulados s ON s.id=a.simulado_id
       WHERE a.id=attempt_question_results.attempt_id AND a.user_id=(SELECT auth.uid())
        AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL
        AND s.status IN ('published','test','archived')
        AND s.execution_window_start<=now() AND s.results_release_at<=now())))$policy$;
  END IF;
  EXECUTE format('DROP POLICY %I ON public.%I',r.pol,r.tab);
  EXECUTE ddl;
  UPDATE archived_read_private.checkpoints SET applied=true,applied_definition=(
   SELECT format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',policyname,tablename,qual)
   FROM pg_policies WHERE schemaname='public' AND tablename=r.tab AND policyname=r.pol
    AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[])
   WHERE object_key=r.tab;
 END LOOP;
 -- Options deliberately unchanged: options -> questions -> simulados/attempts.
 -- No reverse dependency or helper with a caller-controlled owner is introduced.
END
$migration$;

-- Manual rollback ONLY in a privileged maintenance transaction. First compare
-- current definitions to applied_definition for every entry (example in docs).
-- Abort on later edits: do not erase a subsequent security fix/checkpoint.
-- BEGIN;
-- DO $rollback$
-- DECLARE r record; current_ddl text; pol text;
-- BEGIN
--  FOR r IN SELECT * FROM archived_read_private.checkpoints WHERE applied LOOP
--   IF r.kind='function' THEN
--    current_ddl:=pg_get_functiondef(to_regprocedure(r.object_key));
--   ELSE
--    pol:=CASE r.object_key WHEN 'questions' THEN 'fase0_questions_release'
--     ELSE 'Users can read own attempt question results' END;
--    SELECT format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',policyname,tablename,qual)
--     INTO current_ddl FROM pg_policies WHERE schemaname='public' AND tablename=r.object_key AND policyname=pol
--      AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[];
--   END IF;
--   IF current_ddl IS DISTINCT FROM r.applied_definition THEN
--    RAISE EXCEPTION 'Later changes require manual merge: %',r.object_key;
--   END IF;
--  END LOOP;
--  FOR r IN SELECT * FROM archived_read_private.checkpoints WHERE applied LOOP
--   IF r.kind='policy' THEN
--    pol:=CASE r.object_key WHEN 'questions' THEN 'fase0_questions_release'
--     ELSE 'Users can read own attempt question results' END;
--    EXECUTE format('DROP POLICY %I ON public.%I',pol,r.object_key);
--   END IF;
--   EXECUTE r.original_definition;
--   UPDATE archived_read_private.checkpoints SET applied=false WHERE object_key=r.object_key;
--  END LOOP;
-- END
-- $rollback$;
-- COMMIT;
-- Restores F0/F1/F2 read definitions, never restores pre-F0 column grants.
-- No DROP SCHEMA/CASCADE, no learner data changes; checkpoints remain for reapply.
