-- F1-4. Requires F0 and F1-1 edition model. No data is deleted or renumbered.
BEGIN;
LOCK TABLE public.questions IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.questions GROUP BY simulado_id,question_number HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Question import preflight: duplicate (simulado_id, question_number). Resolve explicitly before applying; no data changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.questions'::regclass AND conname='questions_simulado_number_key') THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_simulado_number_key UNIQUE (simulado_id,question_number);
  END IF;
END $$;

-- Read-only preflight is also used by the Edge before uploading any new image.
-- Content errors return row numbers; authentication/capability always raises.
CREATE OR REPLACE FUNCTION public.admin_validate_question_import(p_simulado_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  sim public.simulados%ROWTYPE; edition public.exam_editions%ROWTYPE;
  r jsonb; opt jsonb; idx bigint; oi bigint; n integer; max_q integer; option_count integer;
  seen integer[] := '{}'; errors jsonb := '[]'; area_ids uuid[]; field text; message text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  PERFORM public.admin_require('content.manage');
  -- The attempts check must get a fresh snapshot AFTER waiting for the parent
  -- lock. A transaction-wide snapshot could miss a just-committed attempt.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Question import requires READ COMMITTED isolation' USING ERRCODE='25001';
  END IF;
  -- F1's enforce_attempt_edition_snapshot takes FOR SHARE on this same parent
  -- before INSERT; the attempts FK also takes KEY SHARE. FOR UPDATE conflicts
  -- with both until transaction end, without locking unrelated simulados.
  SELECT * INTO sim FROM public.simulados WHERE id=p_simulado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Simulado not found' USING ERRCODE='22023'; END IF;
  SELECT * INTO edition FROM public.exam_editions WHERE id=sim.edition_id FOR SHARE;
  PERFORM 1 FROM public.exam_blueprints WHERE id=edition.blueprint_id FOR SHARE;
  PERFORM 1 FROM public.exam_areas WHERE blueprint_id=edition.blueprint_id FOR SHARE;
  IF sim.status::text NOT IN ('draft','test') OR EXISTS (SELECT 1 FROM public.attempts WHERE simulado_id=sim.id) THEN
    RETURN jsonb_build_object('ok',false,'imported',0,'errors',jsonb_build_array(jsonb_build_object('row',1,'field','simulado','message','Importação em lote exige rascunho/teste sem tentativas.')));
  END IF;
  IF jsonb_typeof(edition.format->'questions') IS DISTINCT FROM 'number'
     OR jsonb_typeof(edition.format->'options') IS DISTINCT FROM 'number'
     OR (edition.format->>'questions') !~ '^[1-9][0-9]{0,8}$'
     OR (edition.format->>'options') !~ '^[1-9][0-9]?$' OR edition.blueprint_id IS NULL THEN
    RAISE EXCEPTION 'Edition needs a valid format and blueprint' USING ERRCODE='22023';
  END IF;
  max_q := (edition.format->>'questions')::integer;
  option_count := (edition.format->>'options')::integer;
  IF option_count < 2 OR option_count > 26 THEN RAISE EXCEPTION 'Unsupported format: options must be between 2 and 26'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok',false,'imported',0,'errors','[{"row":1,"field":"rows","message":"Envie um array de questões."}]'::jsonb);
  END IF;
  IF jsonb_array_length(p_rows)=0 OR jsonb_array_length(p_rows) + (SELECT count(*) FROM public.questions WHERE simulado_id=sim.id) > max_q THEN
    errors := errors || jsonb_build_array(jsonb_build_object('row',1,'field','rows','message','Lote vazio ou excede o limite de questões da edição.'));
  END IF;
  FOR r,idx IN SELECT value,ordinality FROM jsonb_array_elements(p_rows) WITH ORDINALITY LOOP
    n := NULL;
    IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN
      errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'field','row','message','Linha deve ser um objeto.'));
      CONTINUE;
    END IF;
    IF jsonb_typeof(r->'question_number') = 'number' AND (r->>'question_number') ~ '^[1-9][0-9]{0,8}$' THEN n := (r->>'question_number')::integer; END IF;
    IF n IS NULL OR n > max_q OR n=ANY(seen) OR EXISTS (SELECT 1 FROM public.questions WHERE simulado_id=sim.id AND question_number=n) THEN
      errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field','question_number','message','Número inválido, repetido, já importado ou fora do formato.'));
    END IF;
    seen := array_append(seen,n);
    FOR field IN SELECT unnest(ARRAY['text','area']) LOOP
      IF jsonb_typeof(r->field) IS DISTINCT FROM 'string' OR btrim(r->>field)='' THEN
        errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field',field,'message','Texto obrigatório.'));
      END IF;
    END LOOP;
    FOR field IN SELECT unnest(ARRAY['theme','explanation','image_url','image_url_2','explanation_image_url']) LOOP
      IF r ? field AND jsonb_typeof(r->field) NOT IN ('string','null') THEN
        errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field',field,'message','Use texto ou null.'));
      END IF;
    END LOOP;
    IF r->>'difficulty' IS NOT NULL AND r->>'difficulty' NOT IN ('easy','medium','hard') THEN
      errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field','difficulty','message','Dificuldade inválida.'));
    END IF;
    SELECT array_agg(a.id) INTO area_ids FROM public.exam_areas a
      WHERE a.blueprint_id=edition.blueprint_id AND EXISTS (
        SELECT 1 FROM unnest(ARRAY[a.code,a.label] || a.aliases) alias
        WHERE public.normalize_exam_area(alias)=public.normalize_exam_area(r->>'area'));
    IF coalesce(cardinality(area_ids),0) <> 1 OR (r->>'area_id' IS NOT NULL AND r->>'area_id' <> area_ids[1]::text) THEN
      errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field','area','message','Área desconhecida, ambígua ou de outra matriz. Não inferir Preventiva/áreas compostas.'));
    END IF;
    message := NULL;
    IF jsonb_typeof(r->'options') IS DISTINCT FROM 'array' THEN message := 'Alternativas devem ser um array.';
    ELSIF jsonb_array_length(r->'options') <> option_count THEN message := format('A edição exige %s alternativas.',option_count);
    ELSE
      FOR opt,oi IN SELECT value,ordinality FROM jsonb_array_elements(r->'options') WITH ORDINALITY LOOP
        IF jsonb_typeof(opt) IS DISTINCT FROM 'object' OR opt->>'label' IS DISTINCT FROM chr(64+oi::integer)
           OR jsonb_typeof(opt->'text') IS DISTINCT FROM 'string' OR btrim(opt->>'text')=''
           OR jsonb_typeof(opt->'is_correct') IS DISTINCT FROM 'boolean' THEN message := 'Preencha textos e labels em ordem A, B, ... e is_correct booleano.'; END IF;
      END LOOP;
      IF (SELECT count(*) FROM jsonb_array_elements(r->'options') o WHERE o->'is_correct'='true'::jsonb) <> 1 THEN message := 'Exatamente uma alternativa deve ser correta.'; END IF;
    END IF;
    IF message IS NOT NULL THEN errors := errors || jsonb_build_array(jsonb_build_object('row',idx,'question_number',n,'field','options','message',message)); END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',jsonb_array_length(errors)=0,'imported',0,'errors',errors);
END $$;

CREATE OR REPLACE FUNCTION public.admin_import_questions(p_simulado_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE validation jsonb; r jsonb; qid uuid; area public.exam_areas%ROWTYPE; blueprint uuid; imported integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  PERFORM public.admin_require('content.manage');
  -- Validation acquires the target parent FOR UPDATE before checking attempts;
  -- keep that row lock through all inserts/audit/commit, never lock attempts globally.
  validation := public.admin_validate_question_import(p_simulado_id,p_rows);
  IF NOT (validation->>'ok')::boolean THEN RETURN validation; END IF;
  SELECT e.blueprint_id INTO blueprint FROM public.simulados s JOIN public.exam_editions e ON e.id=s.edition_id WHERE s.id=p_simulado_id;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT a.* INTO STRICT area FROM public.exam_areas a WHERE a.blueprint_id=blueprint AND EXISTS (
      SELECT 1 FROM unnest(ARRAY[a.code,a.label] || a.aliases) alias
      WHERE public.normalize_exam_area(alias)=public.normalize_exam_area(r->>'area'));
    INSERT INTO public.questions(simulado_id,question_number,text,area,area_id,theme,difficulty,explanation,image_url,image_url_2,explanation_image_url)
    VALUES (p_simulado_id,(r->>'question_number')::integer,r->>'text',area.label,area.id,coalesce(r->>'theme',''),coalesce(r->>'difficulty','medium'),r->>'explanation',r->>'image_url',r->>'image_url_2',r->>'explanation_image_url') RETURNING id INTO qid;
    INSERT INTO public.question_options(question_id,label,text,is_correct)
      SELECT qid,o->>'label',o->>'text',(o->>'is_correct')::boolean FROM jsonb_array_elements(r->'options') o;
    imported := imported+1;
  END LOOP;
  UPDATE public.simulados SET questions_count=(SELECT count(*) FROM public.questions WHERE simulado_id=p_simulado_id) WHERE id=p_simulado_id;
  PERFORM public.admin_log_action('IMPORT','simulados',p_simulado_id,'Atomic question import',jsonb_build_object('imported',imported,'operator_id',auth.uid()));
  RETURN jsonb_build_object('ok',true,'imported',imported,'errors','[]'::jsonb);
  -- No exception handler: any insert/audit failure aborts the complete transaction.
END $$;
REVOKE ALL ON FUNCTION public.admin_validate_question_import(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_import_questions(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_question_import(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_questions(uuid,jsonb) TO authenticated;

-- Existing Storage policies require role admin. Expand content.manage only for
-- new, operator-owned imports; never grant overwrite/delete of legacy paths.
-- Table existence is conditional for local harnesses without the Storage double.
DO $$ BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS fase1_import_images_insert ON storage.objects';
    EXECUTE 'CREATE POLICY fase1_import_images_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = ''question-images'' AND split_part(name,''/'',2) = ''imports''
      AND split_part(name,''/'',3) = (SELECT auth.uid())::text
      AND (SELECT public.has_capability(''content.manage'')))';
    EXECUTE 'DROP POLICY IF EXISTS fase1_import_images_delete ON storage.objects';
    EXECUTE 'CREATE POLICY fase1_import_images_delete ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = ''question-images'' AND split_part(name,''/'',2) = ''imports''
      AND split_part(name,''/'',3) = (SELECT auth.uid())::text
      AND (SELECT public.has_capability(''content.manage'')))';
  END IF;
END $$;
COMMIT;

-- rollback (manual, preserves imported questions/options and all audit history):
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.admin_import_questions(uuid,jsonb);
-- DROP FUNCTION IF EXISTS public.admin_validate_question_import(uuid,jsonb);
-- DROP POLICY IF EXISTS fase1_import_images_insert ON storage.objects;
-- DROP POLICY IF EXISTS fase1_import_images_delete ON storage.objects;
-- Keep questions_simulado_number_key to preserve integrity (remove only by explicit decision).
-- COMMIT;
