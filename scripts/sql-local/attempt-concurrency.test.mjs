import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concurrencyTarget, runConcurrency } from './attempt-concurrency.mjs';

test('only an exclusive disposable attempt database on the local allowlist is accepted', () => {
  assert.equal(concurrencyTarget({ database: 'enamed_test_attempt_unit' }).database, 'enamed_test_attempt_unit');
  for (const config of [{ database: 'postgres' }, { database: 'enamed_test_other' },
    { database: 'enamed_test_attempt_unit', host: 'production' },
    { database: 'enamed_test_attempt_unit', port: 5432 },
    { database: 'enamed_test_attempt_unit', user: 'authenticated' }]) {
    assert.throws(() => concurrencyTarget(config));
  }
});

test('two real PostgreSQL sessions respect create, counter and finalization barriers', {
  skip: !process.env.ATTEMPT_CONCURRENCY_DATABASE, timeout: 60000,
}, async () => {
  const report = await runConcurrency({ database: process.env.ATTEMPT_CONCURRENCY_DATABASE });
  assert.equal(report.connections,2);
  assert.equal(report.evidence.filter(line => line.includes('pg_blocking_pids')).length,4);
  assert.ok(report.evidence.some(line => line.includes('one row')));
  assert.ok(report.evidence.some(line => line.includes('tab=25, fullscreen=17')));
  assert.ok(report.evidence.some(line => line.includes('persisted score=100')));
  assert.ok(report.evidence.some(line => line.includes('rejected, answers=0, score remains 0')));
});
