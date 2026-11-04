BEGIN;
SELECT set_config('request.jwt.claims','{}',true);
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
  ASSERT auth.uid() IS NULL, 'missing subject must stay NULL';
  ASSERT NOT public.has_capability('content.manage'), 'missing UID must not gain capability';
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
  ASSERT auth.uid()='10000000-0000-0000-0000-000000000001'::uuid, 'JSON claims subject';
  ASSERT auth.role()='authenticated', 'JSON claims role';
  ASSERT NOT public.has_capability('content.manage'), 'unassigned UID must not gain capability';
  ASSERT NOT has_schema_privilege('authenticated','vault','USAGE'), 'Vault must remain private';
  ASSERT NOT has_schema_privilege('anon','net','USAGE'), 'transport must remain private';
  ASSERT NOT EXISTS (
    SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proowner <> (SELECT oid FROM pg_roles WHERE rolname='postgres')
  ), 'definer owner must be the trusted migration role';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT current_user='authenticated' AND session_user='postgres', 'SET ROLE must really change SQL identity';
  ASSERT NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname=current_user), 'RLS cannot be bypassed';
END $$;
RESET ROLE;
ROLLBACK;
