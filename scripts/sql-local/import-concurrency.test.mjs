import test from 'node:test';
import assert from 'node:assert/strict';
import { localTarget, connectionArgs, cleanEnvironment } from './import-concurrency.mjs';

test('only explicit disposable local postgres targets are allowed', () => {
  assert.deepEqual(localTarget({ database: 'enamed_test_f1_import_review_20261104' }), {
    host: '127.0.0.1', port: 54737, user: 'postgres', database: 'enamed_test_f1_import_review_20261104',
  });
  for (const override of [
    { database: undefined }, { database: 'postgres' }, { database: 'enamed_test_' }, { database: 'enamed_test_a;DROP' },
    { host: 'localhost' }, { host: 'remote' }, { port: 5432 }, { user: 'service_role' },
    { database: 'enamed_test_' + 'a'.repeat(64) },
  ]) {
    assert.throws(() => localTarget({ database: 'enamed_test_fixture', ...override }), /local allowlist/);
  }
});

test('psql never loads rc, waits for passwords, or inherits PG routing', () => {
  const args = connectionArgs({ database: 'enamed_test_fixture' });
  assert.ok(args.includes('-X'));
  assert.ok(args.includes('-w'));
  assert.ok(args.includes('ON_ERROR_STOP=1'));
  assert.ok(args.includes('enamed_test_fixture'));
  const env = cleanEnvironment({ PATH: 'bin', PGHOST: 'remote', PGPORT: '5432', PGPASSWORD: 'secret', PGSERVICE: 'prod' });
  assert.equal(env.PATH, 'bin');
  for (const key of ['PGHOST', 'PGPORT', 'PGPASSWORD', 'PGSERVICE']) assert.equal(env[key], undefined);
  assert.equal(env.PGCONNECT_TIMEOUT, '5');
  assert.equal(env.PGSSLMODE, 'disable');
});
