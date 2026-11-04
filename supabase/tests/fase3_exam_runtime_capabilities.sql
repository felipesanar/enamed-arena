\set ON_ERROR_STOP on
SELECT 1 / (COALESCE(inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
  AND session_user='postgres' AND current_database() ~ '^enamed_test_answer_freshness_[a-z0-9_]+$',false)::int);
BEGIN;
SET LOCAL statement_timeout='20s';
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE TEMP TABLE capability_baseline AS SELECT '{}'::jsonb AS value;
GRANT SELECT, UPDATE ON capability_baseline TO authenticated;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.get_exam_runtime_capabilities()','EXECUTE')
  AND NOT has_function_privilege('service_role','public.get_exam_runtime_capabilities()','EXECUTE')
  AND has_function_privilege('authenticated','public.get_exam_runtime_capabilities()','EXECUTE'), 'only authenticated may execute runtime RPC');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
  PERFORM public.get_exam_runtime_capabilities();
  RAISE EXCEPTION 'FAIL: anonymous uid accepted';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: auth.uid required even for authenticated SQL role'; END $$;
SELECT set_config('request.jwt.claim.sub','ad000000-0000-0000-0000-000000000001',true);
UPDATE capability_baseline SET value=public.get_exam_runtime_capabilities();
SELECT pg_temp.assert_true((SELECT value FROM capability_baseline)=
  '{"version":1,"answer_freshness_v1":true,"safe_auto_finalize":true,"question_explanations":true,"attempt_counts":true,"server_clock":true,"exam_editions":true}'::jsonb,
  'new metadata exposes only six independent booleans and version');
RESET ROLE;
-- Removing one canonical signature changes exactly one flag, not the whole RPC.
DO $$ DECLARE signature text; flag text; before_value jsonb;
BEGIN
  SELECT value INTO before_value FROM capability_baseline;
  FOR signature,flag IN SELECT * FROM (VALUES
    ('get_question_explanations(uuid)','question_explanations'),
    ('admin_simulado_attempt_counts(uuid)','attempt_counts'),
    ('get_server_time()','server_clock'),('get_exam_editions()','exam_editions')) v(signature,flag)
  LOOP
    EXECUTE format('ALTER FUNCTION public.%s RENAME TO capability_test_hidden',signature);
    PERFORM pg_temp.assert_true(public.get_exam_runtime_capabilities()=jsonb_set(before_value,ARRAY[flag],'false'),
      'isolated missing signature: '||signature);
    EXECUTE format('ALTER FUNCTION public.capability_test_hidden%s RENAME TO %I',
      substring(signature FROM '\(.*$'),split_part(signature,'(',1));
  END LOOP;
END $$;
ALTER FUNCTION public.finalize_attempt_with_results(uuid,boolean) RENAME TO capability_test_finalizer;
-- Local metadata-only double: a one-argument finalizer must not advertise safe auto-submit.
CREATE FUNCTION public.finalize_attempt_with_results(uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.get_exam_runtime_capabilities()=
  (SELECT jsonb_set(value,'{safe_auto_finalize}','false') FROM capability_baseline), 'one-argument finalizer is not safe_auto_finalize');
RESET ROLE;
DROP FUNCTION public.finalize_attempt_with_results(uuid);
ALTER FUNCTION public.capability_test_finalizer(uuid,boolean) RENAME TO finalize_attempt_with_results;
SELECT pg_temp.assert_true((public.get_exam_runtime_capabilities()->>'safe_auto_finalize')::boolean,
  'two-argument canonical finalizer is ready');
-- Rename, never disable, each guard: its checks still protect rows throughout.
ALTER TRIGGER zzzz_answer_freshness ON public.answers RENAME TO zzzz_answer_freshness_cap_test;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.get_exam_runtime_capabilities()=
  (SELECT jsonb_set(value,'{answer_freshness_v1}','false') FROM capability_baseline), 'missing freshness guard changes only freshness');
RESET ROLE;
ALTER TRIGGER zzzz_answer_freshness_cap_test ON public.answers RENAME TO zzzz_answer_freshness;
ALTER TRIGGER trg_enforce_answer_integrity ON public.answers RENAME TO trg_enforce_answer_integrity_cap_test;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.get_exam_runtime_capabilities()=
  (SELECT jsonb_set(value,'{answer_freshness_v1}','false') FROM capability_baseline), 'missing F0 changes only freshness');
RESET ROLE;
ALTER TRIGGER trg_enforce_answer_integrity_cap_test ON public.answers RENAME TO trg_enforce_answer_integrity;
ALTER FUNCTION public.enforce_answer_freshness() SECURITY DEFINER;
SELECT pg_temp.assert_true(NOT (public.get_exam_runtime_capabilities()->>'answer_freshness_v1')::boolean,
  'definer freshness is not ready');
ALTER FUNCTION public.enforce_answer_freshness() SECURITY INVOKER;
ALTER FUNCTION public.enforce_answer_integrity() SECURITY DEFINER;
SELECT pg_temp.assert_true(NOT (public.get_exam_runtime_capabilities()->>'answer_freshness_v1')::boolean,
  'definer F0 is not ready');
-- Old-deployment metadata: no additive RPCs, only the old finalizer, no freshness column.
ALTER FUNCTION public.finalize_attempt_with_results(uuid,boolean) RENAME TO capability_test_finalizer;
CREATE FUNCTION public.finalize_attempt_with_results(uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
ALTER FUNCTION public.get_question_explanations(uuid) RENAME TO capability_test_explanations;
ALTER FUNCTION public.admin_simulado_attempt_counts(uuid) RENAME TO capability_test_counts;
ALTER FUNCTION public.get_server_time() RENAME TO capability_test_clock;
ALTER FUNCTION public.get_exam_editions() RENAME TO capability_test_editions;
ALTER TABLE public.answers RENAME COLUMN client_updated_at TO capability_test_version;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.get_exam_runtime_capabilities()=
  '{"version":1,"answer_freshness_v1":false,"safe_auto_finalize":false,"question_explanations":false,"attempt_counts":false,"server_clock":false,"exam_editions":false}'::jsonb,
  'old metadata returns all false without breaking the probe');
RESET ROLE;
ROLLBACK;
