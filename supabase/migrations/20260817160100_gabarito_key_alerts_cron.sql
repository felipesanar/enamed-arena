-- I-05: local scaffold, never applied in the production snapshot.
-- No CREATE EXTENSION: pg_cron requires Felipe's explicit approval first.
-- Vault NOVU_RELAY_SECRET must match the Edge/novu-email configuration.
-- Edge also needs GABARITO_ALERT_EMAILS; SQL cannot verify Edge settings.
-- A queued request is NOT evidence of HTTP success or email delivery.

CREATE OR REPLACE FUNCTION public.invoke_gabarito_key_alerts()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_secret text;
  v_secret_count bigint;
  v_request_id bigint;
BEGIN
  -- EXECUTE ACL is the capability: owner/cron owner and service_role only.
  -- Resolve on EVERY invocation, so secret rotation needs no rescheduling.
  SELECT count(*), min(decrypted_secret) INTO v_secret_count, v_secret
    FROM vault.decrypted_secrets WHERE name = 'NOVU_RELAY_SECRET';
  IF v_secret_count <> 1 OR nullif(btrim(v_secret), '') IS NULL THEN
    RAISE WARNING '[gabarito-key-alerts] Configure exactly one nonempty NOVU_RELAY_SECRET in Vault; request not queued';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/gabarito-key-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := jsonb_build_object('source', 'pg_cron')
  ) INTO v_request_id;
  IF v_request_id IS NULL THEN
    RAISE WARNING '[gabarito-key-alerts] pg_net returned no request id; inspect integration health';
  END IF;
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  -- Never expose SQLERRM/DETAIL: they can contain credentials and payloads.
  RAISE WARNING '[gabarito-key-alerts] Vault lookup or pg_net enqueue failed; inspect dependencies and permissions; request not queued';
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.invoke_gabarito_key_alerts() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invoke_gabarito_key_alerts() TO service_role;
COMMENT ON FUNCTION public.invoke_gabarito_key_alerts() IS
  'Internal cron helper. Reads Vault NOVU_RELAY_SECRET per call; returns pg_net request id or NULL, not HTTP delivery status.';

DO $schedule$
DECLARE
  v_job_id bigint;
  v_secret_ready boolean := false;
BEGIN
  -- Check installed capabilities without enabling extensions. The local SQL
  -- test supplies mocks of these interfaces, never a real HTTP transport.
  IF to_regclass('cron.job') IS NULL
     OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR to_regprocedure('cron.unschedule(bigint)') IS NULL THEN
    RAISE WARNING '[gabarito-key-alerts-cron] pg_cron unavailable; job NOT installed. Obtain Felipe approval before enabling it, then rerun this file';
    RETURN;
  END IF;

  -- Remove an old job BEFORE testing dependencies: never leave a legacy
  -- command (possibly containing a literal secret) running on a skipped setup.
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'gabarito-key-alerts-daily' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE WARNING '[gabarito-key-alerts-cron] pg_net unavailable; job NOT installed. Resolve dependency and rerun this file';
    RETURN;
  END IF;

  BEGIN
    SELECT count(*) = 1 AND bool_and(nullif(btrim(decrypted_secret), '') IS NOT NULL)
      INTO v_secret_ready FROM vault.decrypted_secrets WHERE name = 'NOVU_RELAY_SECRET';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[gabarito-key-alerts-cron] Vault unavailable; job NOT installed. Resolve access and rerun this file';
    RETURN;
  END;
  IF v_secret_ready IS DISTINCT FROM true THEN
    RAISE WARNING '[gabarito-key-alerts-cron] NOVU_RELAY_SECRET missing, empty or duplicated in Vault; job NOT installed. Configure it and rerun this file';
    RETURN;
  END IF;

  -- 09:00 BRT = 12:00 UTC. No secret, token or HTTP header in cron.job.command.
  PERFORM cron.schedule('gabarito-key-alerts-daily', '0 12 * * *',
    'SELECT public.invoke_gabarito_key_alerts();');
  RAISE NOTICE '[gabarito-key-alerts-cron] Job scheduled at 12:00 UTC; HTTP and email delivery still require verification';
END;
$schedule$;

-- Rollback (authorized owner, only if pg_cron is available):
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gabarito-key-alerts-daily';
-- DROP FUNCTION IF EXISTS public.invoke_gabarito_key_alerts();
-- If pg_cron is absent, only DROP FUNCTION is needed. Preserve alert/dedup data.
