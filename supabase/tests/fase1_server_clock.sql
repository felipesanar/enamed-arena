-- Run against a disposable database after the migration, never production.
begin;
do $$
declare
  fn record;
begin
  select * into strict fn from pg_proc where oid = 'public.get_server_time()'::regprocedure;
  assert not fn.prosecdef, 'get_server_time must be SECURITY INVOKER';
  assert fn.provolatile = 's', 'get_server_time must be STABLE';
  assert fn.prorettype = 'timestamptz'::regtype, 'unexpected return type';
  assert has_function_privilege('authenticated', fn.oid, 'EXECUTE'), 'authenticated execute missing';
  assert not has_function_privilege('anon', fn.oid, 'EXECUTE'), 'anon execute forbidden';
  assert not exists (select 1 from aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner)))
    where grantee = 0 and privilege_type = 'EXECUTE'), 'PUBLIC execute forbidden';
end $$;
set local role authenticated;
do $$
begin
  assert public.get_server_time() = current_timestamp, 'server time must use transaction timestamp';
end $$;
rollback;
