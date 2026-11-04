-- Sources inspected: local integrated F0 notify_hubspot_new_user definition/ACL
-- (owner-only), F1 edition targets, attempt_processing_queue and Novu relay.
-- No extension provisioning, scheduling, backfill or external HTTP on migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.communication_config (
 job text PRIMARY KEY CHECK(job IN ('calendar','ops')),
 enabled boolean NOT NULL DEFAULT false,
 watermark timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.communication_config(job) VALUES ('calendar'),('ops') ON CONFLICT DO NOTHING;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS calendar_notifications boolean NOT NULL DEFAULT false;
-- Import authoritative unsubscribe/internal-account decisions here BEFORE enabling.
CREATE TABLE IF NOT EXISTS public.communication_suppressions (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 unsubscribed boolean NOT NULL DEFAULT false,
 internal_account boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.communication_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 simulado_id uuid NOT NULL REFERENCES public.simulados(id),
 edition_id uuid NOT NULL REFERENCES public.exam_editions(id),
 event_name text NOT NULL CHECK(event_name IN ('window_open','last24h','results_released')),
 revision text NOT NULL, due_at timestamptz NOT NULL,
 audience_cursor uuid, expanded boolean NOT NULL DEFAULT false,
 UNIQUE(simulado_id,event_name,revision)
);
CREATE TABLE IF NOT EXISTS public.communication_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel text NOT NULL CHECK(channel IN ('calendar','ops')),
 event_key text NOT NULL UNIQUE, event_name text NOT NULL,
 simulado_id uuid REFERENCES public.simulados(id), user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 revision text, due_at timestamptz NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','sending','sent','uncertain','skipped')),
 lease_token uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
ALTER TABLE public.communication_queue ADD COLUMN IF NOT EXISTS recipient_email_hash text;
CREATE INDEX IF NOT EXISTS communication_queue_pending ON public.communication_queue(channel,due_at) WHERE status='pending';
-- Also protects against a reprogrammed event racing an old in-flight revision.
CREATE UNIQUE INDEX IF NOT EXISTS communication_one_semantic_delivery
 ON public.communication_queue(simulado_id,user_id,event_name)
 WHERE channel='calendar' AND status IN ('claimed','sending','sent','uncertain');
CREATE TABLE IF NOT EXISTS public.communication_incidents (
 incident_key text PRIMARY KEY, active boolean NOT NULL, generation integer NOT NULL DEFAULT 1,
 changed_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['communication_config','communication_suppressions','communication_events','communication_queue','communication_incidents'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON public.communication_config TO service_role;
CREATE OR REPLACE FUNCTION public.communication_job_enabled(p_job text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT enabled FROM public.communication_config WHERE job=p_job),false);
$$;

CREATE OR REPLACE FUNCTION public.communication_eligible(p_user uuid,p_edition uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN auth.users u ON u.id=p.id AND u.email_confirmed_at IS NOT NULL
  JOIN public.notification_preferences np ON np.user_id=p.id AND np.calendar_notifications
  LEFT JOIN public.communication_suppressions x ON x.user_id=p.id
  WHERE p.id=p_user AND p.email=u.email AND p.email ~ '^[^[:space:]<>"@]+@[^[:space:]<>"@]+\.[^[:space:]<>"@]+$'
   AND lower(split_part(p.email,'@',2)) !~ '(^|\.)(sanar\.com\.br|techpirata\.com\.br|cetrus\.com\.br)$'
   AND NOT coalesce(x.unsubscribed,false) AND NOT coalesce(x.internal_account,false)
   AND (EXISTS(SELECT 1 FROM public.onboarding_profiles o WHERE o.user_id=p.id AND o.target_edition_id=p_edition)
    OR EXISTS(SELECT 1 FROM public.attempts a JOIN public.simulados s ON s.id=a.simulado_id
      WHERE a.user_id=p.id AND s.edition_id=p_edition))
 );
$$;

CREATE OR REPLACE FUNCTION public.prepare_calendar_communications(p_batch integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.communication_config; e record; u record; n integer:=0; k integer;
 v_now timestamptz:=clock_timestamp(); lower_bound timestamptz;
BEGIN
 SELECT * INTO c FROM public.communication_config WHERE job='calendar' FOR UPDATE;
 IF NOT c.enabled THEN RETURN 0; END IF;
 lower_bound:=greatest(c.watermark,v_now-interval '5 minutes');
 INSERT INTO public.communication_events(simulado_id,edition_id,event_name,revision,due_at)
 SELECT s.id,s.edition_id,v.name,md5(jsonb_build_array(s.edition_id,s.execution_window_start,s.execution_window_end,s.results_release_at)::text),v.due
 FROM public.simulados s JOIN public.exam_editions ed ON ed.id=s.edition_id
 CROSS JOIN LATERAL (VALUES ('window_open',s.execution_window_start),
  ('last24h',s.execution_window_end-interval '24 hours'),('results_released',s.results_release_at)) v(name,due)
 WHERE s.status='published' AND ed.status<>'closed' AND v.due>lower_bound AND v.due<=v_now
  AND (v.name='results_released' OR s.execution_window_end>v_now)
 ON CONFLICT DO NOTHING;
 UPDATE public.communication_config SET watermark=v_now WHERE job='calendar';
 -- One bounded page across all events per invocation; cursor keeps large audiences
 -- from being silently truncated at PostgREST's row cap. Old events expire, not replay.
 FOR e IN SELECT ev.* FROM public.communication_events ev
  WHERE NOT ev.expanded AND ev.due_at>v_now-interval '5 minutes'
  ORDER BY ev.due_at,ev.id FOR UPDATE SKIP LOCKED LOOP
  k:=0;
  FOR u IN SELECT p.id FROM public.profiles p
   WHERE (e.audience_cursor IS NULL OR p.id>e.audience_cursor)
    AND public.communication_eligible(p.id,e.edition_id)
   ORDER BY p.id LIMIT greatest(1,least(p_batch,500))-n LOOP
   INSERT INTO public.communication_queue(channel,event_key,event_name,simulado_id,user_id,revision,due_at,payload)
   VALUES('calendar',e.id::text||':'||u.id::text,e.event_name,e.simulado_id,u.id,e.revision,e.due_at,
    jsonb_build_object('editionId',e.edition_id,'simuladoId',e.simulado_id,'event',e.event_name))
   ON CONFLICT DO NOTHING;
   UPDATE public.communication_events SET audience_cursor=u.id WHERE id=e.id;
   n:=n+1; k:=k+1;
  END LOOP;
  IF k=0 THEN UPDATE public.communication_events SET expanded=true WHERE id=e.id; END IF;
  EXIT WHEN n>=greatest(1,least(p_batch,500));
 END LOOP;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.claim_communications(p_channel text,p_batch integer DEFAULT 50)
RETURNS TABLE(id uuid,lease_token uuid,event_name text,recipient_id uuid,email text,payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE q public.communication_queue; s public.simulados; token uuid; v_now timestamptz:=clock_timestamp();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.communication_config c WHERE c.job=p_channel AND c.enabled) THEN RETURN; END IF;
 -- Claimed has not crossed the HTTP boundary; sending may have been accepted.
 UPDATE public.communication_queue cq SET status=CASE WHEN cq.status='sending' THEN 'uncertain' ELSE 'pending' END,
  lease_token=NULL,lease_until=NULL WHERE cq.id IN (
   SELECT expired.id FROM public.communication_queue expired WHERE expired.status IN ('claimed','sending')
    AND expired.lease_until<v_now FOR UPDATE SKIP LOCKED);
 FOR q IN SELECT cq.* FROM public.communication_queue cq
  WHERE cq.channel=p_channel AND cq.status='pending' ORDER BY cq.due_at,cq.id
  LIMIT greatest(1,least(p_batch,100)) FOR UPDATE SKIP LOCKED LOOP
  IF q.channel='calendar' THEN
   SELECT * INTO s FROM public.simulados WHERE simulados.id=q.simulado_id;
   IF q.due_at<v_now-interval '5 minutes' OR s.status<>'published'
    OR NOT public.communication_eligible(q.user_id,s.edition_id)
    OR EXISTS(SELECT 1 FROM public.exam_editions ed WHERE ed.id=s.edition_id AND ed.status='closed')
    OR q.revision<>md5(jsonb_build_array(s.edition_id,s.execution_window_start,s.execution_window_end,s.results_release_at)::text)
    OR (q.event_name<>'results_released' AND s.execution_window_end<=v_now)
    OR EXISTS(SELECT 1 FROM public.communication_queue other WHERE other.simulado_id=q.simulado_id
      AND other.user_id=q.user_id AND other.event_name=q.event_name
      AND other.status IN ('claimed','sending','sent','uncertain')) THEN
    UPDATE public.communication_queue SET status='skipped',completed_at=v_now WHERE communication_queue.id=q.id;
    CONTINUE;
   END IF;
  END IF;
  token:=gen_random_uuid();
  UPDATE public.communication_queue SET status='claimed',lease_token=token,lease_until=v_now+interval '2 minutes',
   recipient_email_hash=(SELECT md5(p.email) FROM public.profiles p WHERE p.id=q.user_id)
   WHERE communication_queue.id=q.id;
  RETURN QUERY SELECT q.id,token,q.event_name,q.user_id,p.email,
   CASE WHEN q.channel='calendar' THEN q.payload||jsonb_build_object(
    'simuladoTitle',s.title,'editionCode',(SELECT ed.code FROM public.exam_editions ed WHERE ed.id=s.edition_id),
    'windowStart',s.execution_window_start,'windowEnd',s.execution_window_end,'resultsReleaseAt',s.results_release_at,
    'actionUrl','https://simulados.sanar.com.br/simulados/'||s.id::text)
   ELSE q.payload END
   FROM (SELECT 1) dummy LEFT JOIN public.profiles p ON p.id=q.user_id;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.start_communication(p_id uuid,p_lease uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE public.communication_queue q SET status='sending' WHERE q.id=p_id AND q.lease_token=p_lease
  AND q.status='claimed' AND q.lease_until>clock_timestamp()
  AND EXISTS(SELECT 1 FROM public.communication_config c WHERE c.job=q.channel AND c.enabled)
  AND (q.channel='ops' OR EXISTS(SELECT 1 FROM public.simulados s JOIN public.exam_editions e ON e.id=s.edition_id
   JOIN public.profiles p ON p.id=q.user_id WHERE s.id=q.simulado_id AND s.status='published' AND e.status<>'closed'
    AND public.communication_eligible(q.user_id,s.edition_id) AND md5(p.email)=q.recipient_email_hash
    AND q.due_at>clock_timestamp()-interval '5 minutes'
    AND q.revision=md5(jsonb_build_array(s.edition_id,s.execution_window_start,s.execution_window_end,s.results_release_at)::text)
    AND (q.event_name='results_released' OR s.execution_window_end>clock_timestamp())));
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale lease or disabled dispatch' USING ERRCODE='40001'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.complete_communication(p_id uuid,p_lease uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_status NOT IN ('sent','uncertain','skipped') THEN RAISE EXCEPTION 'Invalid completion'; END IF;
 UPDATE public.communication_queue q SET status=p_status,completed_at=clock_timestamp(),lease_token=NULL,lease_until=NULL
 WHERE q.id=p_id AND q.lease_token=p_lease AND (q.status='sending' OR (q.status='claimed' AND p_status='skipped')) AND q.lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale lease' USING ERRCODE='40001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_health_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n bigint; failures bigint:=0; jobs jsonb:='[]'; dependency text:='not_installed'; uncertain_count bigint;
BEGIN
 -- A broken queue relation/query deliberately raises, never reports healthy.
 SELECT count(*) INTO n FROM public.attempt_processing_queue
  WHERE status IN ('pending','processing','failed') AND created_at<clock_timestamp()-interval '10 minutes';
 IF to_regclass('cron.job_run_details') IS NOT NULL AND to_regclass('cron.job') IS NOT NULL THEN
  dependency:='installed';
  EXECUTE 'SELECT count(*),coalesce(jsonb_agg(DISTINCT j.jobname),''[]''::jsonb)
   FROM cron.job_run_details d LEFT JOIN cron.job j ON j.jobid=d.jobid
   WHERE d.status=''failed'' AND d.end_time>clock_timestamp()-interval ''5 minutes'''
   INTO failures,jobs;
 END IF;
 SELECT count(*) INTO uncertain_count FROM public.communication_queue WHERE status='uncertain';
 RETURN jsonb_build_object('pending_over_10m',n,'cron_failures_5m',failures,'job_names',jobs,
  'cron_dependency',dependency,'uncertain_deliveries',uncertain_count);
END $$;
CREATE OR REPLACE FUNCTION public.prepare_ops_communications()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h jsonb; r record; old public.communication_incidents; generation_now integer;
BEGIN
 PERFORM 1 FROM public.communication_config WHERE job='ops' AND enabled FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('disabled',true); END IF;
 h:=public.ops_health_snapshot();
 FOR r IN SELECT * FROM (VALUES ('queue_stalled',(h->>'pending_over_10m')::bigint>0),
   ('cron_failed',(h->>'cron_failures_5m')::bigint>0),('cron_missing',h->>'cron_dependency'='not_installed'),
   ('delivery_uncertain',(h->>'uncertain_deliveries')::bigint>0)) v(key,active) LOOP
  SELECT * INTO old FROM public.communication_incidents WHERE incident_key=r.key FOR UPDATE;
  IF NOT FOUND THEN
   INSERT INTO public.communication_incidents(incident_key,active,generation,changed_at)
    VALUES(r.key,r.active,CASE WHEN r.active THEN 1 ELSE 0 END,
     CASE WHEN r.active THEN clock_timestamp() ELSE '-infinity'::timestamptz END);
   IF NOT r.active THEN CONTINUE; END IF;
   generation_now:=1;
  ELSE
   IF old.active=r.active THEN CONTINUE; END IF;
   -- At most one transition per incident in five minutes; a deferred recovery
   -- remains observable on the next poll rather than being silently discarded.
   IF old.changed_at>clock_timestamp()-interval '5 minutes' THEN CONTINUE; END IF;
   generation_now:=old.generation+1;
   UPDATE public.communication_incidents SET active=r.active,generation=generation_now,changed_at=clock_timestamp() WHERE incident_key=r.key;
  END IF;
  INSERT INTO public.communication_queue(channel,event_key,event_name,due_at,payload)
  VALUES('ops','ops:'||r.key||':'||generation_now,'ops_'||CASE WHEN r.active THEN 'incident' ELSE 'recovery' END,
   clock_timestamp(),jsonb_build_object('incident',r.key,'active',r.active,'health',h)) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN h;
END $$;

-- Manual cron entry point. Asynchronous pg_net request id is NOT a delivery ACK.
-- Dependency/config failures raise rather than returning a fake successful job.
CREATE OR REPLACE FUNCTION public.invoke_communication_job(p_job text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE secret_value text; secret_count bigint; request_id bigint; channel_name text;
BEGIN
 channel_name:=CASE p_job WHEN 'calendar-notifications' THEN 'calendar' WHEN 'ops-health-alerts' THEN 'ops' ELSE NULL END;
 IF channel_name IS NULL THEN RAISE EXCEPTION 'Unsupported job' USING ERRCODE='22023'; END IF;
 IF NOT public.communication_job_enabled(channel_name) THEN RAISE EXCEPTION 'Dispatch disabled' USING ERRCODE='55000'; END IF;
 IF to_regnamespace('vault') IS NULL OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
  RAISE EXCEPTION 'Internal HTTP or Vault dependency not installed' USING ERRCODE='55000';
 END IF;
 SELECT count(*),min(decrypted_secret) INTO secret_count,secret_value FROM vault.decrypted_secrets WHERE name='NOVU_RELAY_SECRET';
 IF secret_count<>1 OR nullif(btrim(secret_value),'') IS NULL THEN
  RAISE EXCEPTION 'Internal relay secret unconfigured' USING ERRCODE='55000';
 END IF;
 -- Do not propagate library diagnostics that could contain headers/credentials.
 BEGIN
  SELECT net.http_post(url:='https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/'||p_job,
   body:='{}'::jsonb,headers:=jsonb_build_object('Content-Type','application/json','x-internal-secret',secret_value)) INTO request_id;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Internal HTTP enqueue failed' USING ERRCODE='55000'; END;
 IF request_id IS NULL THEN RAISE EXCEPTION 'Internal HTTP enqueue missing id' USING ERRCODE='55000'; END IF;
 RETURN request_id;
END $$;

-- Preserve F0 Vault guard and exception boundary. Send an identity only; Edge
-- reads canonical profile + target, including explicit NULL (remote clear).
CREATE OR REPLACE FUNCTION public.notify_hubspot_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_secret text; v_count bigint; v_user uuid; v_request bigint;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN ('profiles','onboarding_profiles') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='profiles' THEN
   IF (NEW.email,NEW.full_name,NEW.segment) IS NOT DISTINCT FROM (OLD.email,OLD.full_name,OLD.segment) THEN RETURN NEW; END IF;
  ELSE
   IF NEW.target_edition_id IS NOT DISTINCT FROM OLD.target_edition_id THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='profiles' THEN v_user:=NEW.id; ELSE v_user:=NEW.user_id; END IF;
 BEGIN
  SELECT count(*),min(decrypted_secret) INTO v_count,v_secret FROM vault.decrypted_secrets WHERE name='HUBSPOT_SYNC_SECRET';
  IF v_count<>1 OR nullif(btrim(v_secret),'') IS NULL THEN
   RAISE WARNING '[hubspot-sync] Configure exactly one nonempty Vault secret; sync skipped'; RETURN NEW;
  END IF;
  SELECT net.http_post(url:='https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/hubspot-contact-sync',
   body:=jsonb_build_object('user_id',v_user),headers:=jsonb_build_object('Content-Type','application/json','x-internal-secret',v_secret)) INTO v_request;
  IF v_request IS NULL THEN RAISE WARNING '[hubspot-sync] No request id; inspect integration health'; END IF;
 EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[hubspot-sync] Vault or enqueue unavailable; signup/update preserved';
 END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_profile_updated_hubspot ON public.profiles;
CREATE TRIGGER on_profile_updated_hubspot AFTER UPDATE OF email,full_name,segment ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.notify_hubspot_new_user();
DROP TRIGGER IF EXISTS on_target_updated_hubspot ON public.onboarding_profiles;
CREATE TRIGGER on_target_updated_hubspot AFTER INSERT OR UPDATE OF target_edition_id ON public.onboarding_profiles
 FOR EACH ROW EXECUTE FUNCTION public.notify_hubspot_new_user();

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.proname IN ('communication_eligible','prepare_calendar_communications','claim_communications',
   'start_communication','complete_communication','ops_health_snapshot','prepare_ops_communications','notify_hubspot_new_user','communication_job_enabled','invoke_communication_job') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',f.signature);
  IF f.signature::text<>'notify_hubspot_new_user()' THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END IF;
 END LOOP;
END $$;
COMMIT;
-- ROLLBACK (manual, atomic safe stop, preserves queue/audit/preferences):
-- BEGIN;
-- UPDATE public.communication_config SET enabled=false,watermark=clock_timestamp();
-- DROP TRIGGER IF EXISTS on_profile_updated_hubspot ON public.profiles;
-- DROP TRIGGER IF EXISTS on_target_updated_hubspot ON public.onboarding_profiles;
-- DROP TRIGGER IF EXISTS on_profile_created_hubspot ON public.profiles;
-- COMMIT;
-- Keep worker RPCs and records for operator reconciliation; do not replay uncertain.
-- Approved scheduling is MANUAL ONLY, after Vault/Edge configuration and smoke test:
-- SELECT cron.schedule('calendar-notifications','* * * * *',
--   $$SELECT public.invoke_communication_job('calendar-notifications');$$);
-- SELECT cron.schedule('ops-health-alerts','* * * * *',
--   $$SELECT public.invoke_communication_job('ops-health-alerts');$$);
-- invoke_communication_job reads Vault at runtime; never embed its secret in cron.
-- Missing pg_cron = not_installed,
-- not a successful deployment. This migration never enables cron or extensions.
