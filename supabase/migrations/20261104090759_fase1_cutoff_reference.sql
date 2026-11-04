-- F1-5 expansion only. ONE statement is atomic even under plain psql -f.
-- D6 is UNKNOWN: no historical UPDATE, deletion, deduplication or attribution.
-- No transaction control: reapply stays inside the caller's fixture transaction.
DO $cutoff_migration$
BEGIN
EXECUTE $cutoff_ddl$
CREATE SCHEMA IF NOT EXISTS cutoff_private;
REVOKE ALL ON SCHEMA cutoff_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS cutoff_private.original_functions (
 signature text PRIMARY KEY, definition text NOT NULL, acl aclitem[], owner_name name NOT NULL
);
ALTER TABLE cutoff_private.original_functions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cutoff_private.original_functions FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.enamed_cutoff_scores
 ADD COLUMN IF NOT EXISTS reference_edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.enamed_programs
 ADD COLUMN IF NOT EXISTS reference_edition_id uuid REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS source text;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['enamed_cutoff_scores','enamed_programs'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=format('public.%I',t)::regclass AND conname=t||'_reference_valid') THEN
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK
 (reference_edition_id IS NULL OR (institution_id IS NOT NULL AND specialty_id IS NOT NULL AND source IS NOT NULL AND btrim(source) <> '''')) NOT VALID',t,t||'_reference_valid');
 END IF;
 END LOOP;
 RAISE NOTICE 'Preserved legacy cutoffs: %, null canonical IDs: %, duplicate legacy keys: %',
 (SELECT count(*) FROM public.enamed_cutoff_scores WHERE reference_edition_id IS NULL),
 (SELECT count(*) FROM public.enamed_cutoff_scores WHERE institution_id IS NULL OR specialty_id IS NULL),
 (SELECT count(*) FROM (SELECT 1 FROM public.enamed_cutoff_scores WHERE reference_edition_id IS NULL GROUP BY institution_id,specialty_id,practice_scenario HAVING count(*)>1) d);
 RAISE NOTICE 'Preserved legacy programs: %, duplicate normalized legacy keys: %',
 (SELECT count(*) FROM public.enamed_programs WHERE reference_edition_id IS NULL),
 (SELECT count(*) FROM (SELECT 1 FROM public.enamed_programs WHERE reference_edition_id IS NULL GROUP BY institution_id,specialty_id,lower(btrim(coalesce(cenario_pratica,''))) HAVING count(*)>1) d);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS cutoff_reference_key ON public.enamed_cutoff_scores
 (institution_id,specialty_id,practice_scenario,reference_edition_id) WHERE reference_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS program_reference_key ON public.enamed_programs
 (institution_id,specialty_id,(lower(btrim(coalesce(cenario_pratica,'')))),reference_edition_id) WHERE reference_edition_id IS NOT NULL;
-- All client writes use the audited importer. Existing read policies are untouched.
REVOKE INSERT,UPDATE,DELETE ON public.enamed_cutoff_scores,public.enamed_programs FROM PUBLIC,anon,authenticated;

-- Historical NULLs remain untouched, but a new row cannot masquerade as legacy.
CREATE OR REPLACE FUNCTION cutoff_private.require_new_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.reference_edition_id IS NULL OR NEW.institution_id IS NULL OR NEW.specialty_id IS NULL
 OR NEW.source IS NULL OR btrim(NEW.source)='' THEN
 RAISE EXCEPTION 'New cutoff/program requires canonical IDs, reference and nonempty source' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION cutoff_private.require_new_reference() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS cutoff_require_reference ON public.enamed_cutoff_scores;
CREATE TRIGGER cutoff_require_reference BEFORE INSERT ON public.enamed_cutoff_scores
 FOR EACH ROW EXECUTE FUNCTION cutoff_private.require_new_reference();
DROP TRIGGER IF EXISTS program_require_reference ON public.enamed_programs;
CREATE TRIGGER program_require_reference BEFORE INSERT ON public.enamed_programs
 FOR EACH ROW EXECUTE FUNCTION cutoff_private.require_new_reference();

-- Snapshot originals exactly once, including original ACL/owner, for reviewed rollback.
-- The private compatibility implementation reads a NULL-only view, never new processes.
CREATE OR REPLACE VIEW cutoff_private.legacy_scores WITH (security_invoker=true) AS
 SELECT * FROM public.enamed_cutoff_scores WHERE reference_edition_id IS NULL;
REVOKE ALL ON cutoff_private.legacy_scores FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE sig text; p oid; d text; BEGIN
 FOREACH sig IN ARRAY ARRAY['public.get_cutoff_scores(uuid,uuid[])','public.get_user_cutoff_context(uuid)'] LOOP
 p := to_regprocedure(sig);
 IF p IS NOT NULL THEN
 INSERT INTO cutoff_private.original_functions(signature,definition,acl,owner_name)
 SELECT sig,pg_get_functiondef(p),proacl,pg_get_userbyid(proowner) FROM pg_proc WHERE oid=p
 ON CONFLICT(signature) DO NOTHING;
 -- Do not silently break views or functions with catalog-tracked dependencies.
 IF EXISTS(SELECT 1 FROM pg_depend WHERE refclassid='pg_proc'::regclass AND refobjid=p AND deptype NOT IN ('i','a')) THEN
 RAISE EXCEPTION 'Dependent objects on %, review before expanding signature',sig;
 END IF;
 EXECUTE 'DROP FUNCTION '||sig||' RESTRICT';
 END IF;
 END LOOP;
 IF to_regprocedure('cutoff_private.legacy_context(uuid)') IS NULL THEN
 SELECT definition INTO STRICT d FROM cutoff_private.original_functions WHERE signature='public.get_user_cutoff_context(uuid)';
 d := replace(d,'public.get_user_cutoff_context(', 'cutoff_private.legacy_context(');
 d := replace(d,'public.enamed_cutoff_scores','cutoff_private.legacy_scores');
 EXECUTE d;
 END IF;
END $$;
REVOKE ALL ON FUNCTION cutoff_private.legacy_context(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION cutoff_private.legacy_context(uuid) SET search_path=pg_catalog,public;

-- Explicit reference is sovereign. Implicit current: preparing before active,
-- then earliest catalog year/term. Tied catalog position or unknown label => none.
CREATE OR REPLACE FUNCTION cutoff_private.reference_context(p_reference uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e record; enabled boolean; n integer; BEGIN
 IF p_reference IS NOT NULL THEN
 SELECT * INTO e FROM public.exam_editions WHERE id=p_reference;
 IF NOT FOUND THEN RETURN jsonb_build_object('mode','reference','reference_edition_id',p_reference,'reference_reason','unknown_reference'); END IF;
 RETURN jsonb_build_object('mode','reference','reference_edition_id',e.id,'reference_label',e.cutoff_reference_label,'reference_reason','explicit');
 END IF;
 SELECT value='true'::jsonb INTO enabled FROM public.app_config WHERE key='editions_ui';
 IF NOT coalesce(enabled,false) THEN RETURN jsonb_build_object('mode','legacy','reference_edition_id',NULL,'reference_label',NULL,'reference_reason','legacy_unknown_source'); END IF;
 SELECT * INTO e FROM public.exam_editions WHERE status::text IN ('preparing','active')
 ORDER BY CASE status::text WHEN 'preparing' THEN 0 ELSE 1 END,year,term,id LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('mode','empty','reference_reason','no_current_edition'); END IF;
 SELECT count(*) INTO n FROM public.exam_editions WHERE status=e.status AND year=e.year AND term IS NOT DISTINCT FROM e.term;
 IF n<>1 THEN RETURN jsonb_build_object('mode','empty','reference_reason','ambiguous_current_edition'); END IF;
 IF nullif(btrim(e.cutoff_reference_label),'') IS NULL THEN
 RETURN jsonb_build_object('mode','empty','reference_edition_id',e.id,'reference_label',NULL,'reference_reason','unknown_reference'); END IF;
 RETURN jsonb_build_object('mode','reference','reference_edition_id',e.id,'reference_label',e.cutoff_reference_label,'reference_reason','catalog_current');
END $$;
REVOKE ALL ON FUNCTION cutoff_private.reference_context(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_cutoff_scores(p_specialty_id uuid,p_institution_ids uuid[],p_reference_edition_id uuid DEFAULT NULL)
RETURNS TABLE(institution_id uuid,institution_name text,practice_scenario text,specialty_name text,cutoff_score_general numeric,cutoff_score_quota numeric,reference_edition_id uuid,reference_label text,source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ctx jsonb; BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 ctx := cutoff_private.reference_context(p_reference_edition_id);
 IF ctx->>'mode'='legacy' THEN
 RETURN QUERY SELECT DISTINCT ON(t.ord) ei.id,ei.name,cs.practice_scenario,cs.specialty_name,cs.cutoff_score_general,cs.cutoff_score_quota,
 NULL::uuid,NULL::text,cs.source
 FROM unnest(p_institution_ids) WITH ORDINALITY t(id,ord)
 JOIN public.enamed_institutions ei ON ei.id=t.id
 JOIN public.enamed_cutoff_scores cs ON cs.institution_id=t.id AND cs.specialty_id=p_specialty_id
 WHERE cs.reference_edition_id IS NULL ORDER BY t.ord,cs.cutoff_score_general DESC;
 ELSIF ctx->>'mode'='reference' THEN
 RETURN QUERY SELECT ei.id,ei.name,cs.practice_scenario,cs.specialty_name,cs.cutoff_score_general,cs.cutoff_score_quota,
 cs.reference_edition_id,ctx->>'reference_label',cs.source
 FROM public.enamed_cutoff_scores cs JOIN public.enamed_institutions ei ON ei.id=cs.institution_id
 WHERE cs.specialty_id=p_specialty_id AND cs.institution_id=ANY(p_institution_ids)
 AND cs.reference_edition_id=(ctx->>'reference_edition_id')::uuid
 ORDER BY array_position(p_institution_ids,ei.id),cs.practice_scenario;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.get_cutoff_scores(uuid,uuid[],uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_cutoff_scores(uuid,uuid[],uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_user_cutoff_context(p_user_id uuid DEFAULT auth.uid(),p_reference_edition_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ctx jsonb; o record; matches jsonb; unmatched jsonb; stats jsonb; result jsonb; BEGIN
 IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id<>auth.uid() THEN
 RETURN jsonb_build_object('has_target_cutoff',false,'reason','unauthorized'); END IF;
 ctx := cutoff_private.reference_context(p_reference_edition_id);
 IF ctx->>'mode'='legacy' THEN
 result := cutoff_private.legacy_context(p_user_id);
 IF result ? 'matches' THEN
 SELECT coalesce(jsonb_agg(m||jsonb_build_object('reference_edition_id',NULL,'reference_label',NULL,'source',NULL)),'[]') INTO matches FROM jsonb_array_elements(result->'matches') m;
 result := jsonb_set(result,'{matches}',matches);
 END IF;
 RETURN result || ctx;
 END IF;
 SELECT * INTO o FROM public.onboarding_profiles WHERE user_id=p_user_id;
 IF NOT FOUND OR o.status::text<>'completed' THEN
 RETURN jsonb_build_object('has_target_cutoff',false,'reason','no_onboarding','specialty',NULL,'target_institutions',NULL)||ctx; END IF;
 IF (o.specialty_id IS NULL AND nullif(o.specialty,'') IS NULL)
 OR (cardinality(o.target_institution_ids)=0 AND cardinality(o.target_institutions)=0) THEN
 RETURN jsonb_build_object('has_target_cutoff',false,'reason','incomplete_onboarding','specialty',o.specialty,'target_institutions',o.target_institutions)||ctx; END IF;
 WITH targets AS (
 SELECT i.id,i.name AS institution FROM public.enamed_institutions i WHERE i.id=ANY(o.target_institution_ids)
 UNION ALL SELECT NULL::uuid,t FROM unnest(o.target_institutions) t WHERE cardinality(o.target_institution_ids)=0
 ), matched AS (
 SELECT t.institution,cs.* FROM targets t JOIN public.enamed_cutoff_scores cs
 ON (CASE WHEN o.specialty_id IS NOT NULL THEN cs.specialty_id=o.specialty_id ELSE upper(cs.specialty_name)=upper(o.specialty) END)
 AND (CASE WHEN t.id IS NOT NULL THEN cs.institution_id=t.id ELSE
 cs.institution_name ILIKE t.institution OR t.institution ILIKE cs.institution_name
 OR cs.institution_name ILIKE '%'||t.institution||'%' OR t.institution ILIKE '%'||cs.institution_name||'%'
 OR cs.practice_scenario ILIKE '%'||t.institution||'%' END)
 WHERE ctx->>'mode'='reference' AND cs.reference_edition_id=(ctx->>'reference_edition_id')::uuid
 )
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('user_institution',institution,'matched_institution',institution_name,
 'practice_scenario',practice_scenario,'specialty',specialty_name,'cutoff_general',cutoff_score_general,'cutoff_quota',cutoff_score_quota,
 'reference_edition_id',reference_edition_id,'reference_label',ctx->>'reference_label','source',source) ORDER BY institution,practice_scenario) FROM matched),'[]'),
 coalesce((SELECT jsonb_agg(institution) FROM targets t WHERE NOT EXISTS(SELECT 1 FROM matched m WHERE m.institution=t.institution)),'[]'),
 (SELECT CASE WHEN count(*)=0 THEN jsonb_build_object('count',0) ELSE jsonb_build_object('count',count(*),'min',min(cutoff_score_general),'max',max(cutoff_score_general),
 'avg',round(avg(cutoff_score_general),1),'median',round((percentile_cont(0.5) WITHIN GROUP(ORDER BY cutoff_score_general))::numeric,1)) END FROM matched)
 INTO matches,unmatched,stats;
 RETURN jsonb_build_object('has_target_cutoff',jsonb_array_length(matches)>0,'reason',CASE WHEN jsonb_array_length(matches)>0 THEN 'matched' ELSE 'no_match' END,
 'specialty',o.specialty,'target_institutions',o.target_institutions,'matches',matches,'unmatched_institutions',unmatched,'stats',stats)||ctx;
END $$;
REVOKE ALL ON FUNCTION public.get_user_cutoff_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_cutoff_context(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_import_cutoffs(p_reference_edition_id uuid,p_source text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE errors jsonb:='[]'; r jsonb; rownum integer:=0; field text; iid uuid; sid uuid; scenario text;
 general numeric; quota numeric; seats integer; seen text[]:='{}'; seen_program text[]:='{}'; k text; pk text;
 valid_rows jsonb:='[]'; n integer:=0; detail text; BEGIN
 PERFORM public.admin_require('content.manage');
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='P0003'; END IF;
 IF p_source IS NULL OR btrim(p_source)='' THEN errors:=errors||jsonb_build_array(jsonb_build_object('row',0,'field','source','message','Nonempty source required')); END IF;
 IF p_reference_edition_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.exam_editions WHERE id=p_reference_edition_id) THEN
 errors:=errors||jsonb_build_array(jsonb_build_object('row',0,'field','reference_edition_id','message','Known reference required')); END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR p_rows='[]'::jsonb THEN
 errors:=errors||jsonb_build_array(jsonb_build_object('row',0,'field','rows','message','Nonempty array required'));
 RETURN jsonb_build_object('ok',false,'imported',0,'errors',errors); END IF;
 -- Serialize concurrent imports of one reference. Unique indexes remain the last guard.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_reference_edition_id::text,6105));
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 rownum:=rownum+1;
 BEGIN
 field:='row'; IF jsonb_typeof(r)<>'object' THEN RAISE EXCEPTION 'Object required'; END IF;
 field:='institution_id'; iid:=(r->>'institution_id')::uuid;
 IF iid IS NULL OR NOT EXISTS(SELECT 1 FROM public.enamed_institutions WHERE id=iid) THEN RAISE EXCEPTION 'Unknown institution'; END IF;
 field:='specialty_id'; sid:=(r->>'specialty_id')::uuid;
 IF sid IS NULL OR NOT EXISTS(SELECT 1 FROM public.enamed_specialties WHERE id=sid) THEN RAISE EXCEPTION 'Unknown specialty'; END IF;
 field:='practice_scenario'; scenario:=r->>'practice_scenario';
 IF scenario IS NULL OR jsonb_typeof(r->'practice_scenario')<>'string' THEN RAISE EXCEPTION 'Scenario text required (empty allowed)'; END IF;
 field:='cutoff_score_general'; general:=(r->>'cutoff_score_general')::numeric;
 IF general IS NULL OR general::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite score required'; END IF;
 field:='cutoff_score_quota'; quota:=(r->>'cutoff_score_quota')::numeric;
 IF quota::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Finite score required'; END IF;
 field:='vagas'; seats:=(r->>'vagas')::integer;
 IF seats<0 OR (r->>'vagas' IS NOT NULL AND (r->>'vagas')::numeric<>seats) THEN RAISE EXCEPTION 'Nonnegative integer required'; END IF;
 field:='practice_scenario'; k:=jsonb_build_array(iid,sid,scenario)::text; pk:=jsonb_build_array(iid,sid,lower(btrim(scenario)))::text;
 IF k=ANY(seen) OR pk=ANY(seen_program) THEN RAISE EXCEPTION 'Duplicate request key'; END IF;
 seen:=array_append(seen,k); seen_program:=array_append(seen_program,pk);
 IF EXISTS(SELECT 1 FROM public.enamed_cutoff_scores WHERE institution_id=iid AND specialty_id=sid AND practice_scenario=scenario AND reference_edition_id=p_reference_edition_id)
 OR EXISTS(SELECT 1 FROM public.enamed_programs WHERE institution_id=iid AND specialty_id=sid AND lower(btrim(coalesce(cenario_pratica,'')))=lower(btrim(scenario)) AND reference_edition_id=p_reference_edition_id)
 THEN RAISE EXCEPTION 'Reference key already exists'; END IF;
 valid_rows:=valid_rows||jsonb_build_array(jsonb_build_object('institution_id',iid,'specialty_id',sid,'practice_scenario',scenario,'cutoff_score_general',general,'cutoff_score_quota',quota,'vagas',coalesce(seats,0),'row',rownum));
 EXCEPTION WHEN OTHERS THEN
 errors:=errors||jsonb_build_array(jsonb_build_object('row',rownum,'field',field,'message',SQLERRM));
 END;
 END LOOP;
 IF errors<>'[]'::jsonb THEN RETURN jsonb_build_object('ok',false,'imported',0,'errors',errors); END IF;
 -- One subtransaction encloses ALL writes and audit, including mid-insert failures.
 BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(valid_rows) LOOP
 rownum:=(r->>'row')::integer;
 INSERT INTO public.enamed_cutoff_scores(institution_id,specialty_id,institution_name,specialty_name,practice_scenario,cutoff_score_general,cutoff_score_quota,reference_edition_id,source)
 SELECT i.id,s.id,i.name,s.name,r->>'practice_scenario',(r->>'cutoff_score_general')::numeric,(r->>'cutoff_score_quota')::numeric,p_reference_edition_id,p_source
 FROM public.enamed_institutions i CROSS JOIN public.enamed_specialties s WHERE i.id=(r->>'institution_id')::uuid AND s.id=(r->>'specialty_id')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Canonical IDs disappeared'; END IF;
 INSERT INTO public.enamed_programs(institution_id,specialty_id,cenario_pratica,vagas,reference_edition_id,source)
 VALUES((r->>'institution_id')::uuid,(r->>'specialty_id')::uuid,r->>'practice_scenario',(r->>'vagas')::integer,p_reference_edition_id,p_source);
 n:=n+1;
 END LOOP;
 PERFORM public.admin_log_action('IMPORT','enamed_cutoff_scores',p_reference_edition_id,'Cutoffs imported by reference',
 jsonb_build_object('actor_id',auth.uid(),'reference_edition_id',p_reference_edition_id,'source',p_source,'before','[]'::jsonb,'after',valid_rows,'imported',n));
 EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS detail=RETURNED_SQLSTATE;
 RETURN jsonb_build_object('ok',false,'imported',0,'errors',jsonb_build_array(jsonb_build_object('row',rownum,'field','insert','message','Atomic import failed ('||detail||')')));
 END;
 RETURN jsonb_build_object('ok',true,'imported',n,'errors','[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_import_cutoffs(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_cutoffs(uuid,text,jsonb) TO authenticated,service_role;

-- Non-destructive rollback procedure (manual review, never CASCADE): disable
-- editions_ui first, stop imports, inspect dependencies on expanded signatures.
-- Restore originals from cutoff_private.original_functions in one transaction,
-- after DROP FUNCTION ... RESTRICT of expanded readers; restore exact owner/ACL
-- (including PUBLIC entries) from the saved snapshot, NOT default grants.
-- Keep new columns, indexes, reference rows and private snapshots: dropping them
-- loses attribution or changes the old reader's population. Restored legacy SQL
-- MUST retain reference_edition_id IS NULL isolation (or keep these wrappers).
-- Do not execute original unfiltered SQL against newly imported processes.
$cutoff_ddl$;
END;
$cutoff_migration$;
