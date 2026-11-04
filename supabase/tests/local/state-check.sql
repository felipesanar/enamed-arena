-- Read-only handoff checks, never return fixture/person data.
SELECT current_database() AS database, inet_server_addr() AS host, inet_server_port() AS port;
SELECT count(*) AS users_after_rollback FROM auth.users;
SELECT count(*) AS attempts_after_rollback FROM public.attempts;
SELECT count(*) AS fixture_simulados_after_rollback FROM public.simulados
WHERE slug LIKE 'fase0-%' OR slug='local-audit-release-repro';
SELECT count(*) AS captured_capabilities FROM public.role_capabilities;
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname;
