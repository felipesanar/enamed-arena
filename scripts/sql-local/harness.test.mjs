import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { target, connectionArgs, createDatabaseArgs, extraSqlFile, cleanEnvironment, localMigration, migrationPlan, redact, runChecked } from './harness.mjs';

test('disposable creation pins UTF8 ICU en-US and validates both connection targets', () => {
  const maintenance = target({ database: 'enamed_test_fase0' });
  const args = createDatabaseArgs(maintenance, 'enamed_test_unicode');
  assert.deepEqual(args, ['-w', '-h', '127.0.0.1', '-p', '54737', '-U', 'postgres',
    '--maintenance-db=enamed_test_fase0', '--template=template0', '--encoding=UTF8',
    '--locale-provider=icu', '--icu-locale=en-US', 'enamed_test_unicode']);
  assert.throws(() => createDatabaseArgs(maintenance, 'postgres'), /allowlist/);
  assert.throws(() => createDatabaseArgs({ ...maintenance, port: 5432 }, 'enamed_test_unicode'), /allowlist/);
});

test('extra SQL accepts only real scoped workspace files, recording their bytes hash', () => {
  const root = resolve('.');
  const file = extraSqlFile('supabase/tests/fase0_exam_integrity.sql', 'test', root);
  assert.equal(file.path, resolve('supabase/tests/fase0_exam_integrity.sql'));
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  for (const path of ['../outside.sql', 'package.json', '.env', 'supabase/tests/local/guard.sql']) {
    assert.throws(() => extraSqlFile(path, 'test', root), /Extra SQL/);
  }
  assert.throws(() => extraSqlFile(file.path, 'migration', root), /Extra SQL/);
  assert.throws(() => extraSqlFile(file.path, 'test', resolve('scripts')), /Extra SQL/);
});

test('CLI rejects invalid extra paths before artifacts or any PostgreSQL command', () => {
  for (const args of [['--mode', 'catalog', '--catalog', 'not-read.json', '--extra-migration', 'package.json'],
    ['--mode', 'catalog', '--catalog', 'not-read.json', '--extra-test', '../outside.sql'],
    ['--mode', 'integrations', '--extra-test', 'supabase/tests/fase0_exam_integrity.sql']]) {
    const result = spawnSync(process.execPath, ['scripts/sql-local/run.mjs', ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Extra SQL|extras require/);
    assert.doesNotMatch(result.stdout, /"report"/);
  }
});

test('only the exact loopback endpoint, postgres and simple disposable names are accepted', () => {
  assert.equal(target({ database: 'enamed_test_seed' }).database, 'enamed_test_seed');
  for (const change of [
    { host: 'localhost' }, { host: '127.0.0.2' }, { host: 'example.com' },
    { port: 5432 }, { user: 'service_role' }, { database: 'postgres' },
    { database: 'enamed_test_' }, { database: 'enamed_test_x;DROP DATABASE postgres' },
    { database: 'enamed_test_x host=other' }, { database: 'enamed_test_../x' },
  ]) assert.throws(() => target({ database: 'enamed_test_seed', ...change }), /allowlist/);
});

test('psql ignores rc, never prompts, stops on errors and pins all connection fields', () => {
  const args = connectionArgs(target({ database: 'enamed_test_seed' }));
  assert.deepEqual(args, ['-X', '-w', '-h', '127.0.0.1', '-p', '54737', '-U', 'postgres', '-d', 'enamed_test_seed', '-v', 'ON_ERROR_STOP=1']);
});

test('libpq environment cannot redirect connection, load a service/password file or inject options', () => {
  const env = cleanEnvironment({ PATH: 'ok', PGHOST: 'remote', pgservice: 'prod', PGPASSFILE: 'secret', PGOPTIONS: '-c role=evil' });
  assert.equal(env.PATH, 'ok');
  assert.ok(!Object.keys(env).some(k => /^pg/i.test(k) && !['PGCONNECT_TIMEOUT', 'PGAPPNAME', 'PGPASSFILE', 'PGSSLMODE'].includes(k)));
  assert.notEqual(env.PGPASSFILE, 'secret');
  assert.equal(env.PGSSLMODE, 'disable');
  assert.equal(env.PGCONNECT_TIMEOUT, '5');
});

test('local compatibility is narrow, explicit and never modifies F0 auth/score bodies', () => {
  const source = 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;\nSELECT 1;';
  const adapted = localMigration('20260402191728_dc90eb2b-fd1d-4bbf-8a46-9fbf44029c1b.sql', source);
  assert.ok(!adapted.sql.includes('CREATE EXTENSION'));
  assert.equal(adapted.deviations.length, 1);
  assert.equal(localMigration('20261104052758_fase0_exam_integrity.sql', source).sql, source);
  assert.throws(() => localMigration('20260402191728_dc90eb2b-fd1d-4bbf-8a46-9fbf44029c1b.sql', 'SELECT 1'), /expected/);
});

test('replay is sorted, stops at F0, and never silently skips failed/duplicate migrations', () => {
  assert.deepEqual(migrationPlan(['20261104052626_fase0_exam_editions.sql', '20270101000000_future.sql', '20260314011304_first.sql']),
    ['20260314011304_first.sql', '20261104052626_fase0_exam_editions.sql']);
  assert.throws(() => migrationPlan(['_STAGING_bad.sql']), /Unexpected/);
});

test('nonzero exit, signals and spawn failure are failures, not green SQL evidence', () => {
  for (const result of [{ status: 3, stderr: 'SQL failed' }, { status: null, signal: 'SIGTERM' }, { error: new Error('ENOENT') }]) {
    assert.throws(() => runChecked('ignored', [], () => result), /failed/);
  }
  assert.equal(runChecked('ignored', [], () => ({ status: 0, stdout: 'real result' })), 'real result');
});

test('logs redact JWT-like literals rather than publishing historical embedded tokens', () => {
  assert.equal(redact('error eyJhbGciOi.xxxxx.yyyyy end'), 'error [REDACTED_JWT] end');
});

test('CLI rejects disallowed connections before spawning PostgreSQL or creating artifacts', () => {
  for (const args of [ ['--host', 'localhost'], ['--port', '5432'], ['--maintenance-db', 'postgres'], ['--user', 'other'] ]) {
    const result = spawnSync(process.execPath, ['scripts/sql-local/run.mjs', ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /allowlist/);
    assert.doesNotMatch(result.stdout, /"report"/);
  }
});

test('cleanup refuses reports outside its artifact directory before any dropdb call', () => {
  const result = spawnSync(process.execPath, ['scripts/sql-local/cleanup.mjs', 'package.json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Pass one existing/);
});

test('local SQL helper refuses out-of-scope files and non-disposable databases', () => {
  for (const [database, file, message] of [
    ['enamed_test_seed', 'package.json', /Only scoped/],
    ['enamed_test_seed', 'supabase/tests/local/../fase0_exam_integrity.sql', /Only scoped/],
    ['postgres', 'supabase/tests/local/inspect-audit.sql', /allowlist/],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/sql-local/check-file.mjs', database, file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /Command failed/);
  }
});
