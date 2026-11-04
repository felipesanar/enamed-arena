-- Requires F0 and 20261104065001_fase1_edition_model.sql. No rollout/flag changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.validate_admin_exam_format(p_format jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF jsonb_typeof(p_format) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Formato inválido' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['questions','options','duration_minutes'] LOOP
    IF jsonb_typeof(p_format->k) IS DISTINCT FROM 'number'
       OR (p_format->>k)::numeric <= 0 OR (p_format->>k)::numeric <> trunc((p_format->>k)::numeric)
       OR (p_format->>k)::numeric > 2147483647 THEN
      RAISE EXCEPTION 'Formato: % deve ser inteiro positivo', k USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF (p_format->>'scoring') IS NULL OR (p_format->>'scoring') NOT IN ('tri','raw') THEN
    RAISE EXCEPTION 'Pontuação inválida' USING ERRCODE='22023';
  END IF;
  IF p_format ? 'proficient_min' AND (jsonb_typeof(p_format->'proficient_min') IS DISTINCT FROM 'number'
    OR (p_format->>'proficient_min')::numeric < 0) THEN
    RAISE EXCEPTION 'Referência de proficiência inválida' USING ERRCODE='22023';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_admin_exam_format(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_edition(p_edition jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.exam_editions; previous jsonb; k text; date_value text;
BEGIN
  PERFORM public.admin_require('content.manage');
  IF jsonb_typeof(p_edition) IS DISTINCT FROM 'object' OR NOT p_edition ?& ARRAY[
    'code','year','term','label','status','exam_date','exam_date_confirmed','official_results_at',
    'format','blueprint_id','cutoff_reference_label'] THEN
    RAISE EXCEPTION 'DTO de edição incompleto' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_edition->'code') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_edition->'label') IS DISTINCT FROM 'string'
     OR btrim(p_edition->>'label') = ''
     OR jsonb_typeof(p_edition->'year') IS DISTINCT FROM 'number'
     OR (p_edition->>'year') !~ '^[0-9]{4}$'
     OR jsonb_typeof(p_edition->'exam_date_confirmed') IS DISTINCT FROM 'boolean'
     OR (p_edition->>'status') IS NULL OR (p_edition->>'status') NOT IN ('planned','preparing','active','closed','archived')
     OR (p_edition->'term' <> 'null'::jsonb AND (jsonb_typeof(p_edition->'term') IS DISTINCT FROM 'number' OR p_edition->>'term' NOT IN ('1','2')))
     OR (p_edition->'cutoff_reference_label' <> 'null'::jsonb AND jsonb_typeof(p_edition->'cutoff_reference_label') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION 'Identificação da edição inválida' USING ERRCODE='22023';
  END IF;
  IF p_edition->>'code' IS DISTINCT FROM ((p_edition->>'year') || CASE WHEN p_edition->>'term' IS NULL THEN '' ELSE '.' || (p_edition->>'term') END) THEN
    RAISE EXCEPTION 'Código deve corresponder ao ano e termo explícitos' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['exam_date','official_results_at'] LOOP
    date_value := p_edition->>k;
    IF date_value IS NOT NULL AND (jsonb_typeof(p_edition->k) <> 'string' OR date_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
      RAISE EXCEPTION 'Data inválida: %',k USING ERRCODE='22023';
    END IF;
    IF date_value IS NOT NULL THEN PERFORM date_value::date; END IF;
  END LOOP;
  IF (p_edition->>'exam_date_confirmed')::boolean AND p_edition->>'exam_date' IS NULL THEN
    RAISE EXCEPTION 'Confirmação exige data' USING ERRCODE='22023';
  END IF;
  IF (p_edition->>'official_results_at')::date < (p_edition->>'exam_date')::date THEN
    RAISE EXCEPTION 'Resultado oficial anterior à prova' USING ERRCODE='22023';
  END IF;
  PERFORM public.validate_admin_exam_format(p_edition->'format');
  IF p_edition->>'blueprint_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.exam_blueprints WHERE id=(p_edition->>'blueprint_id')::uuid) THEN
    RAISE EXCEPTION 'Matriz inexistente' USING ERRCODE='22023';
  END IF;
  IF p_edition->>'id' IS NOT NULL THEN
    SELECT * INTO STRICT v FROM public.exam_editions WHERE id=(p_edition->>'id')::uuid FOR UPDATE;
    previous := to_jsonb(v);
  ELSE
    v.id := gen_random_uuid();
  END IF;
  IF previous IS NULL THEN
    INSERT INTO public.exam_editions(id,code,year,term,label,status,exam_date,exam_date_confirmed,official_results_at,format,blueprint_id,cutoff_reference_label)
    VALUES (v.id,p_edition->>'code',(p_edition->>'year')::smallint,(p_edition->>'term')::smallint,btrim(p_edition->>'label'),
      (p_edition->>'status')::public.exam_edition_status,(p_edition->>'exam_date')::date,(p_edition->>'exam_date_confirmed')::boolean,
      (p_edition->>'official_results_at')::date,p_edition->'format',(p_edition->>'blueprint_id')::uuid,NULLIF(btrim(p_edition->>'cutoff_reference_label'),''));
  ELSE
    UPDATE public.exam_editions SET code=p_edition->>'code',year=(p_edition->>'year')::smallint,term=(p_edition->>'term')::smallint,
      label=btrim(p_edition->>'label'),status=(p_edition->>'status')::public.exam_edition_status,
      exam_date=(p_edition->>'exam_date')::date,exam_date_confirmed=(p_edition->>'exam_date_confirmed')::boolean,
      official_results_at=(p_edition->>'official_results_at')::date,format=p_edition->'format',blueprint_id=(p_edition->>'blueprint_id')::uuid,
      cutoff_reference_label=NULLIF(btrim(p_edition->>'cutoff_reference_label'),'') WHERE id=v.id;
  END IF;
  PERFORM public.admin_log_action('UPSERT','exam_editions',v.id,'Edição salva',
    jsonb_build_object('before',previous,'after',(SELECT to_jsonb(e) FROM public.exam_editions e WHERE id=v.id)));
  RETURN v.id;
END $$;
-- Full DTO validation and before/after audit must not be bypassed by table writes.
REVOKE INSERT,UPDATE,DELETE ON public.exam_editions FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_edition(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_edition(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_clone_simulado(p_source uuid,p_edition_id uuid,
  p_window_start timestamptz,p_window_end timestamptz,p_results_release_at timestamptz,p_copy_questions boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.simulados; dest public.exam_editions; seq integer; new_id uuid := gen_random_uuid();
  q public.questions; new_q uuid; mapped uuid; candidates uuid[];
BEGIN
  PERFORM public.admin_require('content.manage');
  IF p_window_start IS NULL OR p_window_end IS NULL OR p_results_release_at IS NULL
     OR NOT isfinite(p_window_start) OR NOT isfinite(p_window_end) OR NOT isfinite(p_results_release_at)
     OR NOT (p_window_start < p_window_end AND p_window_end <= p_results_release_at) OR p_copy_questions IS NULL THEN
    RAISE EXCEPTION 'Janela inválida: início < fim <= resultado' USING ERRCODE='22023';
  END IF;
  -- The destination row serializes sequence allocation; unique(edition,sequence)
  -- remains the final guard against concurrent direct inserts. Failure rolls back.
  SELECT * INTO STRICT dest FROM public.exam_editions WHERE id=p_edition_id FOR UPDATE;
  SELECT * INTO STRICT src FROM public.simulados WHERE id=p_source FOR UPDATE;
  PERFORM public.validate_admin_exam_format(dest.format);
  SELECT coalesce(max(sequence_number),0)+1 INTO seq FROM public.simulados WHERE edition_id=dest.id;
  INSERT INTO public.simulados(id,title,slug,sequence_number,description,duration_minutes,questions_count,
    execution_window_start,execution_window_end,results_release_at,theme_tags,status,edition_id,source_simulado_id)
  VALUES (new_id,src.title,'enamed-' || dest.year || CASE WHEN dest.term IS NULL THEN '' ELSE '-' || dest.term END || '-simulado-' || seq,
    seq,src.description,(dest.format->>'duration_minutes')::integer,
    CASE WHEN p_copy_questions THEN (SELECT count(*) FROM public.questions WHERE simulado_id=src.id) ELSE 0 END,
    p_window_start,p_window_end,p_results_release_at,src.theme_tags,'draft',dest.id,src.id);
  IF p_copy_questions THEN
    FOR q IN SELECT * FROM public.questions WHERE simulado_id=src.id ORDER BY question_number LOOP
      new_q := gen_random_uuid(); mapped := NULL;
      SELECT a.id INTO mapped FROM public.exam_areas a WHERE a.id=q.area_id AND a.blueprint_id=dest.blueprint_id;
      IF mapped IS NULL THEN
        SELECT array_agg(DISTINCT a.id) INTO candidates FROM public.exam_areas a WHERE a.blueprint_id=dest.blueprint_id
        AND EXISTS (SELECT 1 FROM unnest(a.aliases || ARRAY[a.label,a.code]) alias
          WHERE public.normalize_exam_area(alias)=public.normalize_exam_area(q.area));
        IF cardinality(candidates)=1 THEN mapped := candidates[1]; END IF;
      END IF;
      INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme,difficulty,image_url,image_url_2,explanation,explanation_image_url,area_id)
      VALUES(new_q,new_id,q.question_number,q.text,q.area,q.theme,q.difficulty,q.image_url,q.image_url_2,q.explanation,q.explanation_image_url,mapped);
      INSERT INTO public.question_options(id,question_id,label,text,is_correct)
      SELECT gen_random_uuid(),new_q,label,text,is_correct FROM public.question_options WHERE question_id=q.id;
    END LOOP;
  END IF;
  -- No attempts/answers/results copied. Storage references remain immutable URLs.
  PERFORM public.admin_log_action('CLONE','simulados',new_id,'Clonado como rascunho',
    jsonb_build_object('source_simulado_id',src.id,'edition_id',dest.id,'copy_questions',p_copy_questions));
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_clone_simulado(uuid,uuid,timestamptz,timestamptz,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clone_simulado(uuid,uuid,timestamptz,timestamptz,timestamptz,boolean) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_simulado_publication(p_simulado public.simulados)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE edition public.exam_editions; n integer; options integer;
BEGIN
  SELECT * INTO STRICT edition FROM public.exam_editions WHERE id=p_simulado.edition_id FOR SHARE;
  PERFORM public.validate_admin_exam_format(edition.format);
  n := (edition.format->>'questions')::integer; options := (edition.format->>'options')::integer;
  IF edition.blueprint_id IS NULL OR p_simulado.duration_minutes <> (edition.format->>'duration_minutes')::integer
    OR p_simulado.questions_count <> n OR NOT (p_simulado.execution_window_start < p_simulado.execution_window_end
      AND p_simulado.execution_window_end <= p_simulado.results_release_at)
    OR NOT isfinite(p_simulado.execution_window_start) OR NOT isfinite(p_simulado.execution_window_end) OR NOT isfinite(p_simulado.results_release_at)
    OR (SELECT count(*) FROM public.questions WHERE simulado_id=p_simulado.id) <> n
    OR (SELECT count(DISTINCT question_number) FROM public.questions WHERE simulado_id=p_simulado.id) <> n
    OR EXISTS (SELECT 1 FROM public.questions q WHERE q.simulado_id=p_simulado.id AND (
      q.question_number < 1 OR q.question_number > n OR btrim(q.text)='' OR q.area_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.exam_areas a WHERE a.id=q.area_id AND a.blueprint_id=edition.blueprint_id)
      OR (SELECT count(*) FROM public.question_options o WHERE o.question_id=q.id) <> options
      OR (SELECT count(DISTINCT label) FROM public.question_options o WHERE o.question_id=q.id) <> options
      OR (SELECT count(*) FROM public.question_options o WHERE o.question_id=q.id AND is_correct) <> 1
      OR EXISTS (SELECT 1 FROM public.question_options o WHERE o.question_id=q.id AND (btrim(o.text)='' OR o.label !~ '^[A-Z]$' OR ascii(o.label)-ascii('A') NOT BETWEEN 0 AND options-1))
    )) THEN
    RAISE EXCEPTION 'Publicação bloqueada: confira formato, questões, alternativas, áreas e janela' USING ERRCODE='23514';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_simulado_publication(public.simulados) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enforce_admin_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Validate only entering published; reads and unrelated historical updates do
  -- not revalidate old exams. F1 edition-change guards remain in place.
  IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.admin_require('content.manage');
    PERFORM public.validate_simulado_publication(NEW);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_admin_publication() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_admin_publication ON public.simulados;
CREATE TRIGGER trg_admin_publication BEFORE INSERT OR UPDATE ON public.simulados
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_publication();

CREATE OR REPLACE FUNCTION public.admin_publish_simulado(p_simulado_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.simulados; previous jsonb;
BEGIN
  PERFORM public.admin_require('content.manage');
  SELECT * INTO STRICT s FROM public.simulados WHERE id=p_simulado_id FOR UPDATE;
  previous := to_jsonb(s);
  PERFORM public.validate_simulado_publication(s);
  UPDATE public.simulados SET status='published' WHERE id=s.id;
  PERFORM public.admin_log_action('PUBLISH','simulados',s.id,'Simulado publicado',
    jsonb_build_object('before',previous,'after',(SELECT to_jsonb(t) FROM public.simulados t WHERE t.id=s.id)));
END $$;
REVOKE ALL ON FUNCTION public.admin_publish_simulado(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_simulado(uuid) TO authenticated,service_role;

-- Coordinate option writes with the parent lock held by clone/publication.
CREATE OR REPLACE FUNCTION public.lock_option_simulado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM s.id FROM public.simulados s JOIN public.questions q ON q.simulado_id=s.id
    WHERE q.id=CASE WHEN TG_OP='DELETE' THEN OLD.question_id ELSE NEW.question_id END FOR SHARE OF s;
  IF TG_OP='UPDATE' AND OLD.question_id IS DISTINCT FROM NEW.question_id THEN
    PERFORM s.id FROM public.simulados s JOIN public.questions q ON q.simulado_id=s.id WHERE q.id=OLD.question_id FOR SHARE OF s;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_option_simulado() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_lock_option_simulado ON public.question_options;
CREATE TRIGGER trg_lock_option_simulado BEFORE INSERT OR UPDATE OR DELETE ON public.question_options
FOR EACH ROW EXECUTE FUNCTION public.lock_option_simulado();

COMMIT;
-- Rollback only after disabling editions_ui and stopping new writers:
-- DROP TRIGGER trg_lock_option_simulado ON public.question_options;
-- DROP FUNCTION public.lock_option_simulado();
-- DROP TRIGGER trg_admin_publication ON public.simulados;
-- DROP FUNCTION public.enforce_admin_publication();
-- DROP FUNCTION public.admin_publish_simulado(uuid);
-- DROP FUNCTION public.validate_simulado_publication(public.simulados);
-- DROP FUNCTION public.admin_clone_simulado(uuid,uuid,timestamptz,timestamptz,timestamptz,boolean);
-- DROP FUNCTION public.admin_upsert_edition(jsonb);
-- DROP FUNCTION public.validate_admin_exam_format(jsonb);
-- GRANT INSERT,UPDATE,DELETE ON public.exam_editions TO authenticated;
-- No historical data, Storage objects or F1 model objects are removed.
