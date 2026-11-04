import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localTarget, connectionArgs, cleanEnvironment } from './question-bank-concurrency.mjs';

test('only the isolated local bank database is admitted', () => {
  assert.equal(localTarget({ database: 'enamed_test_bank_5416' }).port, 54737);
  for (const input of [
    {}, { database: 'postgres' }, { database: 'enamed_test_bank_a;DROP DATABASE x' },
    { database: 'enamed_test_bank_a', host: 'localhost' },
    { database: 'enamed_test_bank_a', port: 5432 },
    { database: 'enamed_test_bank_a', user: 'service_role' },
    { database: `enamed_test_bank_${'x'.repeat(64)}` },
  ]) assert.throws(() => localTarget(input), /allowlist/);
});
test('psql uses explicit no-password local arguments', () => {
  const args = connectionArgs({ database: 'enamed_test_bank_unit' });
  assert.deepEqual(args, ['-X', '-w', '-h', '127.0.0.1', '-p', '54737', '-U', 'postgres',
    '-d', 'enamed_test_bank_unit', '-v', 'ON_ERROR_STOP=1']);
});
test('ambient PG routing and credential overrides are removed', () => {
  const env = cleanEnvironment({ PATH: 'preserved', PGHOST: 'remote', PGSERVICE: 'prod', PGPASSWORD: 'secret', pgport: '5432' });
  assert.equal(env.PATH, 'preserved');
  assert.equal(env.PGPASSWORD, undefined);
  assert.equal(env.PGHOST, undefined);
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.pgport, undefined);
  assert.equal(env.PGSSLMODE, 'disable');
  assert.equal(env.PGPASSFILE, process.platform === 'win32' ? 'NUL' : '/dev/null');
});
