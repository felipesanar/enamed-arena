import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshnessTarget } from './answer-freshness-concurrency.mjs';
test('strict freshness target allowlist', () => {
  assert.equal(freshnessTarget({ database: 'enamed_test_answer_freshness_unit' }).host, '127.0.0.1');
  for (const config of [{ database: 'postgres' }, { database: 'enamed_test_other' },
    { database: 'enamed_test_answer_freshness_unit', host: 'example.com' },
    { database: 'enamed_test_answer_freshness_unit', port: 5432 }]) {
    assert.throws(() => freshnessTarget(config));
  }
});
