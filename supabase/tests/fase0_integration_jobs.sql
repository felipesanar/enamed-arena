-- LOCAL ONLY: empty disposable PostgreSQL database, superuser, psql.
-- psql -X -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 -d fase0_integration_fixture -f supabase/tests/fase0_integration_jobs.sql
-- Never run against Supabase/production: schemas below are mocks, not extensions.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF to_regnamespace('net') IS NOT NULL OR to_regnamespace('vault') IS NOT NULL
     OR to_regnamespace('cron') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL
     OR to_regprocedure('public.notify_hubspot_new_user()') IS NOT NULL
     OR to_regprocedure('public.invoke_gabarito_key_alerts()') IS NOT NULL THEN
    RAISE EXCEPTION 'Use an EMPTY disposable local database; no existing integration objects allowed';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS: %', label;
END $$;

CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
CREATE SCHEMA net;
CREATE TABLE net.calls(id bigint GENERATED ALWAYS AS IDENTITY, url text, body jsonb, headers jsonb);
CREATE TABLE net.behavior(fail boolean DEFAULT false, null_id boolean DEFAULT false);
INSERT INTO net.behavior DEFAULT VALUES;
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 1000) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE request_id bigint;
BEGIN
  IF (SELECT fail FROM net.behavior) THEN
    RAISE EXCEPTION 'MOCK: sensitive diagnostics MUST NOT reach warning';
  END IF;
  IF (SELECT null_id FROM net.behavior) THEN RETURN NULL; END IF;
  INSERT INTO net.calls(url, body, headers) VALUES (url, body, headers) RETURNING id INTO request_id;
  RETURN request_id;
END $$;
CREATE TABLE public.profiles(email text, full_name text, segment text, created_at timestamptz);

\ir ../migrations/20261104052630_fase0_hubspot_vault.sql
\ir ../migrations/20261104052630_fase0_hubspot_vault.sql
-- BEFORE trigger deliberately observes RETURN NEW (AFTER ignores its return).
CREATE TRIGGER on_profile_created_hubspot BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_hubspot_new_user();
INSERT INTO public.profiles VALUES ('fixture@example.invalid', 'Fixture', 'guest', '2026-01-01T00:00:00Z');
SELECT pg_temp.check_true((SELECT count(*) = 1 FROM public.profiles), 'missing secret preserves NEW');
SELECT pg_temp.check_true((SELECT count(*) = 0 FROM net.calls), 'missing secret sends nothing');
INSERT INTO vault.decrypted_secrets VALUES ('HUBSPOT_SYNC_SECRET', 'fixture-hubspot-v1');
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT headers = '{"Content-Type":"application/json","x-internal-secret":"fixture-hubspot-v1"}'::jsonb
  AND body = jsonb_build_object('email', 'fixture@example.invalid', 'full_name', 'Fixture',
    'segment', 'guest', 'created_at', '2026-01-01T00:00:00Z'::timestamptz)
  AND url LIKE '%/functions/v1/hubspot-contact-sync' FROM net.calls LIMIT 1), 'HubSpot header and unchanged payload');
UPDATE vault.decrypted_secrets SET decrypted_secret = 'fixture-hubspot-v2';
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT headers->>'x-internal-secret' = 'fixture-hubspot-v2'
  FROM net.calls ORDER BY id DESC LIMIT 1), 'HubSpot rotation without migration');
SAVEPOINT invalid_hubspot_secret;
UPDATE vault.decrypted_secrets SET decrypted_secret = '   ' WHERE name = 'HUBSPOT_SYNC_SECRET';
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 2 FROM net.calls), 'blank HubSpot secret sends nothing');
INSERT INTO vault.decrypted_secrets VALUES ('HUBSPOT_SYNC_SECRET', 'fixture-duplicate');
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 2 FROM net.calls), 'duplicate HubSpot secret sends nothing');
ROLLBACK TO SAVEPOINT invalid_hubspot_secret;
UPDATE net.behavior SET fail = true;
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 4 FROM public.profiles), 'enqueue exception preserves NEW');
UPDATE net.behavior SET fail = false, null_id = true;
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 5 FROM public.profiles), 'null request id preserves NEW');
UPDATE net.behavior SET null_id = false;
ALTER TABLE vault.decrypted_secrets RENAME TO unavailable;
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 6 FROM public.profiles), 'unavailable Vault preserves NEW');
ALTER TABLE vault.unavailable RENAME TO decrypted_secrets;

-- Missing cron must not pretend to install a job; helper still exists.
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true(to_regnamespace('cron') IS NULL, 'missing cron not created');
CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY, jobname text UNIQUE, schedule text, command text);
CREATE FUNCTION cron.unschedule(job_id bigint) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN DELETE FROM cron.job WHERE jobid = job_id; RETURN FOUND; END $$;
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE job_id bigint;
BEGIN INSERT INTO cron.job(jobname, schedule, command) VALUES(job_name, schedule, command)
  RETURNING jobid INTO job_id; RETURN job_id; END $$;
INSERT INTO cron.job(jobname, schedule, command) VALUES ('gabarito-key-alerts-daily', '* * * * *', 'unsafe legacy fixture');
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true((SELECT count(*) = 0 FROM cron.job), 'missing relay secret removes stale job');
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'missing relay secret fails closed');
INSERT INTO vault.decrypted_secrets VALUES ('NOVU_RELAY_SECRET', 'fixture-relay-v1');
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true((SELECT count(*) = 1 AND bool_and(command = 'SELECT public.invoke_gabarito_key_alerts();'
  AND schedule = '0 12 * * *') FROM cron.job), 'idempotent schedule contains only helper call');
SELECT pg_temp.check_true(NOT EXISTS (SELECT FROM cron.job j JOIN vault.decrypted_secrets s
  ON position(s.decrypted_secret IN j.command) > 0), 'no secret in cron command');
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NOT NULL, 'helper enqueues via mock');
SELECT pg_temp.check_true((SELECT headers->>'x-internal-secret' = 'fixture-relay-v1'
  AND body = '{"source":"pg_cron"}'::jsonb AND url LIKE '%/functions/v1/gabarito-key-alerts'
  FROM net.calls ORDER BY id DESC LIMIT 1), 'relay header and body');
UPDATE vault.decrypted_secrets SET decrypted_secret = 'fixture-relay-v2' WHERE name = 'NOVU_RELAY_SECRET';
SELECT public.invoke_gabarito_key_alerts();
SELECT pg_temp.check_true((SELECT headers->>'x-internal-secret' = 'fixture-relay-v2'
  FROM net.calls ORDER BY id DESC LIMIT 1), 'relay rotation per execution');
SAVEPOINT invalid_relay_secret;
UPDATE vault.decrypted_secrets SET decrypted_secret = '' WHERE name = 'NOVU_RELAY_SECRET';
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'blank relay secret fails closed');
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true((SELECT count(*) = 0 FROM cron.job), 'blank relay secret leaves no job');
INSERT INTO vault.decrypted_secrets VALUES ('NOVU_RELAY_SECRET', 'fixture-duplicate');
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'duplicate relay secret fails closed');
ALTER TABLE vault.decrypted_secrets RENAME TO unavailable;
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true((SELECT count(*) = 0 FROM cron.job), 'unavailable Vault leaves no job');
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'unavailable Vault fails closed');
ROLLBACK TO SAVEPOINT invalid_relay_secret;
DELETE FROM vault.decrypted_secrets WHERE name = 'NOVU_RELAY_SECRET';
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'deleted secret stops execution');
INSERT INTO vault.decrypted_secrets VALUES ('NOVU_RELAY_SECRET', 'fixture-relay-v3');
UPDATE net.behavior SET fail = true;
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'helper contains enqueue exception');
UPDATE net.behavior SET fail = false, null_id = true;
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'helper rejects null request id');
DROP FUNCTION net.http_post(text, jsonb, jsonb, jsonb, integer);
\ir ../migrations/20260817160100_gabarito_key_alerts_cron.sql
SELECT pg_temp.check_true((SELECT count(*) = 0 FROM cron.job), 'missing net removes job');
SELECT pg_temp.check_true(public.invoke_gabarito_key_alerts() IS NULL, 'missing net fails closed');
INSERT INTO public.profiles SELECT * FROM public.profiles LIMIT 1;
SELECT pg_temp.check_true((SELECT count(*) = 7 FROM public.profiles), 'missing net preserves NEW');

SELECT pg_temp.check_true((SELECT bool_and(prosecdef AND proconfig @> ARRAY['search_path=pg_catalog'])
  FROM pg_proc WHERE oid IN ('public.notify_hubspot_new_user()'::regprocedure,
    'public.invoke_gabarito_key_alerts()'::regprocedure)), 'fixed trusted search_path and SECURITY DEFINER');
SELECT pg_temp.check_true(NOT EXISTS (
  SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE p.oid IN ('public.notify_hubspot_new_user()'::regprocedure, 'public.invoke_gabarito_key_alerts()'::regprocedure)
    AND a.privilege_type = 'EXECUTE' AND a.grantee = 0), 'no PUBLIC execute');
SELECT pg_temp.check_true(NOT has_function_privilege('anon', 'public.invoke_gabarito_key_alerts()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.invoke_gabarito_key_alerts()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.invoke_gabarito_key_alerts()', 'EXECUTE'), 'helper service_role only');
SELECT pg_temp.check_true(NOT has_function_privilege('anon', 'public.notify_hubspot_new_user()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.notify_hubspot_new_user()', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.notify_hubspot_new_user()', 'EXECUTE'), 'trigger owner only');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.invoke_gabarito_key_alerts();
    RAISE EXCEPTION 'FAIL: authenticated invoked helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.invoke_gabarito_key_alerts();
    RAISE EXCEPTION 'FAIL: anon invoked helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
-- Missing transport returns NULL, but EXECUTE must be allowed.
SELECT public.invoke_gabarito_key_alerts();
RESET ROLE;
ROLLBACK;
\echo 'PASS: local integration fixtures completed and rolled back'
