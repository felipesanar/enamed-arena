-- Fix polymorphic RECORD planning in the existing three content audit triggers.
-- CREATE OR REPLACE preserves the owner, trigger bindings and explicit grants.
BEGIN;

CREATE OR REPLACE FUNCTION public.tg_admin_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_fields text[];
  v_diff jsonb;
  v_summary text;
BEGIN
  -- Keep maintenance semantics: no fabricated actor and no audit write.
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  v_fields := CASE TG_TABLE_NAME
    WHEN 'simulados' THEN ARRAY['id', 'title', 'slug', 'sequence_number',
      'description', 'questions_count', 'duration_minutes', 'execution_window_start',
      'execution_window_end', 'results_release_at', 'theme_tags', 'status']
    WHEN 'questions' THEN ARRAY['id', 'simulado_id', 'question_number', 'text',
      'area', 'theme', 'difficulty', 'explanation']
    WHEN 'question_options' THEN ARRAY['id', 'question_id', 'label', 'text', 'is_correct']
  END;
  IF TG_TABLE_SCHEMA <> 'public' OR v_fields IS NULL THEN
    RAISE EXCEPTION 'Unsupported audit table %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END IF;

  -- Never resolve another table's fields on NEW/OLD. Only access assigned records.
  -- Project content explicitly: no future student/secret columns or signed URLs.
  IF TG_OP <> 'INSERT' THEN
    SELECT jsonb_object_agg(key, value) INTO v_before
    FROM jsonb_each(to_jsonb(OLD)) WHERE key = ANY(v_fields);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT jsonb_object_agg(key, value) INTO v_after
    FROM jsonb_each(to_jsonb(NEW)) WHERE key = ANY(v_fields);
  END IF;
  v_row := coalesce(v_after, v_before);
  v_summary := CASE TG_TABLE_NAME
    WHEN 'simulados' THEN 'Simulado: ' || (v_row->>'title')
    WHEN 'questions' THEN U&'Quest\00E3o n\00BA ' || (v_row->>'question_number')
    WHEN 'question_options' THEN 'Alternativa ' || (v_row->>'label')
  END;

  SELECT coalesce(jsonb_object_agg(field, jsonb_build_object(
    'before', v_before->field, 'after', v_after->field)), '{}'::jsonb)
  INTO v_diff FROM unnest(v_fields) AS fields(field)
  WHERE v_before->field IS DISTINCT FROM v_after->field;

  -- Same identity/authorization boundary as the existing trigger and helper.
  -- Do not catch audit failures: the content mutation must roll back with them.
  PERFORM public.admin_log_action(TG_OP, TG_TABLE_NAME, (v_row->>'id')::uuid,
    v_summary, jsonb_build_object('op', TG_OP, 'before', v_before,
      'after', v_after, 'diff', v_diff));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- Never expose this SECURITY DEFINER trigger as a client-callable function.
-- The captured ACL already grants postgres/service_role; preserve those grants.
REVOKE ALL ON FUNCTION public.tg_admin_audit() FROM PUBLIC, anon, authenticated;
COMMIT;

-- MANUAL ROLLBACK ONLY. This restores the previous behavior INCLUDING THE BUG:
-- SQL CASE plans fields absent from the current table and authenticated content
-- writes fail. Prefer a forward fix. No data, triggers or audit history is deleted.
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.tg_admin_audit()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $rollback$
-- DECLARE v_summary text; v_id uuid;
-- BEGIN
--   IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
--   v_id := coalesce(NEW.id, OLD.id);
--   v_summary := CASE TG_TABLE_NAME
--     WHEN 'simulados' THEN 'Simulado: ' || coalesce(NEW.title, OLD.title)
--     WHEN 'questions' THEN U&'Quest\00E3o n\00BA ' || coalesce(NEW.question_number, OLD.question_number)::text
--     WHEN 'question_options' THEN 'Alternativa ' || coalesce(NEW.label, OLD.label)
--     ELSE TG_TABLE_NAME END;
--   PERFORM public.admin_log_action(TG_OP, TG_TABLE_NAME, v_id, v_summary,
--     jsonb_build_object('op', TG_OP));
--   RETURN coalesce(NEW, OLD);
-- END;
-- $rollback$;
-- REVOKE ALL ON FUNCTION public.tg_admin_audit() FROM PUBLIC, anon, authenticated;
-- COMMIT;
