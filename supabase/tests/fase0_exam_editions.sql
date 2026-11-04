-- Run against a disposable local database AFTER the migration. No production writes.
begin;

do $$
begin
  assert (select count(*) = 3 from public.exam_editions where code in ('2026', '2027.1', '2027.2')), 'missing seeds';
  assert exists (select 1 from public.exam_editions where code = '2026' and status = 'closed'
    and exam_date = '2026-09-13' and exam_date_confirmed and official_results_at = '2026-12-04'), 'incorrect 2026 dates';
  assert (select count(*) = 2 from public.exam_editions where code in ('2027.1', '2027.2')
    and status = 'planned' and exam_date is null and not exam_date_confirmed), 'future dates must be unknown';
  assert (select relrowsecurity from pg_class where oid = 'public.exam_editions'::regclass), 'RLS required';
  assert not (select prosecdef from pg_proc where oid = 'public.get_exam_editions()'::regprocedure), 'RPC must be invoker';
  assert (select provolatile = 's' from pg_proc where oid = 'public.get_exam_editions()'::regprocedure), 'RPC must be stable';
  assert not exists (select 1 from pg_proc p,
    lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.get_exam_editions()'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'no PUBLIC execute';
  assert not has_table_privilege('anon', 'public.exam_editions', 'insert'), 'anon cannot insert';
  assert not has_table_privilege('anon', 'public.exam_editions', 'update'), 'anon cannot update';
  assert not has_table_privilege('anon', 'public.exam_editions', 'delete'), 'anon cannot delete';
end $$;

set local role anon;
do $$
begin
  assert (select count(*) >= 3 from public.get_exam_editions()), 'anon read required';
end $$;
reset role;

-- No JWT means auth.uid() is null: authenticated role alone cannot manage content.
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
do $$
declare affected integer;
begin
  assert (select count(*) >= 3 from public.get_exam_editions()), 'authenticated read required';
  begin
    insert into public.exam_editions (code, year, label) values ('2099.1', 2099, 'ENAMED 2099.1');
    raise exception 'unauthorized insert succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.exam_editions set label = 'forbidden' where code = '2027.1';
  get diagnostics affected = row_count;
  assert affected = 0, 'unauthorized update succeeded';
  delete from public.exam_editions where code = '2027.1';
  get diagnostics affected = row_count;
  assert affected = 0, 'unauthorized delete succeeded';
end $$;
reset role;

-- Exercise the positive capability path with a temporary user/role assignment.
insert into auth.users (id, email) values ('f0000000-0000-0000-0000-000000000001', 'edition-test@example.invalid');
insert into public.user_roles (user_id, role)
select 'f0000000-0000-0000-0000-000000000001', role
from public.role_capabilities where capability = 'content.manage' limit 1;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare affected integer;
begin
  assert public.has_capability('content.manage'), 'test fixture needs a content.manage role';
  insert into public.exam_editions (code, year, term, label) values ('2099.1', 2099, 1, 'ENAMED 2099.1');
  update public.exam_editions set exam_date = '2099-01-01', exam_date_confirmed = true where code = '2099.1';
  get diagnostics affected = row_count;
  assert affected = 1, 'authorized update failed';
  delete from public.exam_editions where code = '2099.1';
  get diagnostics affected = row_count;
  assert affected = 1, 'authorized delete failed';
end $$;
reset role;
rollback;
