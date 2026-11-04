-- Minimal assertion API for the exact signatures used by T2; NOT pgTAP.
-- INVOKER throughout: dynamic SQL executes as the actual SET ROLE caller.
CREATE FUNCTION extensions.no_plan() RETURNS text LANGUAGE sql AS $$ SELECT 'Local assertions (not pgTAP)'::text $$;
CREATE FUNCTION extensions.ok(value boolean, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  PERFORM set_config('sql_local.assertions', (coalesce(nullif(current_setting('sql_local.assertions',true),''),'0')::int+1)::text, true);
  RETURN 'PASS: ' || label;
END $$;
CREATE FUNCTION extensions.is(actual anyelement, expected anyelement, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN RETURN extensions.ok(actual IS NOT DISTINCT FROM expected,label); END $$;
CREATE FUNCTION extensions.throws_ok(statement text, expected_code text, expected_message text, label text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE caught boolean := false; code text; message text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    caught := true;
    GET STACKED DIAGNOSTICS code = RETURNED_SQLSTATE, message = MESSAGE_TEXT;
  END;
  RETURN extensions.ok(caught AND code = expected_code
    AND (expected_message IS NULL OR message = expected_message), label);
END $$;
CREATE FUNCTION extensions.lives_ok(statement text, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN extensions.ok(true,label);
END $$;
CREATE FUNCTION extensions.finish() RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE n integer := coalesce(nullif(current_setting('sql_local.assertions',true),''),'0')::integer;
BEGIN
  IF n = 0 THEN RAISE EXCEPTION 'No assertions executed'; END IF;
  RETURN NEXT format('LOCAL ASSERTIONS EXECUTED: %s',n);
END $$;
