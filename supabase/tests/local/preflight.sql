-- Read-only. Roles are cluster-global: the harness NEVER creates/alters them.
DO $$
DECLARE r record;
BEGIN
  IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = session_user) THEN
    RAISE EXCEPTION 'Disposable fixture requires existing local postgres superuser';
  END IF;
  FOR r IN SELECT name FROM unnest(ARRAY['anon','authenticated','service_role']) AS name LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r.name) THEN
      RAISE EXCEPTION 'Operator must provision existing LOCAL role: %', r.name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
    OR pg_has_role('authenticated', 'service_role', 'MEMBER')
    OR pg_has_role('anon', 'service_role', 'MEMBER')
    OR pg_has_role('authenticated', 'postgres', 'MEMBER')
    OR pg_has_role('anon', 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'Unsafe role membership/attributes would invalidate RLS tests';
  END IF;
  IF NOT (SELECT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role must have Supabase-like BYPASSRLS, not SUPERUSER';
  END IF;
END $$;
SELECT current_database(), inet_server_addr(), inet_server_port(), version();
