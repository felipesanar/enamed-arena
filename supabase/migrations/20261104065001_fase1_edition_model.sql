-- F1-1. Based on sanitized production-schema.json (2026-11-04) + F0 migrations.
-- Requires F0, especially invoker attempt guard and question column ACLs.
BEGIN;

CREATE TABLE IF NOT EXISTS public.exam_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  weights_provisional boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.exam_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.exam_blueprints(id) ON DELETE RESTRICT,
  code text NOT NULL,
  label text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  UNIQUE (blueprint_id, code),
  UNIQUE (blueprint_id, sort_order)
);
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit ACL: no direct authenticated writes, including for admins. Admin
-- configuration goes through the audited capability-gated RPC below.
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_blueprints, public.exam_areas, public.app_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exam_blueprints, public.exam_areas, public.app_config TO authenticated;
GRANT ALL ON public.exam_blueprints, public.exam_areas, public.app_config TO service_role;
DROP POLICY IF EXISTS exam_blueprints_read ON public.exam_blueprints;
CREATE POLICY exam_blueprints_read ON public.exam_blueprints FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS exam_areas_read ON public.exam_areas;
CREATE POLICY exam_areas_read ON public.exam_areas FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS app_config_read ON public.app_config;
CREATE POLICY app_config_read ON public.app_config FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
DROP TRIGGER IF EXISTS app_config_updated_at ON public.app_config;
CREATE TRIGGER app_config_updated_at BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.admin_set_app_config(p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_require('content.manage');
  IF p_key IS NULL OR btrim(p_key) = '' OR p_value IS NULL
     OR (p_key = 'editions_ui' AND jsonb_typeof(p_value) <> 'boolean') THEN
    RAISE EXCEPTION 'Invalid app configuration' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.app_config(key,value) VALUES (p_key,p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  -- Production tg_admin_audit assumes NEW.id uuid; app_config has a text key.
  PERFORM public.admin_log_action('UPSERT','app_config',NULL,'Configuration: ' || p_key,
    jsonb_build_object('key',p_key,'value',p_value));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_app_config(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_app_config(text,jsonb) TO authenticated, service_role;
INSERT INTO public.app_config(key,value) VALUES ('editions_ui','false'::jsonb) ON CONFLICT (key) DO NOTHING;

INSERT INTO public.exam_blueprints(code,label,weights_provisional)
VALUES ('inep-478-2025','Portaria Inep 478/2025',true) ON CONFLICT (code) DO NOTHING;
-- TODO Conteudo: approve weights before weights_provisional can become false.
-- Exact normalized aliases only. Never infer Preventiva or mixed-area strings.
INSERT INTO public.exam_areas(blueprint_id,code,label,aliases,weight,sort_order)
SELECT b.id,v.code,v.label,v.aliases,1::numeric / 7,v.sort_order
FROM public.exam_blueprints b CROSS JOIN (VALUES
 ('clinica_medica','Clínica Médica',ARRAY['Clínica Médica'],1),
 ('cirurgia_geral','Cirurgia Geral',ARRAY['Cirurgia Geral','Cirurgia'],2),
 ('ginecologia_obstetricia','Ginecologia e Obstetrícia',ARRAY['Ginecologia e Obstetrícia','Ginecologia','Obstetrícia','GO','Ginecologia/Obstetrícia','Ginecologia / Obstetrícia'],3),
 ('pediatria','Pediatria',ARRAY['Pediatria'],4),
 ('medicina_familia_comunidade','Medicina de Família e Comunidade',ARRAY['MFC','Medicina de Família e Comunidade','Medicina da Família e Comunidade','Medicina de Família','Medicina da Família'],5),
 ('saude_mental','Saúde Mental',ARRAY['Saúde Mental','Psiquiatria'],6),
 ('saude_coletiva','Saúde Coletiva',ARRAY['Saúde Coletiva'],7)
) v(code,label,aliases,sort_order) WHERE b.code = 'inep-478-2025'
ON CONFLICT (blueprint_id,code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.normalize_exam_area(p_area text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = public AS $$
  SELECT btrim(regexp_replace(translate(lower(p_area),
    'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'), '[[:space:]]+', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION public.normalize_exam_area(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_exam_area(text) TO authenticated, service_role;

ALTER TABLE public.exam_editions
  ADD COLUMN IF NOT EXISTS blueprint_id uuid REFERENCES public.exam_blueprints(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cutoff_reference_label text;
UPDATE public.exam_editions SET blueprint_id = (SELECT id FROM public.exam_blueprints WHERE code = 'inep-478-2025')
WHERE code IN ('2026','2027.1','2027.2') AND blueprint_id IS NULL;
-- No default for future editions: their official blueprint needs explicit approval.

ALTER TABLE public.simulados
  ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_simulado_id uuid REFERENCES public.simulados(id) ON DELETE RESTRICT;
-- Only rows that predate this expand belong to legacy 2026, not future editions.
UPDATE public.simulados SET edition_id = (SELECT id FROM public.exam_editions WHERE code = '2026')
WHERE edition_id IS NULL;
ALTER TABLE public.simulados ALTER COLUMN edition_id SET NOT NULL;
-- Old clients omit edition_id; their inserts continue to target 2026 only.
-- New admin writers must explicitly pass the chosen edition (never infer year).
DO $$ DECLARE legacy_id uuid; BEGIN
  SELECT id INTO STRICT legacy_id FROM public.exam_editions WHERE code = '2026';
  EXECUTE format('ALTER TABLE public.simulados ALTER COLUMN edition_id SET DEFAULT %L::uuid',legacy_id);
END $$;

-- Production has no sequence uniqueness, but accept later F0/local variants.
-- Remove ONLY single-column, nonpartial global sequence uniqueness, not slug.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.simulados'::regclass AND c.contype = 'u'
    AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'sequence_number')]::smallint[]
  LOOP EXECUTE format('ALTER TABLE public.simulados DROP CONSTRAINT %I',r.conname); END LOOP;
  FOR r IN SELECT i.indexrelid::regclass AS index_name FROM pg_index i
    WHERE i.indrelid = 'public.simulados'::regclass AND i.indisunique AND NOT i.indisprimary
      AND i.indnkeyatts = 1 AND i.indexprs IS NULL AND i.indpred IS NULL
      AND i.indkey[0] = (SELECT attnum FROM pg_attribute WHERE attrelid = i.indrelid AND attname = 'sequence_number')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
  LOOP EXECUTE format('DROP INDEX %s',r.index_name); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.simulados'::regclass AND conname = 'simulados_edition_sequence_key') THEN
    ALTER TABLE public.simulados ADD CONSTRAINT simulados_edition_sequence_key UNIQUE (edition_id,sequence_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.simulados'::regclass AND conname = 'simulados_edition_windows_check') THEN
    ALTER TABLE public.simulados ADD CONSTRAINT simulados_edition_windows_check
      CHECK (execution_window_start < execution_window_end AND execution_window_end <= results_release_at) NOT VALID;
  END IF;
END $$;
COMMENT ON CONSTRAINT simulados_edition_windows_check ON public.simulados IS
  'NOT VALID: historical S7 release precedes window end. New/updated rows checked; no historical dates changed. Correct only with explicit authorization, then VALIDATE.';

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS specialty_id_at_finish uuid,
  ADD COLUMN IF NOT EXISTS target_institution_ids_at_finish uuid[],
  ADD COLUMN IF NOT EXISTS snapshot_backfilled boolean NOT NULL DEFAULT false;
-- edition_id NULL identifies the original expand population. Reapplication must
-- NOT resnapshot finalized rows from a changed profile. Empty array also records
-- a captured snapshot when the profile is absent (unknown specialty stays NULL).
UPDATE public.attempts a SET edition_id = s.edition_id,
  specialty_id_at_finish = CASE WHEN a.status IN ('submitted','expired') THEN
    (SELECT op.specialty_id FROM public.onboarding_profiles op WHERE op.user_id = a.user_id) ELSE a.specialty_id_at_finish END,
  target_institution_ids_at_finish = CASE WHEN a.status IN ('submitted','expired') THEN
    COALESCE((SELECT op.target_institution_ids FROM public.onboarding_profiles op WHERE op.user_id = a.user_id),'{}'::uuid[]) ELSE a.target_institution_ids_at_finish END,
  snapshot_backfilled = CASE WHEN a.status IN ('submitted','expired') THEN true ELSE a.snapshot_backfilled END
FROM public.simulados s WHERE s.id = a.simulado_id AND a.edition_id IS NULL;
-- Orphans abort the transaction rather than delete attempts or weaken integrity.
ALTER TABLE public.attempts ALTER COLUMN edition_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS attempts_edition_id_idx ON public.attempts(edition_id);

CREATE OR REPLACE FUNCTION public.enforce_attempt_edition_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE parent_edition uuid;
BEGIN
  -- Never use session_user or JWT role for this decision; F0 remains unchanged.
  IF current_user NOT IN ('postgres','supabase_admin','supabase_auth_admin','service_role') THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'attempt creation requires guarded RPCs' USING ERRCODE = 'P0001';
    END IF;
    IF ROW(NEW.edition_id,NEW.specialty_id_at_finish,NEW.target_institution_ids_at_finish,NEW.snapshot_backfilled)
       IS DISTINCT FROM ROW(OLD.edition_id,OLD.specialty_id_at_finish,OLD.target_institution_ids_at_finish,OLD.snapshot_backfilled) THEN
      RAISE EXCEPTION 'attempt edition and snapshot are read-only for clients' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  SELECT edition_id INTO parent_edition FROM public.simulados WHERE id = NEW.simulado_id FOR SHARE;
  IF parent_edition IS NULL OR (NEW.edition_id IS NOT NULL AND NEW.edition_id IS DISTINCT FROM parent_edition) THEN
    RAISE EXCEPTION 'attempt edition must match simulado edition' USING ERRCODE = '23514';
  END IF;
  NEW.edition_id := parent_edition;
  IF TG_OP = 'UPDATE' THEN
    -- Includes reopen/convert/reprocess paths: once captured, keep the first
    -- finish snapshot even if a guarded RPC later clears finished_at/status.
    IF OLD.target_institution_ids_at_finish IS NOT NULL OR OLD.snapshot_backfilled THEN
      IF ROW(NEW.specialty_id_at_finish,NEW.target_institution_ids_at_finish,NEW.snapshot_backfilled)
         IS DISTINCT FROM ROW(OLD.specialty_id_at_finish,OLD.target_institution_ids_at_finish,OLD.snapshot_backfilled) THEN
        RAISE EXCEPTION 'finished attempt snapshot is immutable' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.status IN ('submitted','expired') THEN
    SELECT op.specialty_id,op.target_institution_ids
      INTO NEW.specialty_id_at_finish,NEW.target_institution_ids_at_finish
      FROM public.onboarding_profiles op WHERE op.user_id = NEW.user_id;
    NEW.target_institution_ids_at_finish := COALESCE(NEW.target_institution_ids_at_finish,'{}'::uuid[]);
    NEW.snapshot_backfilled := false;
  ELSE
    NEW.specialty_id_at_finish := NULL;
    NEW.target_institution_ids_at_finish := NULL;
    NEW.snapshot_backfilled := false;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_attempt_edition_snapshot() FROM PUBLIC, anon, authenticated, service_role;
-- Alphabetically before F0's trg_prevent_direct_attempts_update; both INVOKER.
DROP TRIGGER IF EXISTS trg_attempt_edition_snapshot ON public.attempts;
CREATE TRIGGER trg_attempt_edition_snapshot BEFORE INSERT OR UPDATE ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_attempt_edition_snapshot();

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.exam_areas(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS questions_area_id_idx ON public.questions(area_id);
-- F0 has column-level SELECT, not a table grant. Do not expose explanations.
GRANT SELECT(area_id) ON public.questions TO authenticated;
UPDATE public.questions q SET area_id = candidates.area_id
FROM (
  SELECT q0.id, (array_agg(DISTINCT a.id))[1] AS area_id
  FROM public.questions q0 JOIN public.simulados s ON s.id = q0.simulado_id
  JOIN public.exam_editions e ON e.id = s.edition_id
  JOIN public.exam_areas a ON a.blueprint_id = e.blueprint_id
  WHERE q0.area_id IS NULL AND EXISTS (SELECT 1 FROM unnest(a.aliases || ARRAY[a.label,a.code]) alias
    WHERE public.normalize_exam_area(alias) = public.normalize_exam_area(q0.area))
  GROUP BY q0.id HAVING count(DISTINCT a.id) = 1
) candidates WHERE q.id = candidates.id AND q.area_id IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_question_edition_area()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE blueprint uuid; candidates uuid[];
BEGIN
  SELECT e.blueprint_id INTO blueprint FROM public.simulados s
  JOIN public.exam_editions e ON e.id = s.edition_id WHERE s.id = NEW.simulado_id FOR SHARE OF s,e;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.area IS DISTINCT FROM OLD.area AND NEW.area_id IS NOT DISTINCT FROM OLD.area_id THEN
      NEW.area_id := NULL; -- old text-only admin edits must not keep a stale area
    END IF;
  END IF;
  IF NEW.area_id IS NULL THEN
    SELECT array_agg(DISTINCT a.id) INTO candidates FROM public.exam_areas a
    WHERE a.blueprint_id = blueprint AND EXISTS (
      SELECT 1 FROM unnest(a.aliases || ARRAY[a.label,a.code]) alias
      WHERE public.normalize_exam_area(alias) = public.normalize_exam_area(NEW.area));
    IF cardinality(candidates) = 1 THEN NEW.area_id := candidates[1]; END IF;
  END IF;
  IF NEW.area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.exam_areas a WHERE a.id = NEW.area_id AND a.blueprint_id = blueprint
  ) THEN
    RAISE EXCEPTION 'question area must belong to edition blueprint' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_question_edition_area() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_question_edition_area ON public.questions;
CREATE TRIGGER trg_question_edition_area BEFORE INSERT OR UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.enforce_question_edition_area();

-- Protect inverse relationship too; admin RLS must not hide other users' rows.
CREATE OR REPLACE FUNCTION public.enforce_simulado_edition_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.edition_id IS DISTINCT FROM OLD.edition_id AND (
    EXISTS (SELECT 1 FROM public.attempts a WHERE a.simulado_id = OLD.id)
    OR EXISTS (SELECT 1 FROM public.questions q JOIN public.exam_areas a ON a.id = q.area_id
      WHERE q.simulado_id = OLD.id AND a.blueprint_id IS DISTINCT FROM
      (SELECT e.blueprint_id FROM public.exam_editions e WHERE e.id = NEW.edition_id))
  ) THEN
    RAISE EXCEPTION 'cannot move simulado with attempts or incompatible question areas' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_simulado_edition_change() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_simulado_edition_change ON public.simulados;
CREATE TRIGGER trg_simulado_edition_change BEFORE UPDATE OF edition_id ON public.simulados
FOR EACH ROW EXECUTE FUNCTION public.enforce_simulado_edition_change();

CREATE OR REPLACE FUNCTION public.enforce_edition_blueprint_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.blueprint_id IS DISTINCT FROM OLD.blueprint_id AND EXISTS (
    SELECT 1 FROM public.simulados s JOIN public.questions q ON q.simulado_id = s.id
    JOIN public.exam_areas a ON a.id = q.area_id
    WHERE s.edition_id = OLD.id AND a.blueprint_id IS DISTINCT FROM NEW.blueprint_id
  ) THEN
    RAISE EXCEPTION 'edition blueprint conflicts with existing question areas' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_edition_blueprint_change() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_edition_blueprint_change ON public.exam_editions;
CREATE TRIGGER trg_edition_blueprint_change BEFORE UPDATE OF blueprint_id ON public.exam_editions
FOR EACH ROW EXECUTE FUNCTION public.enforce_edition_blueprint_change();

-- The production published/admin permissive policies remain. A restrictive
-- fence ensures an additional permissive policy cannot open archived rows.
DROP POLICY IF EXISTS simulados_archived_owner ON public.simulados;
CREATE POLICY simulados_archived_owner ON public.simulados FOR SELECT TO authenticated USING (
  status = 'archived' AND EXISTS (SELECT 1 FROM public.attempts a
    WHERE a.simulado_id = simulados.id AND a.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS simulados_archived_fence ON public.simulados;
CREATE POLICY simulados_archived_fence ON public.simulados AS RESTRICTIVE FOR SELECT TO authenticated USING (
  status <> 'archived' OR (SELECT public.has_capability('content.manage')) OR EXISTS (
    SELECT 1 FROM public.attempts a WHERE a.simulado_id = simulados.id AND a.user_id = (SELECT auth.uid())));
-- Deliberately no question/options/explanations policy changes: preserve F0.

COMMIT;

-- DATA-PRESERVING ROLLBACK (manual, never execute automatically):
-- 1. Disable editions_ui through admin_set_app_config('editions_ui','false').
--    Roll back dependent admin/frontend jobs BEFORE changing this model.
-- 2. Keep all tables, columns, populated snapshots, indexes, FKs and seeds.
--    Dropping edition_id/areas/snapshots destroys provenance and is NOT rollback.
-- 3. If legacy writes are blocked by S7's old dates, stop those writes; request
--    explicit date correction. Do not VALIDATE or rewrite historical timestamps.
--    Emergency removal of simulados_edition_windows_check requires approval and
--    a new forward migration; preserve its diagnostic output first.
-- 4. Keep F0 guard and trg_attempt_edition_snapshot enabled. Never restore broad
--    attempts INSERT, question SELECT or answer-key grants for compatibility.
-- 5. To remove archived browsing only (does not delete attempts/history):
--    BEGIN;
--    DROP POLICY IF EXISTS simulados_archived_owner ON public.simulados;
--    -- Keep restrictive fence; production published/admin policies still apply.
--    COMMIT;
-- 6. Global sequence uniqueness cannot be restored if editions reuse a number.
--    Inspect GROUP BY sequence_number HAVING count(*)>1, and leave per-edition
--    uniqueness in place. Never renumber/delete historical rows to force rollback.
-- 7. Structural contraction, if ever needed, requires an approved export and
--    reconciliation of every new-edition row. This file offers no destructive SQL.
