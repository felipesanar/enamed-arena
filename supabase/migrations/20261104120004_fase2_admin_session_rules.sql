-- F2-4 server rules. No historical backfill/finalization or academic snapshot changes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS admin_session_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA admin_session_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS admin_session_private.definitions (
 name text PRIMARY KEY, definition text NOT NULL, installed_hash text,
 owner_name text NOT NULL, grants text[] NOT NULL
);
ALTER TABLE admin_session_private.definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_session_private.definitions FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION admin_session_private.original_checkpoint_matches(p_name text,p_oid oid)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT md5(pg_get_functiondef(p.oid))=md5(c.definition) AND pg_get_userbyid(p.proowner)=c.owner_name
 AND (SELECT array_agg(g ORDER BY g) FROM unnest(c.grants) g) =
 (SELECT array_agg(g ORDER BY g) FROM (
  SELECT format('GRANT EXECUTE ON FUNCTION @SIGNATURE@ TO %s%s',
   CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
   CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) AS g
  FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.privilege_type='EXECUTE'
 ) acl)
 FROM pg_proc p JOIN admin_session_private.definitions c ON c.name=p_name WHERE p.oid=p_oid;
$$;
REVOKE ALL ON FUNCTION admin_session_private.original_checkpoint_matches(text,oid) FROM PUBLIC,anon,authenticated,service_role;

-- Lock the parent BEFORE reading dates. The FK's later KEY SHARE is too late:
-- without this a creator could insert old eligibility after a window commit.
DO $creation_locks$
DECLARE n text; expected text; d text; patched text; r record;
BEGIN
 FOR n,expected IN SELECT * FROM (VALUES
  ('create_attempt_guarded','497d199d85476096e6c8848afe4f9ff5'),
  ('create_offline_attempt_guarded','69013983c813e0119c6a66d2e09b7118'),
  ('create_presencial_attempt_guarded','1c5505edf0c92d43dc70872254e6b9d0'),
  ('create_or_convert_presencial_attempt','1a9dbe9649383f0e794379e6c40b4d98')) v LOOP
  SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS def,
   pg_get_userbyid(p.proowner) AS owner_name,p.oid INTO STRICT r
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=n;
  d:=r.def;
  IF EXISTS(SELECT 1 FROM admin_session_private.definitions WHERE name=n AND installed_hash IS NULL)
  AND NOT admin_session_private.original_checkpoint_matches(n,r.oid) THEN RAISE EXCEPTION 'Restored creation definition/owner/ACL drift: %',n; END IF;
  IF EXISTS(SELECT 1 FROM admin_session_private.definitions WHERE name=n AND installed_hash IS NOT NULL) THEN
   IF md5(d) IS DISTINCT FROM (SELECT installed_hash FROM admin_session_private.definitions WHERE name=n) THEN
    RAISE EXCEPTION 'Creation function drift: %',n;
   END IF;
   CONTINUE;
  END IF;
  IF md5(d)<>expected AND NOT(n='create_attempt_guarded' AND md5(d)='0ffec1604ccad2e99d486b09f51a1bdb') THEN
   RAISE EXCEPTION 'Unreviewed creation baseline: % (%)',n,md5(d);
  END IF;
  IF (SELECT count(*) FROM regexp_matches(d,$re$WHERE id\s*=\s*p_simulado_id AND status IN \('published',\s*'test'\);$re$,'g'))<>1 THEN
   RAISE EXCEPTION 'Missing/duplicate creation parent lookup: %',n;
  END IF;
  INSERT INTO admin_session_private.definitions(name,definition,owner_name,grants)
  SELECT n,d,r.owner_name,coalesce(array_agg(format('GRANT EXECUTE ON FUNCTION @SIGNATURE@ TO %s%s',
    CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl.grantee)) END,
    CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)),ARRAY[]::text[])
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
  WHERE p.oid=r.oid AND acl.privilege_type='EXECUTE'
  ON CONFLICT(name) DO NOTHING;
  patched:=regexp_replace(d,$re$(WHERE id\s*=\s*p_simulado_id AND status IN \('published',\s*'test'\));$re$,'\1 FOR SHARE;');
  EXECUTE patched; -- same signature: CREATE OR REPLACE preserves ACL/owner
  UPDATE admin_session_private.definitions SET installed_hash=md5(pg_get_functiondef(r.oid)) WHERE name=n;
 END LOOP;
END $creation_locks$;

ALTER TABLE public.presencial_sessions ADD COLUMN IF NOT EXISTS ranking_rule text NOT NULL DEFAULT 'legacy_online_window';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.presencial_sessions'::regclass AND conname='presencial_sessions_ranking_rule_check') THEN
  ALTER TABLE public.presencial_sessions ADD CONSTRAINT presencial_sessions_ranking_rule_check
   CHECK (ranking_rule IN ('legacy_online_window','session_window_v1'));
 END IF;
END $$;

-- Not columns on attempts: existing authenticated UPDATE grants cannot mutate
-- provenance, and no private student payload is exposed through PostgREST.
CREATE TABLE IF NOT EXISTS admin_session_private.attempt_rules (
 attempt_id uuid PRIMARY KEY REFERENCES public.attempts(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, simulado_id uuid NOT NULL,
 rule_version integer NOT NULL DEFAULT 1 CHECK(rule_version=1),
 ranking_rule text NOT NULL CHECK(ranking_rule IN ('legacy_online_window','session_window_v1')),
 opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL CHECK(opens_at<closes_at),
 checked_in_at timestamptz NOT NULL,
 CHECK(checked_in_at BETWEEN opens_at AND closes_at)
);
CREATE TABLE IF NOT EXISTS admin_session_private.submission_rules (
 submission_id uuid PRIMARY KEY REFERENCES public.presencial_submissions(id) ON DELETE CASCADE,
 session_id uuid NOT NULL, simulado_id uuid NOT NULL,
 rule_version integer NOT NULL DEFAULT 1 CHECK(rule_version=1),
 ranking_rule text NOT NULL CHECK(ranking_rule IN ('legacy_online_window','session_window_v1')),
 opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL CHECK(opens_at<closes_at),
 checked_in_at timestamptz NOT NULL CHECK(checked_in_at BETWEEN opens_at AND closes_at)
);
ALTER TABLE admin_session_private.attempt_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session_private.submission_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_session_private.attempt_rules,admin_session_private.submission_rules FROM PUBLIC,anon,authenticated,service_role;
-- Approved auxiliary lifecycle only; no changes to any F0 academic RESTRICT FK.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='admin_session_private.attempt_rules'::regclass AND conname='attempt_rules_attempt_id_fkey' AND confdeltype<>'c') THEN
  ALTER TABLE admin_session_private.attempt_rules DROP CONSTRAINT attempt_rules_attempt_id_fkey;
  ALTER TABLE admin_session_private.attempt_rules ADD CONSTRAINT attempt_rules_attempt_id_fkey FOREIGN KEY(attempt_id) REFERENCES public.attempts(id) ON DELETE CASCADE;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='admin_session_private.submission_rules'::regclass AND conname='submission_rules_submission_id_fkey' AND confdeltype<>'c') THEN
  ALTER TABLE admin_session_private.submission_rules DROP CONSTRAINT submission_rules_submission_id_fkey;
  ALTER TABLE admin_session_private.submission_rules ADD CONSTRAINT submission_rules_submission_id_fkey FOREIGN KEY(submission_id) REFERENCES public.presencial_submissions(id) ON DELETE CASCADE;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_or_convert_presencial_attempt_for_session(p_simulado_id uuid,p_user_id uuid,p_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.presencial_sessions%ROWTYPE; a uuid; r admin_session_private.attempt_rules%ROWTYPE; was_presencial boolean;
BEGIN
 -- Serialize same-user check-ins before the old two-arg converter, including
 -- its no-row path. No global lock or service identity is used as a JWT actor.
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_simulado_id::text||':'||p_user_id::text,4104));
 SELECT * INTO s FROM public.presencial_sessions WHERE id=p_session_id FOR SHARE;
 IF NOT FOUND OR s.simulado_id IS DISTINCT FROM p_simulado_id OR NOT s.is_active
 OR now()<s.opens_at OR now()>s.closes_at THEN
  RAISE EXCEPTION 'SESSION_NOT_VALID_FOR_CHECKIN' USING ERRCODE='22023';
 END IF;
 -- Exclude even legacy two-arg creators (their first parent read is SHARE).
 -- NOWAIT on attempts avoids inversion with finalizers/answer saves.
 PERFORM 1 FROM public.simulados WHERE id=p_simulado_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.attempts WHERE simulado_id=p_simulado_id AND user_id=p_user_id ORDER BY id FOR UPDATE NOWAIT;
 SELECT EXISTS(SELECT 1 FROM public.attempts WHERE simulado_id=p_simulado_id AND user_id=p_user_id AND attempt_type='presencial') INTO was_presencial;
 a:=public.create_or_convert_presencial_attempt(p_simulado_id,p_user_id);
 PERFORM 1 FROM public.attempts WHERE id=a FOR UPDATE;
 SELECT * INTO r FROM admin_session_private.attempt_rules WHERE attempt_id=a;
 IF FOUND THEN
  IF r.session_id<>s.id OR r.simulado_id<>s.simulado_id THEN
   RAISE EXCEPTION 'ATTEMPT_SESSION_FROZEN' USING ERRCODE='23514';
  END IF;
 ELSIF NOT was_presencial THEN
  INSERT INTO admin_session_private.attempt_rules(attempt_id,session_id,simulado_id,ranking_rule,opens_at,closes_at,checked_in_at)
  VALUES(a,s.id,s.simulado_id,s.ranking_rule,s.opens_at,s.closes_at,now());
 END IF;
 RETURN a;
END $$;
ALTER FUNCTION public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION admin_session_private.capture_submission_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.presencial_sessions%ROWTYPE; r admin_session_private.attempt_rules%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.session_id,NEW.simulado_id) IS DISTINCT FROM ROW(OLD.session_id,OLD.simulado_id) THEN
   RAISE EXCEPTION 'SUBMISSION_SESSION_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO s FROM public.presencial_sessions WHERE id=NEW.session_id FOR SHARE;
 IF NOT FOUND OR s.simulado_id IS DISTINCT FROM NEW.simulado_id OR NOT s.is_active
 OR now()<s.opens_at OR now()>s.closes_at THEN
  RAISE EXCEPTION 'SESSION_NOT_VALID_FOR_SUBMISSION' USING ERRCODE='23514';
 END IF;
 IF NEW.linked_attempt_id IS NOT NULL THEN
  PERFORM 1 FROM public.attempts WHERE id=NEW.linked_attempt_id
   AND simulado_id=NEW.simulado_id AND user_id=NEW.linked_user_id AND attempt_type='presencial' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBMISSION_ATTEMPT_MISMATCH' USING ERRCODE='23514'; END IF;
  SELECT * INTO r FROM admin_session_private.attempt_rules WHERE attempt_id=NEW.linked_attempt_id;
  IF FOUND AND (r.session_id<>s.id OR r.simulado_id<>s.simulado_id) THEN
   RAISE EXCEPTION 'ATTEMPT_SESSION_FROZEN' USING ERRCODE='23514';
  END IF;
 END IF;
 INSERT INTO admin_session_private.submission_rules(submission_id,session_id,simulado_id,ranking_rule,opens_at,closes_at,checked_in_at)
 VALUES(NEW.id,s.id,s.simulado_id,coalesce(r.ranking_rule,s.ranking_rule),coalesce(r.opens_at,s.opens_at),coalesce(r.closes_at,s.closes_at),coalesce(r.checked_in_at,now()));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION admin_session_private.capture_submission_rule() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS admin_session_submission_rule ON public.presencial_submissions;
CREATE TRIGGER admin_session_submission_rule AFTER INSERT OR UPDATE ON public.presencial_submissions
FOR EACH ROW EXECUTE FUNCTION admin_session_private.capture_submission_rule();

CREATE OR REPLACE FUNCTION admin_session_private.propagate_submission_rule(p_submission_id uuid,p_attempt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s admin_session_private.submission_rules%ROWTYPE; r admin_session_private.attempt_rules%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.attempts WHERE id=p_attempt_id FOR UPDATE;
 SELECT * INTO s FROM admin_session_private.submission_rules WHERE submission_id=p_submission_id;
 IF NOT FOUND THEN RETURN; END IF; -- historical, never resnapshot at late link
 IF NOT EXISTS(SELECT 1 FROM public.presencial_submissions sub JOIN public.attempts a ON a.id=p_attempt_id
  WHERE sub.id=p_submission_id AND sub.simulado_id=s.simulado_id AND sub.session_id=s.session_id AND a.simulado_id=s.simulado_id AND a.attempt_type='presencial') THEN
  RAISE EXCEPTION 'SUBMISSION_SNAPSHOT_MISMATCH' USING ERRCODE='23514';
 END IF;
 SELECT * INTO r FROM admin_session_private.attempt_rules WHERE attempt_id=p_attempt_id;
 IF FOUND THEN
  IF ROW(r.session_id,r.simulado_id,r.ranking_rule,r.opens_at,r.closes_at,r.checked_in_at)
   IS DISTINCT FROM ROW(s.session_id,s.simulado_id,s.ranking_rule,s.opens_at,s.closes_at,s.checked_in_at) THEN
   RAISE EXCEPTION 'ATTEMPT_SESSION_FROZEN' USING ERRCODE='23514';
  END IF;
 ELSE
  INSERT INTO admin_session_private.attempt_rules(attempt_id,session_id,simulado_id,rule_version,ranking_rule,opens_at,closes_at,checked_in_at)
  VALUES(p_attempt_id,s.session_id,s.simulado_id,s.rule_version,s.ranking_rule,s.opens_at,s.closes_at,s.checked_in_at);
 END IF;
END $$;
REVOKE ALL ON FUNCTION admin_session_private.propagate_submission_rule(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION admin_session_private.presencial_eligible(p_attempt_id uuid,p_submitted_at timestamptz,p_start timestamptz,p_end timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r admin_session_private.attempt_rules%ROWTYPE;
BEGIN
 SELECT * INTO r FROM admin_session_private.attempt_rules WHERE attempt_id=p_attempt_id;
 IF FOUND AND r.ranking_rule='session_window_v1' THEN
  RETURN coalesce(r.checked_in_at BETWEEN r.opens_at AND r.closes_at
   AND p_submitted_at BETWEEN r.opens_at AND r.closes_at
   AND EXISTS(SELECT 1 FROM public.attempts a WHERE a.id=r.attempt_id AND a.simulado_id=r.simulado_id AND a.attempt_type='presencial'),false);
 END IF;
 RETURN coalesce(p_submitted_at BETWEEN p_start AND p_end,false);
END $$;
REVOKE ALL ON FUNCTION admin_session_private.presencial_eligible(uuid,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

-- Patch the CURRENT local baseline only. Count/hash gates fail closed on drift.
-- Capture owner/ACL before replacing signatures, and restore them verbatim.
DO $patch$
DECLARE n text; d text; original text; sig text; expected text; r record; g text; new_sig text;
BEGIN
 FOR n,expected IN SELECT * FROM (VALUES
 ('admin_presencial_session_upsert','acdf463aaf3a1eb027f5ce929cfa133f'),
 ('admin_presencial_sessions_list','e1c90d5b873d1513e518c6b803aa698e'),
 ('submit_presencial_answers','6031e78f20a792809c6094993923b259'),
 ('link_presencial_submission','71457f0a82d5627b7bad04abe838f3f8')) v LOOP
  SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS def,pg_get_userbyid(p.proowner) AS owner_name,p.oid
   INTO STRICT r FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=n;
  d:=r.def; sig:=r.signature;
  IF EXISTS(SELECT 1 FROM admin_session_private.definitions WHERE name=n AND installed_hash IS NULL)
  AND NOT admin_session_private.original_checkpoint_matches(n,r.oid) THEN RAISE EXCEPTION 'Restored definition/owner/ACL drift: %',n; END IF;
  IF EXISTS(SELECT 1 FROM admin_session_private.definitions c WHERE c.name=n AND c.installed_hash IS NOT NULL) THEN
   IF md5(d) IS DISTINCT FROM (SELECT installed_hash FROM admin_session_private.definitions WHERE name=n) THEN
    RAISE EXCEPTION 'Installed function drift: %',n;
   END IF;
   CONTINUE;
  END IF;
  IF md5(d)<>expected THEN RAISE EXCEPTION 'Unreviewed baseline: % (%)',n,md5(d); END IF;
  INSERT INTO admin_session_private.definitions(name,definition,owner_name,grants)
  SELECT n,d,r.owner_name,coalesce(array_agg(format('GRANT EXECUTE ON FUNCTION @SIGNATURE@ TO %s%s',
    CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(acl.grantee)) END,
    CASE WHEN acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)),ARRAY[]::text[])
  FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
  WHERE p.oid=r.oid AND acl.privilege_type='EXECUTE'
  ON CONFLICT(name) DO NOTHING;
  original:=d;
  IF n='admin_presencial_session_upsert' THEN
   d:=replace(d,'p_caderno_id uuid DEFAULT NULL::uuid)','p_caderno_id uuid DEFAULT NULL::uuid, p_ranking_rule text DEFAULT NULL::text)');
   d:=replace(d,'  v_id uuid;','  v_id uuid; v_before jsonb; v_after jsonb;');
   d:=replace(d,'  -- Um caderno',E'  IF p_opens_at IS NULL OR p_closes_at IS NULL OR p_opens_at>=p_closes_at THEN RAISE EXCEPTION ''INVALID_SESSION_WINDOW'' USING ERRCODE=''22023''; END IF;\n  SELECT jsonb_build_object(''ranking_rule'',ranking_rule,''opens_at'',opens_at,''closes_at'',closes_at) INTO v_before FROM public.presencial_sessions WHERE id=p_id FOR UPDATE;\n  -- Um caderno');
   d:=replace(d,'is_active, caderno_id)','is_active, caderno_id, ranking_rule)');
   d:=replace(d,'p_is_active, p_caderno_id)','p_is_active, p_caderno_id, coalesce(p_ranking_rule,''legacy_online_window''))');
   d:=replace(d,'caderno_id  = p_caderno_id','ranking_rule = coalesce(p_ranking_rule, ranking_rule), caderno_id  = p_caderno_id');
   d:=replace(d,E'  BEGIN\n    PERFORM public.admin_log_action(',E'  SELECT jsonb_build_object(''ranking_rule'',ranking_rule,''opens_at'',opens_at,''closes_at'',closes_at) INTO v_after FROM public.presencial_sessions WHERE id=v_id;\n    PERFORM public.admin_log_action(');
   d:=replace(d,$old$jsonb_build_object('code', p_code, 'simulado_id', p_simulado_id, 'is_active', p_is_active, 'caderno_id', p_caderno_id)$old$,$new$jsonb_build_object('before',v_before,'after',v_after,'diff',jsonb_build_object('ranking_rule',jsonb_build_object('before',v_before->'ranking_rule','after',v_after->'ranking_rule'),'opens_at',jsonb_build_object('before',v_before->'opens_at','after',v_after->'opens_at'),'closes_at',jsonb_build_object('before',v_before->'closes_at','after',v_after->'closes_at')))$new$);
   d:=replace(d,'  EXCEPTION WHEN OTHERS THEN NULL; END;','');
   EXECUTE 'DROP FUNCTION '||sig;
   new_sig:='public.admin_presencial_session_upsert(uuid,uuid,text,text,timestamptz,timestamptz,boolean,uuid,text)';
  ELSIF n='admin_presencial_sessions_list' THEN
   d:=replace(d,'caderno_color text)','caderno_color text, ranking_rule text)');
   d:=replace(d,'ps.caderno_id, c.label, c.color'||chr(10)||'  FROM','ps.caderno_id, c.label, c.color, ps.ranking_rule'||chr(10)||'  FROM');
   EXECUTE 'DROP FUNCTION '||sig;
   new_sig:=sig;
  ELSIF n='submit_presencial_answers' THEN
   d:=replace(d,'(v_now >= v_simulado.execution_window_start'||chr(10)||'              AND v_now <= v_simulado.execution_window_end)',
    'admin_session_private.presencial_eligible(p_attempt_id,v_now,v_simulado.execution_window_start,v_simulado.execution_window_end)');
   new_sig:=sig;
  ELSE
   d:=replace(d,'  v_res     := public.submit_presencial_answers',E'  PERFORM admin_session_private.propagate_submission_rule(p_submission_id,v_attempt);\n  v_res     := public.submit_presencial_answers');
   d:=replace(d,'(v_sub.submitted_at >= v_simulado.execution_window_start'||chr(10)||'              AND v_sub.submitted_at <= v_simulado.execution_window_end)',
    'admin_session_private.presencial_eligible(v_attempt,v_sub.submitted_at,v_simulado.execution_window_start,v_simulado.execution_window_end)');
   new_sig:=sig;
  END IF;
  IF d=original THEN RAISE EXCEPTION 'Empty patch: %',n; END IF;
  EXECUTE d;
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',new_sig,r.owner_name);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',new_sig);
  FOR g IN SELECT unnest(grants) FROM admin_session_private.definitions WHERE name=n LOOP
   EXECUTE replace(g,'@SIGNATURE@',new_sig);
  END LOOP;
  UPDATE admin_session_private.definitions SET installed_hash=md5(pg_get_functiondef(new_sig::regprocedure)) WHERE name=n;
 END LOOP;
END $patch$;

CREATE TABLE IF NOT EXISTS admin_session_private.window_operations (
 operation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), simulado_id uuid NOT NULL,
 actor_id uuid NOT NULL, reason text NOT NULL, old_window jsonb NOT NULL,new_window jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_session_private.window_attempt_changes (
 operation_id uuid NOT NULL REFERENCES admin_session_private.window_operations(operation_id),
 attempt_id uuid NOT NULL, previous_flag boolean, target_flag boolean NOT NULL,
 PRIMARY KEY(operation_id,attempt_id)
);
ALTER TABLE admin_session_private.window_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session_private.window_attempt_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_session_private.window_operations,admin_session_private.window_attempt_changes FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION admin_session_private.window_hash(s public.simulados)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT md5(coalesce(extract(epoch FROM s.execution_window_start)::text,'null')||'/'||coalesce(extract(epoch FROM s.execution_window_end)::text,'null')||'/'||coalesce(extract(epoch FROM s.results_release_at)::text,'null'));
$$;
CREATE OR REPLACE FUNCTION admin_session_private.window_json(s public.simulados)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('execution_window_start',s.execution_window_start,'execution_window_end',s.execution_window_end,'results_release_at',s.results_release_at);
$$;
CREATE OR REPLACE FUNCTION admin_session_private.window_eligible(a public.attempts,p_start timestamptz,p_end timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF a.attempt_type='online' THEN RETURN coalesce(a.started_at BETWEEN p_start AND p_end,false); END IF;
 IF a.status NOT IN ('submitted','expired') THEN RETURN coalesce(a.is_within_window,false); END IF;
 IF a.attempt_type='offline' THEN
  RETURN coalesce(a.caderno_id IS NOT NULL OR coalesce(a.offline_answers_submitted_at,a.finished_at) BETWEEN p_start AND p_end,false);
 END IF;
 IF a.attempt_type='presencial' THEN
  -- Frozen session eligibility is independent of the edited online window.
  RETURN admin_session_private.presencial_eligible(a.id,a.finished_at,p_start,p_end);
 END IF;
 RETURN coalesce(a.is_within_window,false);
END $$;
REVOKE ALL ON FUNCTION admin_session_private.window_hash(public.simulados),admin_session_private.window_json(public.simulados),admin_session_private.window_eligible(public.attempts,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_preview_simulado_window(p_simulado_id uuid,p_execution_window_start timestamptz,p_execution_window_end timestamptz,p_results_release_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.simulados%ROWTYPE; total bigint; old_n bigint; new_n bigint; changed bigint;
BEGIN
 PERFORM public.admin_require('content.manage'); PERFORM public.admin_require('attempts.manage');
 IF p_execution_window_start IS NULL OR p_execution_window_end IS NULL OR p_results_release_at IS NULL
 OR NOT(p_execution_window_start<p_execution_window_end AND p_execution_window_end<=p_results_release_at) THEN
  RAISE EXCEPTION 'INVALID_SIMULADO_WINDOW' USING ERRCODE='22023';
 END IF;
 SELECT * INTO STRICT s FROM public.simulados WHERE id=p_simulado_id;
 SELECT count(*),count(*) FILTER(WHERE a.is_within_window),count(*) FILTER(WHERE admin_session_private.window_eligible(a,p_execution_window_start,p_execution_window_end)),
  count(*) FILTER(WHERE a.is_within_window IS DISTINCT FROM admin_session_private.window_eligible(a,p_execution_window_start,p_execution_window_end))
 INTO total,old_n,new_n,changed FROM public.attempts a WHERE a.simulado_id=s.id;
 RETURN jsonb_build_object('simulado_id',s.id,'current_window_hash',admin_session_private.window_hash(s),
  'attempts_examined',total,'old_eligible',old_n,'new_eligible',new_n,'eligibility_changed',changed,
  'old_window',admin_session_private.window_json(s),'new_window',jsonb_build_object('execution_window_start',p_execution_window_start,'execution_window_end',p_execution_window_end,'results_release_at',p_results_release_at));
END $$;

-- INVOKER checks the effective SQL role, not session_user or a spoofable GUC.
-- The small DEFINER helper sees attempts hidden from an editor by RLS.
CREATE OR REPLACE FUNCTION public.admin_session_has_attempts(p_simulado_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.admin_require('content.manage');
 RETURN EXISTS(SELECT 1 FROM public.attempts WHERE simulado_id=p_simulado_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_session_has_attempts(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_session_has_attempts(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_simulado_window_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.execution_window_start,NEW.execution_window_end,NEW.results_release_at)
  IS NOT DISTINCT FROM ROW(OLD.execution_window_start,OLD.execution_window_end,OLD.results_release_at) THEN RETURN NEW; END IF;
 IF current_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 IF public.admin_session_has_attempts(OLD.id) THEN
  RAISE EXCEPTION 'Use admin_update_simulado_window for a simulado with attempts' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_simulado_window_update() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_guard_simulado_window_update ON public.simulados;
CREATE TRIGGER trg_guard_simulado_window_update BEFORE UPDATE OF execution_window_start,execution_window_end,results_release_at ON public.simulados
FOR EACH ROW EXECUTE FUNCTION public.guard_simulado_window_update();

CREATE OR REPLACE FUNCTION public.admin_update_simulado_window(p_simulado_id uuid,p_execution_window_start timestamptz,p_execution_window_end timestamptz,p_results_release_at timestamptz,p_expected_window_hash text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.simulados%ROWTYPE; report jsonb; op uuid; total integer; changed integer;
BEGIN
 PERFORM public.admin_require('content.manage'); PERFORM public.admin_require('attempts.manage');
 IF auth.uid() IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023';
 END IF;
 -- Parent first, then deterministic attempt order, but NEVER wait on either.
 -- A finalizer holding an attempt and waiting for parent cannot deadlock us.
 SELECT * INTO STRICT s FROM public.simulados WHERE id=p_simulado_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.attempts WHERE simulado_id=s.id ORDER BY id FOR UPDATE NOWAIT;
 IF p_expected_window_hash IS DISTINCT FROM admin_session_private.window_hash(s) THEN
  RAISE EXCEPTION 'STALE_WINDOW_HASH' USING ERRCODE='40001';
 END IF;
 report:=public.admin_preview_simulado_window(p_simulado_id,p_execution_window_start,p_execution_window_end,p_results_release_at);
 INSERT INTO admin_session_private.window_operations(simulado_id,actor_id,reason,old_window,new_window)
 VALUES(s.id,auth.uid(),btrim(p_reason),report->'old_window',report->'new_window') RETURNING operation_id INTO op;
 INSERT INTO admin_session_private.window_attempt_changes(operation_id,attempt_id,previous_flag,target_flag)
 SELECT op,a.id,a.is_within_window,admin_session_private.window_eligible(a,p_execution_window_start,p_execution_window_end)
 FROM public.attempts a WHERE a.simulado_id=s.id;
 SELECT count(*),count(*) FILTER(WHERE previous_flag IS DISTINCT FROM target_flag) INTO total,changed
 FROM admin_session_private.window_attempt_changes WHERE operation_id=op;
 UPDATE public.simulados SET execution_window_start=p_execution_window_start,execution_window_end=p_execution_window_end,results_release_at=p_results_release_at WHERE id=s.id;
 UPDATE public.attempts a SET is_within_window=c.target_flag FROM admin_session_private.window_attempt_changes c
 WHERE c.operation_id=op AND a.id=c.attempt_id AND a.is_within_window IS DISTINCT FROM c.target_flag;
 PERFORM public.admin_log_action('update_simulado_window','simulado',s.id,'Explicit window recalculation',
  jsonb_build_object('operation_id',op,'reason',btrim(p_reason),'before',report->'old_window','after',report->'new_window','attempts_examined',total,'eligibility_changed',changed));
 RETURN jsonb_build_object('simulado_id',s.id,'operation_id',op,'attempts_examined',total,'eligibility_changed',changed,'old_window',report->'old_window','new_window',report->'new_window');
END $$;
ALTER FUNCTION public.admin_preview_simulado_window(uuid,timestamptz,timestamptz,timestamptz) OWNER TO postgres;
ALTER FUNCTION public.admin_update_simulado_window(uuid,timestamptz,timestamptz,timestamptz,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_preview_simulado_window(uuid,timestamptz,timestamptz,timestamptz),public.admin_update_simulado_window(uuid,timestamptz,timestamptz,timestamptz,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_simulado_window(uuid,timestamptz,timestamptz,timestamptz),public.admin_update_simulado_window(uuid,timestamptz,timestamptz,timestamptz,text,text) TO authenticated;

-- Manual, owner-only rollback. A changed target or membership refuses the
-- reversal rather than overwriting a later administrator's work.
CREATE OR REPLACE FUNCTION admin_session_private.rollback_window_operation(p_operation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o admin_session_private.window_operations%ROWTYPE; s public.simulados%ROWTYPE; reversal uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'JWT_ACTOR_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage'); PERFORM public.admin_require('attempts.manage');
 SELECT * INTO STRICT o FROM admin_session_private.window_operations WHERE operation_id=p_operation_id;
 SELECT * INTO STRICT s FROM public.simulados WHERE id=o.simulado_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.attempts WHERE simulado_id=o.simulado_id ORDER BY id FOR UPDATE NOWAIT;
 IF admin_session_private.window_json(s) IS DISTINCT FROM o.new_window
 OR EXISTS(SELECT 1 FROM public.attempts a FULL JOIN
  (SELECT * FROM admin_session_private.window_attempt_changes WHERE operation_id=p_operation_id) c ON c.attempt_id=a.id
  WHERE (a.simulado_id=o.simulado_id OR c.operation_id=p_operation_id)
  AND (a.id IS NULL OR c.attempt_id IS NULL OR a.is_within_window IS DISTINCT FROM c.target_flag)) THEN
  RAISE EXCEPTION 'ROLLBACK_TARGET_DRIFT' USING ERRCODE='40001';
 END IF;
 INSERT INTO admin_session_private.window_operations(simulado_id,actor_id,reason,old_window,new_window)
 VALUES(o.simulado_id,auth.uid(),'Rollback of '||o.operation_id,o.new_window,o.old_window) RETURNING operation_id INTO reversal;
 INSERT INTO admin_session_private.window_attempt_changes(operation_id,attempt_id,previous_flag,target_flag)
 SELECT reversal,attempt_id,target_flag,coalesce(previous_flag,false) FROM admin_session_private.window_attempt_changes WHERE operation_id=p_operation_id;
 UPDATE public.simulados SET execution_window_start=(o.old_window->>'execution_window_start')::timestamptz,
 execution_window_end=(o.old_window->>'execution_window_end')::timestamptz,results_release_at=(o.old_window->>'results_release_at')::timestamptz WHERE id=o.simulado_id;
 UPDATE public.attempts a SET is_within_window=c.previous_flag FROM admin_session_private.window_attempt_changes c
 WHERE c.operation_id=p_operation_id AND c.attempt_id=a.id AND a.is_within_window IS DISTINCT FROM c.previous_flag;
 PERFORM public.admin_log_action('rollback_simulado_window','simulado',o.simulado_id,'Explicit window rollback',jsonb_build_object('operation_id',reversal,'reverses',p_operation_id,'before',o.new_window,'after',o.old_window));
 RETURN reversal;
END $$;
REVOKE ALL ON FUNCTION admin_session_private.rollback_window_operation(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION admin_session_private.rollback_installation()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; p record; g text; sig text;
BEGIN
 -- A legacy implementation cannot interpret an active v1 snapshot. Refusal
 -- is safer than silently changing grades/ranking; no snapshots are deleted.
 IF EXISTS(SELECT 1 FROM admin_session_private.attempt_rules WHERE ranking_rule='session_window_v1')
 OR EXISTS(SELECT 1 FROM admin_session_private.submission_rules WHERE ranking_rule='session_window_v1') THEN
  RAISE EXCEPTION 'ROLLBACK_REFUSED_ACTIVE_V1' USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM admin_session_private.definitions WHERE installed_hash IS NOT NULL) THEN
  RAISE EXCEPTION 'NO_ACTIVE_INSTALLATION' USING ERRCODE='55000';
 END IF;
 -- Validate EVERY definition before any restore/revoke.
 FOR r IN SELECT * FROM admin_session_private.definitions WHERE installed_hash IS NOT NULL ORDER BY name LOOP
  SELECT pg_get_functiondef(oid) AS def INTO STRICT p FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=r.name;
  IF md5(p.def) IS DISTINCT FROM r.installed_hash THEN RAISE EXCEPTION 'ROLLBACK_FUNCTION_DRIFT: %',r.name USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR r IN SELECT * FROM admin_session_private.definitions WHERE installed_hash IS NOT NULL ORDER BY name LOOP
  SELECT oid::regprocedure::text AS signature INTO STRICT p FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=r.name;
  IF r.name IN ('admin_presencial_session_upsert','admin_presencial_sessions_list') THEN EXECUTE 'DROP FUNCTION '||p.signature; END IF;
  EXECUTE r.definition;
  SELECT oid::regprocedure::text INTO STRICT sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=r.name;
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',sig,r.owner_name);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',sig);
  FOREACH g IN ARRAY r.grants LOOP EXECUTE replace(g,'@SIGNATURE@',sig); END LOOP;
  UPDATE admin_session_private.definitions SET installed_hash=NULL WHERE name=r.name;
 END LOOP;
 REVOKE EXECUTE ON FUNCTION public.create_or_convert_presencial_attempt_for_session(uuid,uuid,uuid) FROM service_role;
 REVOKE EXECUTE ON FUNCTION public.admin_preview_simulado_window(uuid,timestamptz,timestamptz,timestamptz),public.admin_update_simulado_window(uuid,timestamptz,timestamptz,timestamptz,text,text) FROM authenticated;
END $$;
REVOKE ALL ON FUNCTION admin_session_private.rollback_installation() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;

-- ROLLBACK (reviewed maintenance only, never automatic): retain private tables,
-- snapshots and added ranking_rule; do not drop historical provenance.
-- Restore a changed window only while holding parent FOR UPDATE NOWAIT, then
-- attempts ORDER BY id FOR UPDATE NOWAIT. Refuse unless current window equals
-- window_operations.new_window AND every current flag equals target_flag AND
-- no new attempts exist (compare complete ID sets). Restore ONLY the three old
-- window fields and previous_flag, audit the reversal; do not touch any score,
-- answer, finish time, academic snapshot or later edits. Otherwise use a new
-- preview/update operation instead of overwriting intervening work.
-- Function rollback must first compare md5(pg_get_functiondef(oid)) to the
-- corresponding definitions.installed_hash and refuse drift. Restore saved
-- definition/owner/grants, dropping ONLY the expanded upsert/list signatures
-- before restoring their old return/argument signatures. Never restore old F0
-- triggers, public creation ACLs or disable integrity guards. Keep the Edge
-- session-aware RPC and snapshots until all callers have been migrated back.
-- Executable owner-only maintenance entry points (NOT an automatic migration):
-- BEGIN;
-- SELECT set_config('request.jwt.claim.sub','<verified-admin-uuid>',true);
-- SELECT admin_session_private.rollback_window_operation('<operation-uuid>');
-- COMMIT;
-- Installation rollback, only after Edge callers have been reverted:
-- BEGIN; SELECT admin_session_private.rollback_installation(); COMMIT;
-- Reapply this file to restore the installation. Both rollback entry points
-- preserve checkpoints, snapshots, answers and grades; installation rollback
-- refuses ALL active v1 snapshots. Keep the direct-window guard enabled.
