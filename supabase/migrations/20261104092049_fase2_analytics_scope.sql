-- F2-1/F2-3. Inspected pg_get_functiondef on the F0+F1 model+target
-- catalog enamed_test_f1_target_review_20261104, 2026-11-04 UTC (not the
-- pre-F0 JSON snapshot). No incoming pg_depend rows for the four old RPCs.
-- One DO statement makes this migration atomic, including via psql -f.
DO $migration$
DECLARE
 r record; f oid; ddl text; scoped_attempts text; scoped_notebook text; principal text;
 original_count integer;
BEGIN
 CREATE SCHEMA IF NOT EXISTS analytics_scope_private;
 REVOKE ALL ON SCHEMA analytics_scope_private FROM PUBLIC,anon,authenticated;
 CREATE TABLE IF NOT EXISTS analytics_scope_private.original_functions (
  name text PRIMARY KEY, definition text NOT NULL, owner_name name NOT NULL,
  acl jsonb NOT NULL, applied boolean NOT NULL DEFAULT false
 );
 ALTER TABLE analytics_scope_private.original_functions ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON TABLE analytics_scope_private.original_functions FROM PUBLIC,anon,authenticated;

 FOR r IN SELECT unnest(ARRAY['get_area_score_history','get_user_attempt_behavior_stats',
  'get_caderno_pattern_data','get_confidence_calibration','get_ranking_for_simulado']) AS name LOOP
  IF EXISTS(SELECT FROM analytics_scope_private.original_functions o WHERE o.name=r.name) THEN
   CONTINUE;
  END IF;
  f:=to_regprocedure(format('public.%I(uuid)',r.name));
  IF f IS NULL THEN RAISE EXCEPTION 'Missing original RPC: %',r.name; END IF;
  INSERT INTO analytics_scope_private.original_functions(name,definition,owner_name,acl)
  SELECT r.name,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),
   (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC'
     ELSE pg_get_userbyid(a.grantee) END,'grantable',a.is_grantable))
    FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.privilege_type='EXECUTE')
  FROM pg_proc p WHERE p.oid=f;
 END LOOP;
 SELECT count(*) INTO original_count FROM analytics_scope_private.original_functions;
 IF original_count<>5 THEN RAISE EXCEPTION 'Invalid analytics checkpoint'; END IF;

 -- Inline scopes preserve SECURITY INVOKER on behavior stats and any existing
 -- PRO/auth guards in the saved bodies. No callable helper/ACL bypass is added.
 scoped_attempts:=$scope$(SELECT a.* FROM public.attempts a
   JOIN public.simulados scope_s ON scope_s.id=a.simulado_id
   WHERE auth.uid() IS NOT NULL AND p_user_id=auth.uid() AND a.user_id=p_user_id
     AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL
     AND scope_s.status='published' AND scope_s.results_release_at<=now()
     AND (p_edition_id IS NULL OR scope_s.edition_id=p_edition_id))$scope$;
 scoped_notebook:=$scope$(SELECT scope_en.* FROM public.error_notebook scope_en
   LEFT JOIN public.questions scope_q ON scope_q.id=scope_en.question_id
   WHERE auth.uid() IS NOT NULL AND p_user_id=auth.uid() AND scope_en.user_id=p_user_id
    AND ((p_edition_id IS NULL AND scope_en.simulado_id IS NULL AND scope_en.question_id IS NULL)
      OR EXISTS(SELECT FROM public.simulados scope_s
       WHERE scope_s.id=coalesce(scope_en.simulado_id,scope_q.simulado_id)
        AND (scope_en.question_id IS NULL OR scope_q.simulado_id=scope_s.id)
        AND scope_s.status='published' AND scope_s.results_release_at<=now()
        AND (p_edition_id IS NULL OR scope_s.edition_id=p_edition_id))))$scope$;

 FOR r IN SELECT * FROM analytics_scope_private.original_functions WHERE NOT applied ORDER BY name LOOP
  IF r.name='get_ranking_for_simulado' THEN CONTINUE; END IF;
  f:=to_regprocedure(format('public.%I(uuid)',r.name));
  IF f IS NULL THEN RAISE EXCEPTION 'Missing original RPC before expansion: %',r.name; END IF;
  IF EXISTS(SELECT FROM pg_depend WHERE refclassid='pg_proc'::regclass AND refobjid=f) THEN
   RAISE EXCEPTION 'Incoming dependencies require explicit review: %',r.name;
  END IF;
  ddl:=r.definition;
  IF position('public.attempts' IN ddl)=0 OR position('p_edition_id' IN ddl)>0 THEN
   RAISE EXCEPTION 'Unexpected analytics source definition: %',r.name;
  END IF;
  IF r.name='get_user_attempt_behavior_stats' THEN
   ddl:=replace(ddl,'p_user_id uuid DEFAULT auth.uid())',
    'p_user_id uuid DEFAULT auth.uid(), p_edition_id uuid DEFAULT NULL)');
  ELSE
   ddl:=replace(ddl,'p_user_id uuid)', 'p_user_id uuid, p_edition_id uuid DEFAULT NULL)');
  END IF;
  IF position('p_edition_id uuid DEFAULT NULL' IN ddl)=0 THEN
   RAISE EXCEPTION 'Unrecognized signature: %',r.name;
  END IF;
  ddl:=replace(ddl,'v_uid <> p_user_id','v_uid IS DISTINCT FROM p_user_id');
  ddl:=replace(ddl,'SET search_path TO ''public''','SET search_path TO ''pg_catalog'', ''public''');
  IF r.name='get_area_score_history' THEN
   -- Explicit edition series represents one ranked exam per simulado. NULL
   -- retains cumulative history (including training/multiple modalities).
   ddl:=replace(ddl,'public.attempts',$scope$(SELECT DISTINCT ON
     (CASE WHEN p_edition_id IS NULL THEN a.id ELSE a.simulado_id END) a.*
     FROM public.attempts a JOIN public.simulados scope_s ON scope_s.id=a.simulado_id
     WHERE auth.uid() IS NOT NULL AND p_user_id=auth.uid() AND a.user_id=p_user_id
      AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL
      AND scope_s.status='published' AND scope_s.results_release_at<=now()
      AND (p_edition_id IS NULL OR (scope_s.edition_id=p_edition_id
       AND a.is_within_window=true AND a.score_percentage IS NOT NULL))
     ORDER BY (CASE WHEN p_edition_id IS NULL THEN a.id ELSE a.simulado_id END),
      a.score_percentage DESC NULLS LAST,a.finished_at ASC NULLS LAST,a.id)$scope$);
   ddl:=replace(ddl,'att.status = ''submitted''',
    '(att.status = ''submitted'' OR (p_edition_id IS NOT NULL AND att.status = ''expired''))');
  ELSE
   ddl:=replace(ddl,'public.attempts',scoped_attempts);
  END IF;
  IF r.name='get_caderno_pattern_data' THEN
   IF position('public.error_notebook' IN ddl)=0 THEN RAISE EXCEPTION 'Missing notebook source'; END IF;
   ddl:=replace(ddl,'public.error_notebook',scoped_notebook);
  END IF;
  EXECUTE format('DROP FUNCTION public.%I(uuid) RESTRICT',r.name);
  EXECUTE ddl;
  EXECUTE format('ALTER FUNCTION public.%I(uuid,uuid) OWNER TO %I',r.name,r.owner_name);
  -- Do not let default privileges introduce any principal absent from the
  -- original ACL, including deployment-specific roles unknown to this job.
  FOR principal IN SELECT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
   FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
   WHERE p.oid=to_regprocedure(format('public.%I(uuid,uuid)',r.name)) LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION public.%I(uuid,uuid) FROM %s',r.name,
    CASE WHEN principal='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(principal) END);
  END LOOP;
  -- Carry forward direct EXECUTE grants, never inherit the old accidental
  -- PUBLIC/anon behavior-stats ACL. No newly authorized principal is added.
  FOR f IN SELECT oid FROM pg_roles WHERE rolname IN
   (SELECT x->>'grantee' FROM jsonb_array_elements(r.acl) x)
   AND rolname NOT IN ('anon') LOOP
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(uuid,uuid) TO %I%s',r.name,
    pg_get_userbyid(f),CASE WHEN EXISTS(SELECT FROM jsonb_array_elements(r.acl) x
     WHERE x->>'grantee'=pg_get_userbyid(f) AND (x->>'grantable')::boolean)
     THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
  UPDATE analytics_scope_private.original_functions SET applied=true WHERE name=r.name;
 END LOOP;

 IF EXISTS(SELECT FROM analytics_scope_private.original_functions
  WHERE name='get_ranking_for_simulado' AND NOT applied) THEN
  EXECUTE $ranking$
   CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
   RETURNS TABLE(user_id uuid,simulado_id uuid,nota_final numeric,total_correct integer,
    total_answered integer,finished_at timestamptz,full_name text,segment public.user_segment,
    especialidade text,instituicoes_alvo text[],posicao bigint,total_candidatos bigint)
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
   AS $body$
    WITH best AS (
     SELECT DISTINCT ON (a.user_id) a.id,a.user_id,a.simulado_id,a.score_percentage,
      a.total_correct,a.total_answered,a.finished_at,
      a.specialty_id_at_finish,a.target_institution_ids_at_finish,
      e.status IN ('closed','archived') AS frozen
     FROM public.attempts a
     JOIN public.simulados s ON s.id=a.simulado_id
     LEFT JOIN public.exam_editions e ON e.id=s.edition_id
     WHERE a.simulado_id=p_simulado_id AND auth.uid() IS NOT NULL
      AND s.status='published' AND s.results_release_at<=now()
      AND a.status IN ('submitted','expired') AND a.score_percentage IS NOT NULL
      AND a.is_within_window=true
     ORDER BY a.user_id,a.score_percentage DESC NULLS LAST,a.finished_at ASC NULLS LAST,a.id
    )
    SELECT b.user_id,b.simulado_id,b.score_percentage,b.total_correct,b.total_answered,
     b.finished_at,p.full_name,p.segment,
     CASE WHEN b.frozen THEN frozen_es.name ELSE coalesce(es.name,op.specialty) END,
     CASE WHEN b.frozen THEN
      CASE WHEN b.target_institution_ids_at_finish IS NULL THEN NULL ELSE
       ARRAY(SELECT ei.name FROM unnest(b.target_institution_ids_at_finish)
        WITH ORDINALITY t(id,ord) LEFT JOIN public.enamed_institutions ei ON ei.id=t.id ORDER BY t.ord) END
     ELSE coalesce((SELECT array_agg(ei.name ORDER BY t.ord)
      FROM unnest(op.target_institution_ids) WITH ORDINALITY t(id,ord)
      JOIN public.enamed_institutions ei ON ei.id=t.id),op.target_institutions) END,
     row_number() OVER(ORDER BY b.score_percentage DESC NULLS LAST,b.finished_at ASC NULLS LAST,b.user_id),
     count(*) OVER()
    FROM best b JOIN public.profiles p ON p.id=b.user_id
    LEFT JOIN public.onboarding_profiles op ON op.user_id=b.user_id
    LEFT JOIN public.enamed_specialties es ON es.id=op.specialty_id
    LEFT JOIN public.enamed_specialties frozen_es ON frozen_es.id=b.specialty_id_at_finish
    ORDER BY b.score_percentage DESC NULLS LAST,b.finished_at ASC NULLS LAST,b.user_id
   $body$
  $ranking$;
  -- CREATE OR REPLACE keeps the existing owner and ACL of this same signature.
  UPDATE analytics_scope_private.original_functions SET applied=true WHERE name='get_ranking_for_simulado';
 END IF;

 -- Owner-only rollback. Checkpoint contains definitions/ACL, never learner data.
 -- Reapply never overwrites that checkpoint or replaces already-applied RPCs.
 EXECUTE $rollback$
 CREATE OR REPLACE FUNCTION analytics_scope_private.rollback_analytics_scope()
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public
 AS $body$
 DECLARE r record; a jsonb; principal text; signature text;
 BEGIN
  FOR r IN SELECT * FROM analytics_scope_private.original_functions WHERE applied ORDER BY name LOOP
   IF r.name<>'get_ranking_for_simulado' THEN
    EXECUTE format('DROP FUNCTION public.%I(uuid,uuid) RESTRICT',r.name);
   END IF;
   EXECUTE r.definition;
   signature:=format('public.%I(uuid)',r.name);
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',signature,r.owner_name);
   -- Remove every current grant, including additions since the checkpoint.
   FOR principal IN SELECT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
    FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
    WHERE p.oid=to_regprocedure(signature) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',signature,
     CASE WHEN principal='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(principal) END);
   END LOOP;
   FOR a IN SELECT * FROM jsonb_array_elements(r.acl) LOOP
    principal:=a->>'grantee';
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s%s',signature,
     CASE WHEN principal='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(principal) END,
     CASE WHEN (a->>'grantable')::boolean THEN ' WITH GRANT OPTION' ELSE '' END);
   END LOOP;
   UPDATE analytics_scope_private.original_functions SET applied=false WHERE name=r.name;
  END LOOP;
 END
 $body$
 $rollback$;
 REVOKE ALL ON FUNCTION analytics_scope_private.rollback_analytics_scope() FROM PUBLIC,anon,authenticated,service_role;
END
$migration$;

-- Manual rollback, privileged maintenance transaction ONLY after dependency review:
-- BEGIN;
-- SELECT analytics_scope_private.rollback_analytics_scope();
-- COMMIT;
-- Restores exact original definitions/owners/ACL, including any original defects.
-- Keeps the private checkpoint for reapply. No data delete/update, no CASCADE.
