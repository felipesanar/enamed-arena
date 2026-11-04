import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSessionTarget, runAdminSessionConcurrency } from './admin-session-concurrency.mjs';

test('rejects nonexclusive and remote targets before opening a connection', () => {
  for (const config of [{ database:'postgres' }, {database:'enamed_test_admin_session_qa',host:'example.invalid'},
    {database:'enamed_test_admin_session_qa',port:5432}, {database:'enamed_test_admin_session_qa',user:'authenticated'}]) {
    assert.throws(() => adminSessionTarget(config));
  }
  assert.equal(adminSessionTarget({database:'enamed_test_admin_session_qa'}).port,54737);
});

test('real PostgreSQL: NOWAIT versus finalizer and concurrent first snapshot', {skip: !process.env.ADMIN_SESSION_TEST_DB && 'Set ADMIN_SESSION_TEST_DB to an exclusive local clone'}, async () => {
  await runAdminSessionConcurrency({database:process.env.ADMIN_SESSION_TEST_DB});
});
