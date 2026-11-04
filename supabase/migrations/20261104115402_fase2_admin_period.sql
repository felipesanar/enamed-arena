-- F2-4: deliberately fail closed on baseline drift. Definitions were compared
-- with the read-only production snapshot (2026-11-04), then pg_get_functiondef
-- in the F0+F1 disposable catalog. No production connection is needed here.
BEGIN;

CREATE SCHEMA IF NOT EXISTS admin_period_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA admin_period_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS admin_period_private.checkpoints (
  name text PRIMARY KEY,
  original_identity text NOT NULL,
  expanded_identity text NOT NULL,
  original_definition text NOT NULL,
  original_owner name NOT NULL,
  acl_sql text NOT NULL,
  installed_md5 text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE admin_period_private.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_period_private.checkpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON admin_period_private.checkpoints FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  baseline record; fn record; entry record;
  definition text; expanded text; identity_old text; identity_new text; grants text;
  -- Source filtering happens BEFORE each aggregation, latest selection or limit.
  attempts_source text := $sql$(SELECT ap.* FROM public.attempts ap
    JOIN public.simulados sp ON sp.id=ap.simulado_id
    WHERE (p_edition_id IS NULL OR sp.edition_id=p_edition_id)
      AND (p_start_at IS NULL OR coalesce(ap.started_at,ap.created_at)>=p_start_at)
      AND (p_end_at IS NULL OR coalesce(ap.started_at,ap.created_at)<p_end_at))$sql$;
  history_source text;
  profile_source text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('fase2_admin_period'));
  IF (SELECT nspowner<> 'postgres'::regrole FROM pg_namespace WHERE nspname='admin_period_private')
    OR (SELECT relowner<> 'postgres'::regrole FROM pg_class WHERE oid='admin_period_private.checkpoints'::regclass) THEN
    RAISE EXCEPTION 'unexpected checkpoint owner';
  END IF;
  IF EXISTS (SELECT FROM admin_period_private.checkpoints) THEN
    IF (SELECT count(*) FROM admin_period_private.checkpoints)=7
      AND NOT EXISTS (SELECT FROM admin_period_private.checkpoints WHERE NOT active) THEN
      -- Never replay definitions over a later migration, or overwrite the backup.
      RETURN;
    END IF;
    RAISE EXCEPTION 'partial or rolled-back checkpoint: manual review required';
  END IF;

  history_source := format($sql$(SELECT hp.* FROM public.user_performance_history hp
    JOIN %s ha ON ha.id=hp.attempt_id AND ha.simulado_id=hp.simulado_id)$sql$,attempts_source);
  profile_source := format($sql$(SELECT pp.* FROM public.profiles pp WHERE
    (p_edition_id IS NULL AND p_start_at IS NULL AND p_end_at IS NULL)
    OR (p_edition_id IS NOT NULL AND EXISTS (SELECT FROM public.onboarding_profiles op
      WHERE op.user_id=pp.id AND op.target_edition_id=p_edition_id))
    OR (p_edition_id IS NULL
      AND (p_start_at IS NULL OR pp.created_at>=p_start_at)
      AND (p_end_at IS NULL OR pp.created_at<p_end_at))
    OR EXISTS (SELECT FROM %s pa WHERE pa.user_id=pp.id))$sql$,attempts_source);

  FOR baseline IN SELECT * FROM (VALUES
    ('admin_cohort_retention','4f73e753fe59d09c82ece7e6a374c470'),
    ('admin_intel_insights','a442f1406f3c4e157ac30a07a2610849'),
    ('admin_performance_by_area','0e66bc4a29210fa38d0816406e8a90b5'),
    ('admin_performance_by_theme','fdbb926fb06a27f371cec795d2488f5a'),
    ('admin_score_distribution','70f8ac0fd81b5467c31767072635b57b'),
    ('admin_score_evolution','90eb43f9d1a88062377851cb3362f890'),
    ('admin_segment_breakdown','0326435149d8f54dd1b56c14a87283a7')
  ) AS b(name,expected_md5) LOOP
    IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=baseline.name)<>1 THEN
      RAISE EXCEPTION 'missing or ambiguous baseline: %',baseline.name;
    END IF;
    SELECT p.*,pg_get_functiondef(p.oid) AS ddl,pg_get_userbyid(p.proowner) AS owner_name
      INTO STRICT fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=baseline.name;
    IF md5(fn.ddl)<>baseline.expected_md5 THEN
      RAISE EXCEPTION 'definition drift: %',baseline.name;
    END IF;
    identity_old := format('public.%I(%s)',baseline.name,oidvectortypes(fn.proargtypes));
    identity_new := format('public.%I(%s%suuid, timestamp with time zone, timestamp with time zone)',
      baseline.name,oidvectortypes(fn.proargtypes),CASE WHEN fn.pronargs=0 THEN '' ELSE ', ' END);
    grants := 'REVOKE ALL ON FUNCTION @FUNCTION@ FROM PUBLIC;';
    FOR entry IN SELECT a.*,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS recipient
      FROM aclexplode(coalesce(fn.proacl,acldefault('f',fn.proowner))) a LOOP
      grants := grants || format(' GRANT %s ON FUNCTION @FUNCTION@ TO %s%s;',entry.privilege_type,entry.recipient,
        CASE WHEN entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END LOOP;

    definition := fn.ddl;
    -- Only the first line (the input signature) is expanded; all old defaults stay.
    expanded := regexp_replace(definition,'\)\n RETURNS',
      CASE WHEN fn.pronargs=0 THEN '' ELSE ', ' END ||
      'p_edition_id uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone)' || chr(10) || ' RETURNS');
    expanded := replace(expanded, 'perform public.admin_require(''intel.view'');',
      $sql$perform public.admin_require('intel.view');
  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_start_at>=p_end_at THEN
    RAISE EXCEPTION 'p_start_at must be before p_end_at' USING ERRCODE='22023';
  END IF;$sql$);
    expanded := regexp_replace(expanded,'\m(from|join) attempts a\M','\1 '||attempts_source||' a','g');
    expanded := replace(expanded,'from user_performance_history h','from '||history_source||' h');
    expanded := replace(expanded,'from profiles p','from '||profile_source||' p');
    expanded := replace(expanded,'join questions q',
      'join (SELECT qp.* FROM public.questions qp JOIN public.simulados sq ON sq.id=qp.simulado_id ' ||
      'WHERE p_edition_id IS NULL OR sq.edition_id=p_edition_id) q');

    IF baseline.name='admin_cohort_retention' THEN
      expanded := replace(expanded,
        'and p.created_at >= (date_trunc(''month'', (now() at time zone ''America/Sao_Paulo'')) - ((p_months - 1) || '' months'')::interval)',
        'and (p_start_at IS NOT NULL OR p_end_at IS NOT NULL OR p.created_at >= (date_trunc(''month'', (now() at time zone ''America/Sao_Paulo'')) - ((p_months - 1) || '' months'')::interval))');
    ELSIF baseline.name='admin_score_evolution' THEN
      expanded := replace(expanded,'cutoff_proxy numeric)','cutoff_proxy numeric, edition_id uuid, edition_code text, edition_label text)');
      expanded := replace(expanded,'as cutoff_proxy','as cutoff_proxy, e.id, e.code, e.label');
      expanded := replace(expanded,'join simulados s on s.id = h.simulado_id',
        'join simulados s on s.id = h.simulado_id join public.exam_editions e on e.id=s.edition_id');
      expanded := replace(expanded,'group by s.id, s.sequence_number, s.title',
        'group by s.id, s.sequence_number, s.title, e.id, e.code, e.label');
      expanded := replace(expanded,'order by s.sequence_number;',
        'order by e.year, e.term NULLS FIRST, e.id, s.sequence_number, s.id;');
    ELSIF baseline.name='admin_intel_insights' THEN
      -- No SQL error is converted into an apparently healthy empty report.
      expanded := replace(expanded,'exception when others then null;','');
      -- Compare only a single edition in the scoped history, even for NULL callers.
      expanded := replace(expanded,'-- ===== score_decline / participation_drop =====',
        '-- ===== score_decline / participation_drop =====' || chr(10) || format($sql$
  IF (SELECT count(DISTINCT si.edition_id) FROM %s hi
      JOIN public.simulados si ON si.id=hi.simulado_id)<=1 THEN$sql$,history_source));
      expanded := replace(expanded,'-- ===== high_abandonment + integrity_spike (30d) =====',
        'END IF;' || chr(10) || '-- ===== high_abandonment + integrity_spike (30d) =====');
      expanded := replace(expanded,'where a.created_at >= now() - interval ''30 days''',
        'where (p_start_at IS NOT NULL OR p_end_at IS NOT NULL OR a.created_at >= now() - interval ''30 days'')');
      expanded := replace(expanded,'date_trunc(''month'', p.created_at)',
        'date_trunc(''month'', p.created_at at time zone ''America/Sao_Paulo'')');
      expanded := replace(expanded,'where date_trunc(''month'', p.created_at at time zone ''America/Sao_Paulo'')::date <= date_trunc(''month'', now() - interval ''30 days'')::date',
        'where (p_start_at IS NOT NULL OR p_end_at IS NOT NULL OR date_trunc(''month'', p.created_at at time zone ''America/Sao_Paulo'')::date <= date_trunc(''month'', now() - interval ''30 days'')::date)');
    END IF;
    EXECUTE 'DROP FUNCTION '||identity_old||' RESTRICT';
    EXECUTE expanded;
    -- CREATE FUNCTION can inherit role-specific ALTER DEFAULT PRIVILEGES.
    -- Clear those too, then replay precisely the captured function ACL.
    FOR entry IN SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS recipient
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=to_regprocedure(identity_new) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',identity_new,entry.recipient);
    END LOOP;
    EXECUTE replace(grants,'@FUNCTION@',identity_new);
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I',identity_new,fn.owner_name);
    INSERT INTO admin_period_private.checkpoints(name,original_identity,expanded_identity,original_definition,original_owner,acl_sql,installed_md5)
      VALUES (baseline.name,identity_old,identity_new,definition,fn.owner_name,grants,
        md5(pg_get_functiondef(to_regprocedure(identity_new))));
    -- Local fault injection: transaction rollback must undo even prior iterations.
    IF current_setting('test.admin_period_fail_after',true)=baseline.name THEN
      RAISE EXCEPTION 'admin period migration fault injection';
    END IF;
  END LOOP;
END
$migration$;

-- Private, invoker-only recovery. RESTRICT prevents destroying dependencies;
-- hashes prevent undoing a subsequent migration. No business rows are touched.
DO $install_recovery$ BEGIN
IF to_regprocedure('admin_period_private.rollback_admin_period()') IS NULL THEN
EXECUTE $ddl$CREATE PROCEDURE admin_period_private.rollback_admin_period()
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
DECLARE c record; entry record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('fase2_admin_period'));
  IF session_user<>'postgres' THEN RAISE EXCEPTION 'postgres recovery only' USING ERRCODE='42501'; END IF;
  FOR c IN SELECT * FROM admin_period_private.checkpoints WHERE active ORDER BY name LOOP
    IF to_regprocedure(c.expanded_identity) IS NULL OR md5(pg_get_functiondef(to_regprocedure(c.expanded_identity)))<>c.installed_md5 THEN
      RAISE EXCEPTION 'later definition or missing function: %',c.name;
    END IF;
  END LOOP;
  FOR c IN SELECT * FROM admin_period_private.checkpoints WHERE active ORDER BY name LOOP
    EXECUTE 'DROP FUNCTION '||c.expanded_identity||' RESTRICT';
    EXECUTE c.original_definition;
    FOR entry IN SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS recipient
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=to_regprocedure(c.original_identity) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',c.original_identity,entry.recipient);
    END LOOP;
    EXECUTE replace(c.acl_sql,'@FUNCTION@',c.original_identity);
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I',c.original_identity,c.original_owner);
    UPDATE admin_period_private.checkpoints SET active=false WHERE name=c.name;
  END LOOP;
END $$ $ddl$;
END IF;
END $install_recovery$;
REVOKE ALL ON PROCEDURE admin_period_private.rollback_admin_period() FROM PUBLIC, anon, authenticated, service_role;
COMMIT;

-- rollback (explicit, reviewed, transactional, preserves checkpoint and data):
-- BEGIN;
-- CALL admin_period_private.rollback_admin_period();
-- COMMIT;
