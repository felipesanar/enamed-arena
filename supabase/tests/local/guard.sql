\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database() !~ '^enamed_test_[a-z0-9_]+$'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 54737
    OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Outside SQL local allowlist';
  END IF;
  IF current_setting('plpgsql.check_asserts') <> 'on' THEN
    RAISE EXCEPTION 'Assertions must be enabled';
  END IF;
END $guard$;
