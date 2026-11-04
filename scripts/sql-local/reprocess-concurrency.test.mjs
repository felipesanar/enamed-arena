import test from 'node:test';
import assert from 'node:assert/strict';
import { localTarget, connectionArgs, cleanEnvironment } from './reprocess-concurrency.mjs';

test('only the dedicated disposable local database is accepted', () => {
  assert.equal(localTarget({ database: 'enamed_test_reprocess_3aaa' }).port, 54737);
  for (const config of [
    {}, { database: 'postgres' }, { database: 'enamed_test_f1_admin_review_20261104' },
    { database: 'enamed_test_reprocess_x;DROP' }, { database: 'enamed_test_reprocess_' + 'x'.repeat(64) },
    { database: 'enamed_test_reprocess_x', host: 'localhost' },
    { database: 'enamed_test_reprocess_x', host: 'db.example.invalid' },
    { database: 'enamed_test_reprocess_x', port: 5432 },
    { database: 'enamed_test_reprocess_x', user: 'service_role' },
  ]) assert.throws(() => localTarget(config), /allowlist/);
});
test('psql is bounded and cannot inherit a remote service or password', () => {
  const args = connectionArgs({ database: 'enamed_test_reprocess_x' });
  assert.deepEqual(args, ['-X', '-w', '-h', '127.0.0.1', '-p', '54737', '-U', 'postgres',
    '-d', 'enamed_test_reprocess_x', '-v', 'ON_ERROR_STOP=1']);
  const env = cleanEnvironment({ PGHOST: 'remote', PGSERVICE: 'prod', PGPASSWORD: 'secret', PATH: 'ok' });
  assert.equal(env.PGHOST, undefined);
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGPASSWORD, undefined);
  assert.equal(env.PATH, 'ok');
  assert.equal(env.PGCONNECT_TIMEOUT, '5');
});
