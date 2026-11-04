import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutoffTarget, runReview } from './cutoff-concurrency.mjs';

test('cutoff harness only accepts the exact local server and disposable cutoff databases', () => {
  assert.deepEqual(cutoffTarget({ database: 'enamed_test_cutoff_unit' }), {
    host: '127.0.0.1', port: 54737, user: 'postgres', database: 'enamed_test_cutoff_unit',
  });
  for (const config of [{}, { database: 'postgres' }, { database: 'enamed_test_f1_target_review_20261104' },
    { database: 'enamed_test_cutoff_' }, { database: 'enamed_test_cutoff_x;DROP' },
    { database: 'enamed_test_cutoff_x', host: 'localhost' },
    { database: 'enamed_test_cutoff_x', host: 'production' },
    { database: 'enamed_test_cutoff_x', port: 5432 },
    { database: 'enamed_test_cutoff_x', user: 'authenticated' },
    { database: `enamed_test_cutoff_${'x'.repeat(64)}` }]) assert.throws(() => cutoffTarget(config));
});

test('psql -f is atomic, fixture reapply never commits seeds, and real imports serialize only their reference', {
  skip: !process.env.CUTOFF_REVIEW_DATABASE, timeout: 120000,
}, async context => {
  // Must start from a pristine clone of enamed_test_f1_target_review_20261104.
  // The runner never creates/drops databases and never cleans another run's IDs.
  const report = await runReview({ database: process.env.CUTOFF_REVIEW_DATABASE });
  assert.equal(report.atomicity.failures, 2);
  assert.equal(report.atomicity.catalogAndDataUnchanged, true);
  assert.equal(report.fixture.assertions, 47);
  assert.equal(report.fixture.noCommittedSeeds, true);
  assert.equal(report.concurrency.maxConnections, 2);
  assert.equal(report.concurrency.sameReference.winner.imported, 2);
  assert.equal(report.concurrency.sameReference.loser.imported, 0);
  assert.equal(report.concurrency.sameReference.loser.ok, false);
  assert.match(report.concurrency.sameReference.loser.errors[0].message, /already exists/);
  assert.match(report.concurrency.staleSnapshot.loser.errors[0].message, /23505/);
  assert.equal(report.concurrency.staleSnapshot.loser.imported, 0);
  assert.equal(report.concurrency.differentReferenceNotBlocked, true);
  assert.equal(report.concurrency.noSyntheticRemainders, true);
  context.diagnostic(JSON.stringify(report));
});
