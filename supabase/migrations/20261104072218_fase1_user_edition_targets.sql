-- F1-8. Requires 20261104065001_fase1_edition_model.sql AFTER all F0 migrations.
-- Sources: sanitized production-schema.json (2026-11-04) + unapplied F0.
-- No production execution or inferred dates. Reapplying preserves data/history.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.simulados'::regclass
    AND attname = 'edition_id' AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.attempts'::regclass
    AND attname = 'edition_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Apply 20261104065001_fase1_edition_model.sql first';
  END IF;
END $$;

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS target_edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS expected_graduation_term text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.onboarding_profiles'::regclass
    AND conname = 'onboarding_expected_graduation_term_valid') THEN
    ALTER TABLE public.onboarding_profiles ADD CONSTRAINT onboarding_expected_graduation_term_valid
      CHECK (expected_graduation_term IS NULL OR expected_graduation_term ~ '^[0-9]{4}\.[12]$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS onboarding_profiles_target_edition_idx ON public.onboarding_profiles(target_edition_id);

CREATE TABLE IF NOT EXISTS public.user_edition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
  expected_graduation_term text CHECK (expected_graduation_term IS NULL OR expected_graduation_term ~ '^[0-9]{4}\.[12]$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_edition_targets_user_created_idx ON public.user_edition_targets(user_id,created_at DESC);
ALTER TABLE public.user_edition_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_edition_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_edition_targets TO authenticated;
GRANT ALL ON public.user_edition_targets TO service_role;
DROP POLICY IF EXISTS user_edition_targets_read_own ON public.user_edition_targets;
CREATE POLICY user_edition_targets_read_own ON public.user_edition_targets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- All student onboarding writes are RPC-only. Production has legacy table-wide
-- DML grants AND own-row write policies; revoking two columns cannot close that
-- bypass. Revoke table privileges and any independent column write grants.
-- current_user is the actual executing DB role (DEFINER owner for guarded RPCs),
-- NOT a spoofable JWT claim or a caller-controlled session setting.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.onboarding_profiles FROM PUBLIC, anon, authenticated;
DO $$ DECLARE v_columns text; BEGIN
  SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid = 'public.onboarding_profiles'::regclass
      AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON TABLE public.onboarding_profiles FROM PUBLIC, anon, authenticated',v_columns);
END $$;
GRANT SELECT ON public.onboarding_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_profiles TO service_role;
-- Keep the existing own-row SELECT RLS policy. The invoker trigger protects ALL
-- row mutations as defense in depth even if a later migration regrants DML.
CREATE OR REPLACE FUNCTION public.guard_onboarding_edition_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.onboarding_profiles'::regclass))
    AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Use guarded onboarding RPCs' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_onboarding_edition_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS onboarding_edition_write_guard ON public.onboarding_profiles;
CREATE TRIGGER onboarding_edition_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.onboarding_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_edition_write();

-- Private, own-user-only resolver; no arbitrary user_id argument is exposed.
-- Ordering mirrors src/lib/editions.ts resolveUserEdition, including historical
-- explicit targets, Sao Paulo calendar dates, null term first and stable ties.
CREATE OR REPLACE FUNCTION public.resolve_user_edition_id(p_now timestamptz DEFAULT now())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT e.id FROM public.exam_editions e
  LEFT JOIN public.onboarding_profiles o ON o.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL AND (
    e.id = o.target_edition_id OR e.code = o.expected_graduation_term OR
    (e.status NOT IN ('closed','archived') AND (
      e.exam_date >= (p_now AT TIME ZONE 'America/Sao_Paulo')::date OR
      (e.exam_date IS NULL AND e.status IN ('preparing','active','planned')))))
  ORDER BY CASE
    WHEN e.id = o.target_edition_id THEN 0
    WHEN e.code = o.expected_graduation_term THEN 1
    WHEN e.exam_date >= (p_now AT TIME ZONE 'America/Sao_Paulo')::date THEN 2
    WHEN e.status IN ('preparing','active') THEN 3 ELSE 4 END,
    CASE WHEN e.exam_date >= (p_now AT TIME ZONE 'America/Sao_Paulo')::date
      THEN e.exam_date END NULLS LAST,
    e.year, e.term NULLS FIRST, e.code COLLATE "C", e.id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_user_edition_id(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.user_edition_window_end(p_now timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT min(s.execution_window_end) FROM public.simulados s
  WHERE s.edition_id = public.resolve_user_edition_id(p_now)
    -- Only edits of a completed academic profile lock. A pending row created
    -- by target selection (or no row yet) must still permit first completion.
    AND EXISTS (SELECT 1 FROM public.onboarding_profiles o
      WHERE o.user_id = auth.uid() AND o.status = 'completed')
    AND s.status = 'published'
    AND s.execution_window_start <= p_now AND s.execution_window_end >= p_now;
$$;
REVOKE ALL ON FUNCTION public.user_edition_window_end(timestamptz) FROM PUBLIC, anon, authenticated;

-- Keep the real signature/default; maintenance callers still need a user claim
-- to resolve a user edition. This function no longer means a global window.
CREATE OR REPLACE FUNCTION public.is_any_simulado_window_open(p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.user_edition_window_end(p_now) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.is_any_simulado_window_open(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_simulado_window_open(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_onboarding_edit_guard_state()
RETURNS TABLE(can_edit boolean, reason text, next_edit_available_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000';
  END IF;
  v_end := public.user_edition_window_end(now());
  RETURN QUERY SELECT v_end IS NULL,
    CASE WHEN v_end IS NULL THEN 'ok'::text ELSE 'edicao_bloqueada_janela_aberta'::text END, v_end;
END $$;
REVOKE ALL ON FUNCTION public.get_onboarding_edit_guard_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_edit_guard_state() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_target_edition_guarded(
  p_edition_id uuid DEFAULT NULL, p_expected_graduation_term text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_old public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_expected_graduation_term IS NOT NULL AND p_expected_graduation_term !~ '^[0-9]{4}\.[12]$' THEN
    RAISE EXCEPTION 'Semestre de conclusao invalido' USING ERRCODE = '22023';
  END IF;
  IF p_edition_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.exam_editions WHERE id = p_edition_id) THEN
    RAISE EXCEPTION 'Edicao invalida' USING ERRCODE = '22023';
  END IF;
  -- Serialize with academic saves and concurrent target calls, including first insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  SELECT * INTO v_old FROM public.onboarding_profiles WHERE user_id = v_user_id FOR UPDATE;
  INSERT INTO public.onboarding_profiles(user_id,target_edition_id,expected_graduation_term)
    VALUES(v_user_id,p_edition_id,p_expected_graduation_term)
  ON CONFLICT (user_id) DO UPDATE SET target_edition_id = EXCLUDED.target_edition_id,
    expected_graduation_term = EXCLUDED.expected_graduation_term
  WHERE onboarding_profiles.target_edition_id IS DISTINCT FROM EXCLUDED.target_edition_id
    OR onboarding_profiles.expected_graduation_term IS DISTINCT FROM EXCLUDED.expected_graduation_term;
  -- Deliberately never changes status, completion, specialty, segment or attempts.
  IF v_old.target_edition_id IS DISTINCT FROM p_edition_id
    OR v_old.expected_graduation_term IS DISTINCT FROM p_expected_graduation_term THEN
    INSERT INTO public.user_edition_targets(user_id,target_edition_id,expected_graduation_term)
      VALUES(v_user_id,p_edition_id,p_expected_graduation_term);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_target_edition_guarded(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_target_edition_guarded(uuid,text) TO authenticated, service_role;

-- Preserve both actual PostgREST signatures and their composite return type.
-- No new defaults/overloads on save: named legacy/UUID arguments stay unambiguous.
CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(p_specialty_id uuid,p_target_institution_ids uuid[])
RETURNS public.onboarding_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_specialty_name text;
  v_inst_ids uuid[];
  v_inst_names text[] := '{}';
  v_result public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  IF p_specialty_id IS NOT NULL THEN
    SELECT name INTO v_specialty_name FROM public.enamed_specialties WHERE id = p_specialty_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Especialidade invalida'; END IF;
  END IF;
  -- Stable first-occurrence dedupe; NULL/unknown IDs are still invalid.
  SELECT coalesce(array_agg(t.id ORDER BY t.ord),'{}'::uuid[]) INTO v_inst_ids
  FROM (SELECT id,min(ord) AS ord FROM unnest(coalesce(p_target_institution_ids,'{}'::uuid[]))
    WITH ORDINALITY AS u(id,ord) GROUP BY id) t;
  IF cardinality(v_inst_ids) > 0 THEN
    SELECT array_agg(ei.name ORDER BY t.ord) INTO v_inst_names
    FROM unnest(v_inst_ids) WITH ORDINALITY AS t(id,ord)
    JOIN public.enamed_institutions ei ON ei.id = t.id;
    IF coalesce(cardinality(v_inst_names),0) <> cardinality(v_inst_ids) THEN
      RAISE EXCEPTION 'Instituicao invalida';
    END IF;
  END IF;
  IF public.is_any_simulado_window_open(v_now) THEN
    RAISE EXCEPTION 'Perfil so pode ser editado entre janelas de execucao';
  END IF;
  INSERT INTO public.onboarding_profiles(user_id,specialty_id,specialty,target_institution_ids,
    target_institutions,status,completed_at)
  VALUES(v_user_id,p_specialty_id,v_specialty_name,v_inst_ids,v_inst_names,'completed',v_now)
  ON CONFLICT (user_id) DO UPDATE SET specialty_id = EXCLUDED.specialty_id,
    specialty = EXCLUDED.specialty,target_institution_ids = EXCLUDED.target_institution_ids,
    target_institutions = EXCLUDED.target_institutions,status = 'completed',
    completed_at = coalesce(onboarding_profiles.completed_at,v_now),updated_at = v_now
  RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(p_specialty text,p_target_institutions text[])
RETURNS public.onboarding_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_spec_id uuid; v_inst_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '28000'; END IF;
  IF p_specialty IS NULL OR btrim(p_specialty) = '' THEN RAISE EXCEPTION 'Especialidade obrigatoria'; END IF;
  IF coalesce(array_length(p_target_institutions,1),0) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma instituicao ou marque Ainda nao sei';
  END IF;
  SELECT es.id INTO v_spec_id FROM public.enamed_specialties es
    WHERE public.normalize_text_for_match(es.name) = public.normalize_text_for_match(p_specialty);
  IF v_spec_id IS NULL AND public.normalize_text_for_match(p_specialty) <> public.normalize_text_for_match('Ainda nao sei') THEN
    RAISE EXCEPTION 'Especialidade invalida';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_target_institutions) t(name)
    WHERE t.name IS NULL OR (public.normalize_text_for_match(t.name) <> public.normalize_text_for_match('Ainda nao sei')
    AND NOT EXISTS (SELECT 1 FROM public.enamed_institutions ei
      WHERE public.normalize_text_for_match(ei.name) = public.normalize_text_for_match(t.name)))) THEN
    RAISE EXCEPTION 'Instituicao invalida';
  END IF;
  SELECT coalesce(array_agg(ei.id ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL),'{}'::uuid[])
    INTO v_inst_ids FROM unnest(p_target_institutions) WITH ORDINALITY AS t(name,ord)
    LEFT JOIN public.enamed_institutions ei ON public.normalize_text_for_match(ei.name) = public.normalize_text_for_match(t.name);
  RETURN public.save_onboarding_guarded(v_spec_id,v_inst_ids);
END $$;
REVOKE ALL ON FUNCTION public.save_onboarding_guarded(uuid,uuid[]), public.save_onboarding_guarded(text,text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding_guarded(uuid,uuid[]), public.save_onboarding_guarded(text,text[])
  TO authenticated, service_role;

COMMIT;

-- Rollback (operator-reviewed, no data loss): first turn editions_ui off, then
-- restore the THREE guard/window definitions and TWO save definitions from the
-- pre-deploy catalog as one transaction (including original ACLs/search_paths).
-- Keep RPC-only onboarding ACLs, nullable columns, FK, history, RLS, full-row
-- invoker write trigger and target RPC; never restore legacy direct DML grants.
-- they preserve collected preferences/audit while old clients ignore them.
-- Do NOT drop columns/tables, clear history, rewrite attempts or delete targets.
-- A destructive contract rollback requires a separate authorized data export.
