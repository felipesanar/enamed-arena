import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreCatalog, parseAcl } from './catalog.mjs';

const sample = () => ({ captured_at: 'synthetic',
  relations: [{ name: 'questions', kind: 'r', owner: 'postgres', rls: true, force_rls: true, acl: '{postgres=arwdDxtm/postgres,authenticated=r/postgres}' }],
  columns: [{ schema: 'public', table: 'questions', name: 'id', type: 'uuid', default: 'gen_random_uuid()', not_null: true, identity: '', generated: '' },
    { schema: 'public', table: 'questions', name: 'explanation', type: 'text', default: null, not_null: false, identity: '', generated: '' }],
  enums: [], extensions: [], views: [], indexes: [], triggers: [], auth_public_triggers: [],
  constraints: [{ table: 'questions', name: 'questions_pkey', kind: 'p', definition: 'PRIMARY KEY (id)', validated: true }],
  functions: [{ name: 'test', signature: 'p_id uuid', owner: 'postgres', acl: '{postgres=X/postgres,authenticated=X/postgres}',
    definition: 'CREATE OR REPLACE FUNCTION public.test(p_id uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER AS $$ SELECT p_id $$' }],
  policies: [{ schemaname: 'public', tablename: 'questions', policyname: 'own', permissive: 'RESTRICTIVE', cmd: 'SELECT', roles: ['authenticated'], qual: 'id = auth.uid()', with_check: null }],
  column_acls: [{ table: 'questions', column: 'explanation', acl: '{service_role=r/postgres}' }], default_acls: [], role_capabilities: [],
});

test('catalog restore preserves RLS, function definition, exact table/column ACLs and policies', () => {
  const result = restoreCatalog(sample());
  assert.match(result.sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(result.sql, /SECURITY INVOKER/);
  assert.match(result.sql, /GRANT SELECT \("explanation"\) ON TABLE "public"\."questions" TO "service_role"/);
  assert.match(result.sql, /AS RESTRICTIVE FOR SELECT TO "authenticated" USING \(id = auth.uid\(\)\)/);
  assert.doesNotMatch(result.sql, /GRANT ALL ON ALL TABLES/);
  assert.ok(result.sql.indexOf('CREATE TABLE') < result.sql.indexOf('CREATE OR REPLACE FUNCTION'));
  assert.ok(result.sql.indexOf('CREATE OR REPLACE FUNCTION') < result.sql.indexOf('SET DEFAULT'));
  assert.match(result.verificationSql, /aclexplode/);
  assert.match(result.verificationSql, /attacl/);
  assert.match(result.verificationSql, /relforcerowsecurity/);
});

test('missing ACL capture fails closed, rather than inventing table or column grants', () => {
  for (const field of ['column_acls', 'default_acls', 'auth_public_triggers', 'role_capabilities']) {
    const data = sample(); delete data[field];
    assert.throws(() => restoreCatalog(data), new RegExp(field));
  }
  const data = sample(); delete data.relations[0].acl;
  assert.throws(() => restoreCatalog(data), /acl/);
});

test('ACL supports PUBLIC, grant options and MAINTAIN; rejects unknown encodings', () => {
  assert.deepEqual(parseAcl('{=X/postgres,authenticated=r*/postgres}'), [
    { role: 'PUBLIC', privilege: 'EXECUTE', grantOption: false },
    { role: 'authenticated', privilege: 'SELECT', grantOption: true },
  ]);
  assert.equal(parseAcl('{postgres=m/postgres}')[0].privilege, 'MAINTAIN');
  assert.throws(() => parseAcl('{evil=z/postgres}'), /ACL/);
});

test('constraints retain validation state and backing indexes are not duplicated', () => {
  const data = sample();
  data.constraints.push({ table: 'questions', name: 'check_id', kind: 'c', definition: 'CHECK (id IS NOT NULL)', validated: false });
  data.indexes.push({ table: 'questions', name: 'questions_pkey', definition: 'CREATE UNIQUE INDEX questions_pkey ON public.questions(id)' });
  const result = restoreCatalog(data);
  assert.match(result.sql, /CHECK \(id IS NOT NULL\) NOT VALID/);
  assert.doesNotMatch(result.sql, /CREATE UNIQUE INDEX questions_pkey/);
  assert.match(result.verificationSql, /pg_get_constraintdef\(oid,true\)/);
});

test('identity/generated columns, unknown owner/roles and missing view definitions cannot be silently lost', () => {
  const data = sample(); data.columns[0].identity = 'a';
  assert.throws(() => restoreCatalog(data), /identity/);
  const owner = sample(); owner.relations[0].owner = 'untrusted';
  assert.throws(() => restoreCatalog(owner), /owner/);
  const role = sample(); role.relations[0].acl = '{untrusted=r/postgres}';
  assert.throws(() => restoreCatalog(role), /role/);
  const view = sample(); view.relations[0].kind = 'v';
  assert.throws(() => restoreCatalog(view), /view/);
});

test('capabilities are explicit captured seed data, not fake has_capability results', () => {
  const data = sample(); data.role_capabilities = [{ role: 'admin', capability: 'results.view' }];
  const result = restoreCatalog(data);
  assert.match(result.sql, /INSERT INTO public.role_capabilities/);
  assert.match(result.sql, /'admin', 'results.view'/);
  assert.equal(result.summary.capabilitySeedRows, 1);
});
