import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTarget, validateFixture } from './fixtures-integrated.mjs';

test('target is restricted to the authorized local disposable clone', () => {
  assert.doesNotThrow(() => validateTarget('enamed_test_fixtures_integrated_20261104_0cb2'));
  for (const db of ['postgres', 'production', 'enamed_test_integrated_20261104_0920',
    'enamed_test_fixtures_integrated_x;DROP DATABASE postgres', 'enamed_test_other']) {
    assert.throws(() => validateTarget(db));
  }
});

test('runner accepts only named QA fixtures, not migrations or path traversal', () => {
  assert.equal(validateFixture('fase0_safe_finalization.sql'), 'fase0_safe_finalization.sql');
  for (const name of ['../migrations/a.sql', 'fase3_any.sql', '../fase0_any.sql', 'fase0_a.sql;']) {
    assert.throws(() => validateFixture(name));
  }
});
