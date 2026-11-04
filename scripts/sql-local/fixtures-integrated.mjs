import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateTarget(db) {
  if (!/^enamed_test_fixtures_integrated_[a-z0-9_]+$/.test(db ?? '')) {
    throw new Error('Only a dedicated enamed_test_fixtures_integrated_* clone is allowed');
  }
}

export function validateFixture(name) {
  if (!/^fase[012]_[a-z0-9_]+\.sql$/.test(name ?? '')) throw new Error('Invalid QA fixture');
  return name;
}

const guard = `SELECT 1/((inet_server_addr()='127.0.0.1'::inet
  AND inet_server_port()=54737 AND current_database() ~ '^enamed_test_[a-z0-9_]+$'
  AND session_user='postgres' AND current_user='postgres' AND auth.uid() IS NULL
  AND coalesce(current_setting('request.jwt.claim.sub',true),'')=''
  AND coalesce(current_setting('request.jwt.claim.role',true),'')=''
  AND coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb='{}'::jsonb)::int);`;

function psql(db, args) {
  return spawnSync(resolve('../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe'),
    ['-X', '-w', '-h', '127.0.0.1', '-p', '54737', '-U', 'postgres', '-d', db,
      '-v', 'ON_ERROR_STOP=1', '-v', 'sql_local=1', '-c', guard,
      '-c', 'SET plpgsql.check_asserts=on;', ...args],
    { encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [db, ...fixtures] = process.argv.slice(2);
  validateTarget(db);
  if (fixtures.length === 0) throw new Error('Pass --clone or explicit fixture filenames');
  const logDir = resolve('.superpowers/fixturesQA');
  mkdirSync(logDir, { recursive: true });
  if (fixtures.length === 1 && fixtures[0] === '--clone') {
    const result = psql('enamed_test_integrated_20261104_0920', [
      '-c', `CREATE DATABASE ${db} TEMPLATE enamed_test_integrated_20261104_0920;`,
    ]);
    writeFileSync(resolve(logDir, `${db}-clone.log`), (result.stdout ?? '') + (result.stderr ?? ''));
    if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
    console.log(`Created ${db}; template was not modified`);
  } else {
    for (const name of fixtures) if (name !== '--guards') validateFixture(name);
    const results = [];
    for (const name of fixtures) {
      const file = name === '--guards' ? 'local/fixture_publication_guards.sql' : name;
      const result = psql(db, ['-f', resolve('supabase/tests', file)]);
      const output = (result.stdout ?? '') + (result.stderr ?? '') + (result.error?.message ?? '');
      const log = resolve(logDir, `${db}-${basename(name, '.sql')}-${Date.now()}.log`);
      writeFileSync(log, output);
      results.push({ fixture: file, exit: result.status,
        completed_do_blocks: (output.match(/^DO\r?$/gm) ?? []).length,
        reported_passes: (output.match(/PASS:/g) ?? []).length,
        errors: output.split('\n').filter(line => line.includes('ERROR:')), log });
      console.log(`${name}: exit=${result.status} completed_do_blocks=${(output.match(/^DO\r?$/gm) ?? []).length}; log=${log}`);
      if (result.status !== 0 || result.error) process.exitCode = 1;
    }
    const summary = resolve(logDir, `${db}-summary-${Date.now()}.json`);
    writeFileSync(summary, JSON.stringify({ db, results }, null, 2));
    console.log(`summary=${summary}`);
  }
}
