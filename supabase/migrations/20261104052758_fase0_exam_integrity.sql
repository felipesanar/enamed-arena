-- T2: production definitions from production-context.json, captured
-- 2026-11-04T05:19:30Z. No remote SQL was executed for this migration.
-- Frontend prerequisite checked with a multiline git grep of src/: no
-- .from('attempts').insert/upsert; creation uses the three guarded RPCs.
-- Finalization/reprocessing read answers and write attempt_question_results,
-- not answers. Offline/presencial submit DO write answers under DEFINER.
BEGIN;

-- The function definitions below make rollback self-contained, but the source
-- metadata did not include function ACLs. Capture only privileges this migration
-- revokes, before changing them, rather than inventing previous EXECUTE grants.
-- No user data or credentials; retain the first capture on migration reapplication.
CREATE TABLE IF NOT EXISTS public._fase0_exam_integrity_rollback_acl (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  grant_statements text[] NOT NULL
);
ALTER TABLE public._fase0_exam_integrity_rollback_acl ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._fase0_exam_integrity_rollback_acl FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE public._fase0_exam_integrity_rollback_acl IS
  'Private pre-T2 privilege checkpoint for the commented rollback in 20261104052758_fase0_exam_integrity.sql. Keep until rollback is no longer needed.';

INSERT INTO public._fase0_exam_integrity_rollback_acl(singleton, grant_statements)
SELECT true, COALESCE(array_agg(g.statement ORDER BY g.statement), ARRAY[]::text[])
FROM (
  SELECT format('GRANT INSERT ON TABLE public.attempts TO %s%s;',
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
                ELSE quote_ident(pg_get_userbyid(acl.grantee)) END,
           CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) AS statement
  FROM pg_catalog.pg_class c
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
  WHERE c.oid = 'public.attempts'::regclass
    AND acl.privilege_type = 'INSERT'
    AND (acl.grantee = 0 OR acl.grantee IN (
      SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon', 'authenticated')))
  UNION ALL
  SELECT format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO %s%s;',
           p.proname, pg_catalog.oidvectortypes(p.proargtypes),
           CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
                ELSE quote_ident(pg_get_userbyid(acl.grantee)) END,
           CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
  FROM pg_catalog.pg_proc p
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
  WHERE p.oid IN ('public.prevent_direct_attempts_update()'::regprocedure,
                  'public.get_attempt_question_results(uuid)'::regprocedure,
                  'public.get_ranking_for_simulado(uuid)'::regprocedure)
    AND acl.privilege_type = 'EXECUTE'
    AND (acl.grantee = 0 OR acl.grantee IN (
      SELECT r.oid FROM pg_catalog.pg_roles r
      WHERE r.rolname IN ('anon', 'authenticated', 'service_role')))
) g
WHERE true
ON CONFLICT (singleton) DO NOTHING;

DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
REVOKE INSERT ON TABLE public.attempts FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.prevent_direct_attempts_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  -- Only the effective SQL role is trustworthy here. session_user may be
  -- postgres even after SET ROLE authenticated; JWT settings are not SQL roles.
  -- INVOKER preserves current_user=owner for a nested SECURITY DEFINER RPC.
  IF current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    -- R-04: the 30-second save grace does not extend recorded exam duration.
    -- Do not rewrite existing historical timestamps on unrelated updates.
    IF NEW.attempt_type = 'online' AND NEW.finished_at IS NOT NULL
       AND NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
      NEW.finished_at := LEAST(NEW.finished_at, NEW.effective_deadline);
    END IF;
    RETURN NEW;
  END IF;

  -- caderno_id proves supervised eligibility; created_at anchors legacy cutoffs.
  -- Legitimate set_attempt_caderno_guarded updates use the elevated branch above.
  IF ROW(NEW.score_percentage, NEW.total_correct, NEW.total_answered,
         NEW.finished_at, NEW.is_within_window, NEW.status, NEW.user_id,
         NEW.simulado_id, NEW.effective_deadline, NEW.started_at, NEW.attempt_type,
         NEW.id, NEW.caderno_id, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.score_percentage, OLD.total_correct, OLD.total_answered,
         OLD.finished_at, OLD.is_within_window, OLD.status, OLD.user_id,
         OLD.simulado_id, OLD.effective_deadline, OLD.started_at, OLD.attempt_type,
         OLD.id, OLD.caderno_id, OLD.created_at) THEN
    RAISE EXCEPTION 'attempts protected fields are read-only for clients (use guarded RPCs)'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_direct_attempts_update() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_prevent_direct_attempts_update ON public.attempts;
CREATE TRIGGER trg_prevent_direct_attempts_update
BEFORE UPDATE ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_attempts_update();

CREATE OR REPLACE FUNCTION public.enforce_answer_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_elevated boolean := current_user IN
    ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
       OR NEW.question_id IS DISTINCT FROM OLD.question_id THEN
      RAISE EXCEPTION 'answer attempt_id and question_id are immutable'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Same parent lock as finalize_attempt_with_results_for_user. A save waiting
  -- behind finalization sees the finalized row and cannot change the grade.
  SELECT a.* INTO v_attempt
  FROM public.attempts a WHERE a.id = NEW.attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'answer attempt not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_elevated AND (auth.uid() IS NULL OR v_attempt.user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'answer attempt is not owned by current user' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = NEW.question_id AND q.simulado_id = v_attempt.simulado_id
  ) THEN
    RAISE EXCEPTION 'answer question does not belong to attempt simulado'
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.selected_option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.question_options qo
    WHERE qo.id = NEW.selected_option_id AND qo.question_id = NEW.question_id
  ) THEN
    RAISE EXCEPTION 'answer option does not belong to question' USING ERRCODE = 'P0001';
  END IF;

  IF v_attempt.attempt_type IN ('offline', 'presencial') THEN
    -- Pending offline/presencial attempts intentionally have a different
    -- status and can be transcribed after the online deadline. Only existing
    -- guarded DEFINER RPCs (or trusted service SQL roles) may write these.
    IF NOT v_elevated THEN
      RAISE EXCEPTION 'offline and presencial answers require a guarded RPC'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_attempt.attempt_type = 'online' THEN
    IF v_attempt.status IS DISTINCT FROM 'in_progress'::public.attempt_status THEN
      RAISE EXCEPTION 'online attempt is not in progress' USING ERRCODE = 'P0001';
    END IF;
    IF v_attempt.effective_deadline IS NULL
       OR now() > v_attempt.effective_deadline + interval '30 seconds' THEN
      RAISE EXCEPTION 'online attempt deadline exceeded' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported attempt type' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_answer_integrity() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_enforce_answer_integrity ON public.answers;
CREATE TRIGGER trg_enforce_answer_integrity
BEFORE INSERT OR UPDATE ON public.answers
FOR EACH ROW EXECUTE FUNCTION public.enforce_answer_integrity();

DROP POLICY IF EXISTS "Users can read own attempt question results" ON public.attempt_question_results;
CREATE POLICY "Users can read own attempt question results"
ON public.attempt_question_results FOR SELECT TO authenticated
USING (
  public.has_capability('results.view')
  OR EXISTS (
    SELECT 1 FROM public.attempts a
    JOIN public.simulados s ON s.id = a.simulado_id
    WHERE a.id = attempt_question_results.attempt_id
      AND a.user_id = (SELECT auth.uid())
      AND s.results_release_at <= now()
  )
);

CREATE OR REPLACE FUNCTION public.get_attempt_question_results(p_attempt_id uuid)
RETURNS TABLE(question_id uuid, selected_option_id uuid, correct_option_id uuid,
              is_correct boolean, was_answered boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT aqr.question_id, aqr.selected_option_id, aqr.correct_option_id,
         aqr.is_correct, aqr.was_answered
  FROM public.attempt_question_results aqr
  JOIN public.attempts a ON a.id = aqr.attempt_id
  JOIN public.simulados s ON s.id = a.simulado_id
  WHERE aqr.attempt_id = p_attempt_id
    AND auth.uid() IS NOT NULL
    AND (public.has_capability('results.view')
         OR (a.user_id = auth.uid() AND s.results_release_at <= now()))
$function$;

REVOKE ALL ON FUNCTION public.get_attempt_question_results(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_attempt_question_results(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric,
  total_correct integer, total_answered integer, finished_at timestamptz,
  full_name text, segment public.user_segment, especialidade text,
  instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  WITH best AS (
    SELECT DISTINCT ON (a.user_id)
      a.id, a.user_id, a.simulado_id, a.score_percentage, a.total_correct,
      a.total_answered, a.finished_at
    FROM public.attempts a
    JOIN public.simulados s ON s.id = a.simulado_id
    WHERE a.simulado_id = p_simulado_id
      AND auth.uid() IS NOT NULL
      AND s.results_release_at <= now()
      AND a.status IN ('submitted', 'expired')
      AND a.score_percentage IS NOT NULL
      AND a.is_within_window = true
    -- Same choice as admin (20260624212300): best score, earliest finish.
    -- The immutable ID resolves otherwise identical attempts deterministically.
    ORDER BY a.user_id, a.score_percentage DESC NULLS LAST,
             a.finished_at ASC NULLS LAST, a.id
  )
  SELECT b.user_id, b.simulado_id, b.score_percentage AS nota_final,
    b.total_correct, b.total_answered, b.finished_at, p.full_name, p.segment,
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN public.enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY b.score_percentage DESC NULLS LAST,
               b.finished_at ASC NULLS LAST, b.user_id
    ) AS posicao,
    COUNT(*) OVER () AS total_candidatos
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.onboarding_profiles op ON op.user_id = b.user_id
  LEFT JOIN public.enamed_specialties es ON es.id = op.specialty_id
  ORDER BY b.score_percentage DESC NULLS LAST,
           b.finished_at ASC NULLS LAST, b.user_id
$function$;

REVOKE ALL ON FUNCTION public.get_ranking_for_simulado(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ranking_for_simulado(uuid) TO authenticated;

COMMIT;

-- ROLLBACK (manual, security regression; never run automatically):
-- All previous function definitions and policies are included here. ACLs are
-- captured by the migration itself in the private checkpoint above, not in an
-- external attachment. Run the entire uncommented transaction as the migration
-- owner on the same database; a missing checkpoint aborts rather than guessing.
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_enforce_answer_integrity ON public.answers;
-- DROP FUNCTION IF EXISTS public.enforce_answer_integrity();
-- DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
-- CREATE POLICY "Users can insert own attempts" ON public.attempts
--   FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
-- DROP POLICY IF EXISTS "Users can read own attempt question results" ON public.attempt_question_results;
-- CREATE POLICY "Users can read own attempt question results"
-- ON public.attempt_question_results FOR SELECT TO authenticated USING (
--   EXISTS (SELECT 1 FROM public.attempts a
--           WHERE a.id = attempt_question_results.attempt_id AND a.user_id = (SELECT auth.uid())));
-- CREATE OR REPLACE FUNCTION public.prevent_direct_attempts_update()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
-- AS $rollback$
-- DECLARE v_is_elevated boolean;
-- BEGIN
--   v_is_elevated := (
--     current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
--     OR session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
--     OR current_setting('request.jwt.claim.role', true) = 'service_role'
--   );
--   IF v_is_elevated THEN RETURN NEW; END IF;
--   IF NEW.score_percentage IS DISTINCT FROM OLD.score_percentage THEN
--     RAISE EXCEPTION 'attempts.score_percentage is read-only for clients (use finalize_attempt_with_results)' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.total_correct IS DISTINCT FROM OLD.total_correct THEN
--     RAISE EXCEPTION 'attempts.total_correct is read-only for clients' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.total_answered IS DISTINCT FROM OLD.total_answered THEN
--     RAISE EXCEPTION 'attempts.total_answered is read-only for clients' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
--     RAISE EXCEPTION 'attempts.finished_at is read-only for clients' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.is_within_window IS DISTINCT FROM OLD.is_within_window THEN
--     RAISE EXCEPTION 'attempts.is_within_window is read-only for clients' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.status IS DISTINCT FROM OLD.status THEN
--     RAISE EXCEPTION 'attempts.status must be changed via finalize RPC' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
--     RAISE EXCEPTION 'attempts.user_id is immutable' USING ERRCODE = 'P0001';
--   END IF;
--   IF NEW.simulado_id IS DISTINCT FROM OLD.simulado_id THEN
--     RAISE EXCEPTION 'attempts.simulado_id is immutable' USING ERRCODE = 'P0001';
--   END IF;
--   RETURN NEW;
-- END;
-- $rollback$;
-- CREATE OR REPLACE FUNCTION public.get_attempt_question_results(p_attempt_id uuid)
-- RETURNS TABLE(question_id uuid, selected_option_id uuid, correct_option_id uuid,
--               is_correct boolean, was_answered boolean)
-- LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
-- AS $rollback$
--   SELECT aqr.question_id, aqr.selected_option_id, aqr.correct_option_id,
--          aqr.is_correct, aqr.was_answered
--   FROM public.attempt_question_results aqr
--   JOIN public.attempts a ON a.id = aqr.attempt_id
--   WHERE aqr.attempt_id = p_attempt_id AND a.user_id = auth.uid()
-- $rollback$;
-- CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
-- RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric,
--   total_correct integer, total_answered integer, finished_at timestamptz,
--   full_name text, segment public.user_segment, especialidade text,
--   instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $rollback$
--   SELECT a.user_id, a.simulado_id, a.score_percentage AS nota_final,
--     a.total_correct, a.total_answered, a.finished_at, p.full_name, p.segment,
--     COALESCE(es.name, op.specialty) AS especialidade,
--     COALESCE(
--       (SELECT array_agg(ei.name ORDER BY t.ord)
--        FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
--        JOIN public.enamed_institutions ei ON ei.id = t.id),
--       op.target_institutions
--     ) AS instituicoes_alvo,
--     ROW_NUMBER() OVER (ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST),
--     COUNT(*) OVER ()
--   FROM public.attempts a
--   JOIN public.profiles p ON p.id = a.user_id
--   LEFT JOIN public.onboarding_profiles op ON op.user_id = a.user_id
--   LEFT JOIN public.enamed_specialties es ON es.id = op.specialty_id
--   WHERE a.simulado_id = p_simulado_id AND a.status IN ('submitted', 'expired')
--     AND a.score_percentage IS NOT NULL AND a.is_within_window = true
--   ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
-- $rollback$;
-- REVOKE INSERT ON TABLE public.attempts FROM PUBLIC, anon, authenticated;
-- REVOKE ALL ON FUNCTION public.prevent_direct_attempts_update() FROM PUBLIC, anon, authenticated, service_role;
-- REVOKE ALL ON FUNCTION public.get_attempt_question_results(uuid) FROM PUBLIC, anon, authenticated, service_role;
-- REVOKE ALL ON FUNCTION public.get_ranking_for_simulado(uuid) FROM PUBLIC, anon, authenticated, service_role;
-- DO $restore_acl$
-- DECLARE
--   v_grants text[];
--   v_statement text;
-- BEGIN
--   SELECT grant_statements INTO STRICT v_grants
--   FROM public._fase0_exam_integrity_rollback_acl WHERE singleton;
--   FOREACH v_statement IN ARRAY v_grants LOOP
--     EXECUTE v_statement;
--   END LOOP;
-- END;
-- $restore_acl$;
-- DROP TABLE public._fase0_exam_integrity_rollback_acl;
-- COMMIT;
