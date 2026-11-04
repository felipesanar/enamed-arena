import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PG_BIN, target, connectionArgs, createDatabaseArgs, extraSqlFile, runChecked, migrationPlan, localMigration, redact } from './harness.mjs';
import { restoreCatalog } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--maintenance-db', '--host', '--port', '--user', '--mode', '--catalog', '--extra-migration', '--extra-test'].includes(key) || !process.argv[i + 1] || options[key]) {
    throw new Error('Usage: node scripts/sql-local/run.mjs --maintenance-db enamed_test_EXISTING [--mode all|integrations|catalog] [--catalog authorized-input.json] [--extra-migration workspace-file.sql] [--extra-test workspace-fixture.sql]');
  }
  options[key] = process.argv[i + 1];
}
const maintenance = target({ database: options['--maintenance-db'] ?? 'enamed_test_fase0',
  host: options['--host'], port: options['--port'], user: options['--user'] });
const mode = options['--mode'] ?? 'all';
if (!['all', 'integrations', 'catalog'].includes(mode)) throw new Error('Unknown mode');
if ((mode === 'catalog') !== Boolean(options['--catalog'])) throw new Error('--mode catalog requires explicit --catalog input (and vice versa)');
if (mode !== 'catalog' && (options['--extra-migration'] || options['--extra-test'])) throw new Error('extras require catalog mode');
// Explicit sibling worktrees belong to this repository workspace, never arbitrary external paths.
const workspace = resolve(root, '../../../..');
const extraMigration = options['--extra-migration'] ? extraSqlFile(options['--extra-migration'], 'migration', workspace) : null;
const extraTest = options['--extra-test'] ? extraSqlFile(options['--extra-test'], 'test', workspace) : null;
const runId = `${new Date().toISOString().replace(/[^0-9]/g, '')}_${process.pid}`;
const output = join(root, 'scripts/sql-local/runs', runId);
mkdirSync(output, { recursive: true });
const report = { runId, endpoint: maintenance, mode, productionEquivalent: false, status: 'running',
  databases: [], locales: [], localeLimit: 'ICU en-US approximates Unicode behavior of libc en_US.UTF-8; not full ordering/collation equivalence.',
  extras: { migration: extraMigration ? { ...extraMigration, status: 'not_run' } : null,
    test: extraTest ? { ...extraTest, status: 'not_run' } : null },
  steps: [], migrations: [], tests: Object.fromEntries([
    'exam_editions', 'exam_integrity', 'question_release', 'safe_finalization', 'preserve_history', 'integration_jobs',
  ].map(name => [name, 'not_run'])) };
const save = () => writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
let step = 0;
function psql(db, label, args) {
  const log = `${String(++step).padStart(3, '0')}-${label}.log`;
  try {
    const result = runChecked(join(PG_BIN, 'psql.exe'), [...connectionArgs(target({ database: db })), ...args], undefined, { cwd: root });
    writeFileSync(join(output, log), result);
    report.steps.push({ label, status: 'passed', log }); save();
    return result;
  } catch (error) {
    writeFileSync(join(output, log), redact(error.message));
    report.steps.push({ label, status: 'failed', log }); save();
    throw error;
  }
}
const file = (db, label, path) => psql(db, label, ['-f', join(root, 'supabase/tests/local/guard.sql'), '-f', path]);
function create(suffix) {
  const db = target({ database: `enamed_test_sqlqa_${runId}_${suffix}` }).database;
  // No fallback to postgres/template1: libpq maintenance connection is also allowlisted.
  runChecked(join(PG_BIN, 'createdb.exe'), createDatabaseArgs(maintenance, db));
  report.databases.push(db); save();
  const locale = psql(db, `locale-${suffix}`, ['-q', '-t', '-A',
    '-f', join(root, 'supabase/tests/local/guard.sql'), '-f', join(root, 'supabase/tests/local/locale-check.sql')]);
  report.locales.push(JSON.parse(locale.trim())); save();
  return db;
}
try {
  let catalog;
  if (mode === 'catalog') {
    const bytes = readFileSync(resolve(options['--catalog']));
    catalog = restoreCatalog(JSON.parse(bytes.toString('utf8')));
    report.catalog = { sha256: createHash('sha256').update(bytes).digest('hex'), ...catalog.summary, deviations: catalog.deviations };
    writeFileSync(join(output, 'restore-catalog.sql'), catalog.sql);
    writeFileSync(join(output, 'verify-catalog.sql'), catalog.verificationSql); save();
  }
  file(maintenance.database, 'preflight', join(root, 'supabase/tests/local/preflight.sql'));
  const integration = create('t6');
  try {
    file(integration, 'T6-integration-jobs', join(root, 'supabase/tests/fase0_integration_jobs.sql'));
    report.tests.integration_jobs = 'passed';
  } catch (error) { report.tests.integration_jobs = 'failed'; }
  if (mode !== 'integrations') {
    const db = create(mode === 'catalog' ? 'catalog' : 'replay');
    psql(db, 'bootstrap-doubles', [...(mode === 'catalog' ? ['-v', 'catalog_restore=true'] : []),
      '-f', join(root, 'supabase/tests/local/guard.sql'), '-f', join(root, 'supabase/tests/local/bootstrap.sql')]);
    file(db, 'assertions-selftest', join(root, 'supabase/tests/local/assertions-selftest.sql'));
    if (catalog) {
      file(db, 'restore-catalog', join(output, 'restore-catalog.sql'));
      file(db, 'verify-catalog', join(output, 'verify-catalog.sql'));
    }
    const migrations = join(root, 'supabase/migrations');
    for (const name of migrationPlan(readdirSync(migrations).filter(name => name.endsWith('.sql')))) {
      if (catalog && name < '20261104000000') continue; // Snapshot replaces legacy replay, NOT a failed-migration skip.
      const original = readFileSync(join(migrations, name), 'utf8');
      const adapted = localMigration(name, original);
      const entry = { name, sha256: createHash('sha256').update(original).digest('hex'), deviations: adapted.deviations, status: 'running' };
      report.migrations.push(entry); save();
      // Absolute include avoids psql's file-relative ambiguity. No failed SQL is skipped.
      const generated = join(output, 'current-migration.sql');
      writeFileSync(generated, adapted.sql);
      try { file(db, `migration-${name.slice(0, 14)}`, generated); entry.status = 'passed'; }
      catch (error) { entry.status = 'failed'; throw error; }
    }
    if (extraMigration) {
      const entry = report.extras.migration;
      if (extraSqlFile(entry.path, 'migration', workspace).sha256 !== entry.sha256) throw new Error('Extra SQL changed since validation');
      try { file(db, 'extra-migration', entry.path); entry.status = 'passed'; save(); }
      catch (error) { entry.status = 'failed'; throw error; }
    }
    file(db, 'double-and-role-checks', join(root, 'supabase/tests/local/double-checks.sql'));
    for (const name of ['exam_editions', 'exam_integrity', 'question_release', 'safe_finalization', 'preserve_history']) {
      try {
        psql(db, `test-${name}`, ['-v', 'sql_local=true', '-f', join(root, 'supabase/tests/local/guard.sql'),
          '-f', join(root, `supabase/tests/fase0_${name}.sql`)]);
        report.tests[name] = 'passed'; save();
      } catch (error) { report.tests[name] = 'failed'; save(); }
    }
    if (extraTest) {
      const entry = report.extras.test;
      if (extraSqlFile(entry.path, 'test', workspace).sha256 !== entry.sha256) throw new Error('Extra SQL changed since validation');
      try {
        psql(db, 'extra-test', ['-v', 'sql_local=true', '-f', join(root, 'supabase/tests/local/guard.sql'), '-f', entry.path]);
        entry.status = 'passed';
      } catch (error) { entry.status = 'failed'; }
      save();
    }
    file(db, 'state-after-fixtures', join(root, 'supabase/tests/local/state-check.sql'));
  }
  report.status = Object.values(report.tests).includes('failed') || report.extras.test?.status === 'failed' ? 'tests_failed' : 'completed';
  if (report.status === 'tests_failed') process.exitCode = 1;
} catch (error) {
  report.status = 'blocked_or_failed'; report.error = redact(error.message);
  process.exitCode = 1;
} finally {
  save();
  console.log(JSON.stringify({ report: join(output, 'report.json'), status: report.status, tests: report.tests }, null, 2));
}
