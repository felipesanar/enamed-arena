import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminTarget, cleanEnvironment, barrierSql } from './admin-editions-concurrency.mjs';

test('only the explicit local admin sandbox and template are allowed', () => {
  assert.equal(adminTarget({ database: 'enamed_test_admin_unit' }).port, 54737);
  for (const value of [
    { host: 'localhost' }, { host: 'example.com' }, { port: 5432 }, { user: 'other' },
    { database: 'postgres' }, { database: 'enamed_test_f1_admin_review_20261104' },
    { database: 'enamed_test_admin_x;drop database x' }, { database: `enamed_test_admin_${'x'.repeat(64)}` },
    { template: 'postgres' },
  ]) assert.throws(() => adminTarget({ database: 'enamed_test_admin_unit', ...value }), /allowlist/);
});

test('ambient PG configuration cannot redirect connections or supply credentials', () => {
  const env = cleanEnvironment({ PATH: 'bin', PGHOST: 'remote', PGPORT: '5432', PGPASSWORD: 'not-used', PGSERVICE: 'remote' });
  assert.equal(env.PATH, 'bin');
  assert.equal(env.PGHOST, undefined);
  assert.equal(env.PGPASSWORD, undefined);
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGSSLMODE, 'disable');
});

test('barrier requires the actual backend blocker and an ungranted server lock', () => {
  const sql = barrierSql(123, 456);
  for (const fragment of ['pg_stat_activity', 'pg_locks', 'pg_blocking_pids', "wait_event_type='Lock'", 'NOT l.granted', '123', '456']) assert.ok(sql.includes(fragment));
  assert.throws(() => barrierSql('123 OR true', 456), /pid/);
});

test('tablet action keeps its label on one line without changing mobile cards', () => {
  const css = readFileSync(new URL('../../src/admin/components/editions/editions.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(min-width:601px\)\s*and\s*\(max-width:1100px\)/);
  assert.match(css, /\.editions-table td:last-child\s*\{[^}]*padding-inline:6px/);
  assert.match(css, /\.editions-table td:last-child button\s*\{[^}]*white-space:nowrap/);
  assert.match(css, /\.editions-table td\s*\{\s*display:block; padding:0;/);
});
