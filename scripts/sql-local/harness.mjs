import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

export const PG_BIN = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin';

export function target({ host = '127.0.0.1', port = 54737, user = 'postgres', database } = {}) {
  if (host !== '127.0.0.1' || Number(port) !== 54737 || user !== 'postgres'
      || typeof database !== 'string' || !/^enamed_test_[a-z0-9_]+$/.test(database) || database.length > 63) {
    throw new Error('Connection outside local allowlist');
  }
  return { host, port: 54737, user, database };
}

export function connectionArgs(config) {
  const t = target(config);
  return ['-X', '-w', '-h', t.host, '-p', String(t.port), '-U', t.user, '-d', t.database, '-v', 'ON_ERROR_STOP=1'];
}

export function createDatabaseArgs(maintenance, database) {
  const t = target(maintenance);
  const db = target({ database }).database;
  return ['-w', '-h', t.host, '-p', String(t.port), '-U', t.user,
    `--maintenance-db=${t.database}`, '--template=template0', '--encoding=UTF8',
    '--locale-provider=icu', '--icu-locale=en-US', db];
}

export function extraSqlFile(value, kind, workspace) {
  const expected = kind === 'migration' ? /\/supabase\/migrations\/\d{14}_[a-zA-Z0-9_-]+\.sql$/
    : kind === 'test' ? /\/supabase\/tests\/fase0_[a-zA-Z0-9_-]+\.sql$/ : null;
  try {
    if (!expected || !expected.test(resolve(value).replaceAll('\\', '/'))) throw new Error();
    const path = realpathSync(resolve(value));
    const inside = relative(realpathSync(workspace), path);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)
      || !expected.test(path.replaceAll('\\', '/')) || !statSync(path).isFile()) throw new Error();
    return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
  } catch {
    throw new Error('Extra SQL must be an existing migration/fixture inside the explicit workspace');
  }
}

export function cleanEnvironment(env = process.env) {
  return { ...Object.fromEntries(Object.entries(env).filter(([key]) => !/^pg/i.test(key))),
    PGCONNECT_TIMEOUT: '5', PGAPPNAME: 'enamed-sql-local',
    PGPASSFILE: process.platform === 'win32' ? 'NUL' : '/dev/null', PGSSLMODE: 'disable' };
}

export function redact(text) {
  return String(text).replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
}

export function runChecked(binary, args, execute = spawnSync, options = {}) {
  const result = execute(binary, args, { encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
    ...options, env: cleanEnvironment() });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(redact(`Command failed (${result.status ?? result.signal ?? 'spawn'}): ${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`));
  }
  return redact(`${result.stdout ?? ''}${result.stderr ?? ''}`);
}

export function migrationPlan(names) {
  if (names.some(name => !/^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(name))) throw new Error('Unexpected migration filename');
  return names.filter(name => name <= '20261104054334_zzzz.sql').sort();
}

// These are harness adaptations, never changes to files in migrations/.
export function localMigration(name, original) {
  let sql = original;
  const deviations = [];
  const replaceOnce = (expected, replacement, reason) => {
    if (sql.split(expected).length !== 2) throw new Error(`Missing/duplicate expected local adaptation in ${name}`);
    sql = sql.replace(expected, replacement);
    deviations.push(reason);
  };
  if (name === '20260402191728_dc90eb2b-fd1d-4bbf-8a46-9fbf44029c1b.sql') {
    replaceOnce('CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;',
      '-- LOCAL DOUBLE: net.http_post and extensions.http_post never send HTTP.', 'pg_net replaced by inert local transport');
  }
  if (name === '20261104053227_fase0_attempt_jobs.sql') {
    replaceOnce("IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN",
      "IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN",
      'pg_cron extension prerequisite replaced with explicit mock interface check; no pg_extension forgery');
  }
  return { sql, deviations };
}
