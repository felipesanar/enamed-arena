import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Confirmed portable PostgreSQL installation; SQL paths are relative to this module,
// not to the caller's working directory. Never inherit PGHOST/service/password overrides.
const psql = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe';
const migration = fileURLToPath(new URL('../../supabase/migrations/20261104090759_fase1_cutoff_reference.sql', import.meta.url));
const fixture = fileURLToPath(new URL('../../supabase/tests/fase1_cutoff_reference.sql', import.meta.url));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const delay = ms => new Promise(done => setTimeout(done, ms));

export function cutoffTarget({ host = '127.0.0.1', port = 54737, user = 'postgres', database } = {}) {
  if (host !== '127.0.0.1' || port !== 54737 || user !== 'postgres' || typeof database !== 'string'
    || !/^enamed_test_cutoff_[a-z0-9_]+$/.test(database) || database.length > 63) throw new Error('Unsafe cutoff test target');
  return { host, port, user, database };
}

function options(config, name) {
  const t = cutoffTarget(config);
  return {
    args: ['-X', '-w', '-qAt', '-h', t.host, '-p', String(t.port), '-U', t.user, '-d', t.database, '-v', 'ON_ERROR_STOP=1'],
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key))),
      PGAPPNAME: name, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PGPASSFILE: process.platform === 'win32' ? 'NUL' : '/dev/null' },
  };
}

function guard(config) {
  const t = cutoffTarget(config);
  return `DO $guard$ BEGIN IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 54737 OR session_user <> 'postgres'
    OR current_database() <> ${quote(t.database)} THEN RAISE EXCEPTION 'Unsafe cutoff connection'; END IF; END $guard$;
    SET statement_timeout='8s'; SET lock_timeout='6s'; SET idle_in_transaction_session_timeout='20s';`;
}

function session(config, name) {
  const o = options(config, name);
  const child = spawn(psql, o.args, { env: o.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', pending, ended = false, sequence = 0;
  function finish(error) {
    if (!pending || (!error && !output.includes(pending.marker))) return;
    const job = pending;
    pending = undefined;
    clearTimeout(job.timer);
    if (error) job.reject(new Error(`${name}: ${error}; ${errors}`));
    else job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
  }
  child.stdout.on('data', data => { output += data; finish(); });
  child.stderr.on('data', data => { errors += data; });
  child.stdin.on('error', error => finish(error.message));
  child.on('error', error => finish(error.message));
  const closed = new Promise(done => child.on('close', code => {
    ended = true; finish(`psql exit ${code}`); done(code);
  }));
  return {
    name,
    query(sql) {
      if (pending || ended) throw new Error(`${name}: busy or closed`);
      output = ''; errors = '';
      const marker = `CUTOFF_DONE_${++sequence}`;
      return new Promise((done, reject) => {
        pending = { marker, resolve: done, reject, timer: setTimeout(() => {
          finish('bounded query timeout'); child.kill();
        }, 12000) };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    async close() {
      if (ended) return;
      // Only our child is terminated; disconnect rolls back an unfinished transaction.
      child.stdin.end('ROLLBACK;\n\\q\n');
      const timer = setTimeout(() => child.kill(), 1000);
      await closed;
      clearTimeout(timer);
    },
  };
}

// Intentionally NO -1: these tests must prove that the actual file is atomic.
async function runFile(config, file) {
  const o = options(config, `cutoff-file-${process.pid}`);
  return await new Promise((done, reject) => {
    const child = spawn(psql, [...o.args, '-c', guard(config), '-f', file], { env: o.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr }); });
  });
}

// Includes function bodies/OIDs/owners/ACLs, schemas, columns, table ACL/RLS,
// constraints, indexes, triggers and a data checkpoint. Only hashes leave PostgreSQL.
const checkpoint = `SELECT jsonb_build_object(
 'schemas',(SELECT md5(coalesce(string_agg(n::text,',' ORDER BY n.oid),'')) FROM pg_namespace n WHERE nspname IN ('public','cutoff_private')),
 'functions',(SELECT md5(coalesce(string_agg(p::text||pg_get_functiondef(p.oid),',' ORDER BY p.oid),'')) FROM pg_proc p
   WHERE pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','cutoff_private')) AND
   (pronamespace=to_regnamespace('cutoff_private') OR proname IN ('get_cutoff_scores','get_user_cutoff_context','admin_import_cutoffs'))),
 'tables',(SELECT md5(coalesce(string_agg(c::text,',' ORDER BY c.oid),'')) FROM pg_class c WHERE c.oid IN ('public.enamed_cutoff_scores'::regclass,'public.enamed_programs'::regclass)
   OR c.relnamespace=to_regnamespace('cutoff_private')),
 'columns',(SELECT md5(coalesce(string_agg(a::text,',' ORDER BY a.attrelid,a.attnum),'')) FROM pg_attribute a WHERE attrelid IN ('public.enamed_cutoff_scores'::regclass,'public.enamed_programs'::regclass) AND attnum>0),
 'constraints',(SELECT md5(coalesce(string_agg(c::text,',' ORDER BY c.oid),'')) FROM pg_constraint c WHERE conrelid IN ('public.enamed_cutoff_scores'::regclass,'public.enamed_programs'::regclass)),
 'indexes',(SELECT md5(coalesce(string_agg(i::text,',' ORDER BY indexname),'')) FROM pg_indexes i WHERE schemaname='public' AND tablename IN ('enamed_cutoff_scores','enamed_programs')),
 'triggers',(SELECT md5(coalesce(string_agg(t::text,',' ORDER BY t.oid),'')) FROM pg_trigger t WHERE tgrelid IN ('public.enamed_cutoff_scores'::regclass,'public.enamed_programs'::regclass)),
 'cutoffs',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.enamed_cutoff_scores t),
 'programs',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.enamed_programs t));`;

async function atomicity(config) {
  const s = session(config, `cutoff-checkpoint-${process.pid}`);
  const id = randomUUID(), program = randomUUID(), institution = randomUUID(), specialty = randomUUID();
  const view = `cutoff_dependency_${id.replaceAll('-', '')}`;
  let seeded = false, dependency = false, stub = false;
  const evidence = [];
  try {
    await s.query(guard(config));
    assert.equal(await s.query("SELECT to_regnamespace('cutoff_private') IS NULL AND to_regprocedure('public.get_user_cutoff_context(uuid)') IS NOT NULL;"), 't', 'requires pristine template clone');
    await s.query(`BEGIN;
      INSERT INTO public.enamed_institutions(id,name,slug,uf) VALUES(${quote(institution)},'Atomic checkpoint',${quote(institution)},'SP');
      INSERT INTO public.enamed_specialties(id,name,slug) VALUES(${quote(specialty)},'Atomic checkpoint',${quote(specialty)});
      INSERT INTO public.enamed_cutoff_scores(id,institution_id,specialty_id,institution_name,specialty_name,cutoff_score_general)
        VALUES(${quote(id)},${quote(institution)},${quote(specialty)},'Atomic checkpoint','Atomic checkpoint',67);
      INSERT INTO public.enamed_programs(id,institution_id,specialty_id,cenario_pratica) VALUES(${quote(program)},${quote(institution)},${quote(specialty)},'Checkpoint');
      COMMIT;`);
    seeded = true;
    for (const kind of ['dependency', 'late_function_error']) {
      if (kind === 'dependency') {
        await s.query(`CREATE VIEW public.${view} AS SELECT public.get_user_cutoff_context(NULL::uuid) AS context;`);
        dependency = true;
      } else {
        // Conflicting return type fails at CREATE of the SECOND expanded RPC,
        // after the first old RPC has been dropped and its replacement created.
        await s.query('CREATE FUNCTION public.get_user_cutoff_context(uuid,uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;');
        stub = true;
      }
      const before = JSON.parse(await s.query(checkpoint));
      const failed = await runFile(config, migration);
      assert.equal(failed.code, 3, `${kind}: expected psql SQL error`);
      assert.match(failed.stderr, kind === 'dependency' ? /Dependent objects on public.get_user_cutoff_context/ : /cannot change return type/);
      assert.deepEqual(JSON.parse(await s.query(checkpoint)), before, `${kind}: entire catalog and checkpoint must roll back under psql -f`);
      evidence.push(`${kind}: psql -f exit 3, catalog/ACL/RPC/data checkpoint unchanged`);
      if (dependency) { await s.query(`DROP VIEW public.${view} RESTRICT;`); dependency = false; }
      if (stub) { await s.query('DROP FUNCTION public.get_user_cutoff_context(uuid,uuid) RESTRICT;'); stub = false; }
    }
    return { failures: 2, catalogAndDataUnchanged: true, evidence };
  } finally {
    // Exact IDs and objects created by this invocation only, never wildcard cleanup.
    try {
      if (dependency) await s.query(`DROP VIEW public.${view} RESTRICT;`);
      if (stub) await s.query('DROP FUNCTION public.get_user_cutoff_context(uuid,uuid) RESTRICT;');
      if (seeded) await s.query(`BEGIN; DELETE FROM public.enamed_cutoff_scores WHERE id=${quote(id)};
        DELETE FROM public.enamed_programs WHERE id=${quote(program)};
        DELETE FROM public.enamed_institutions WHERE id=${quote(institution)};
        DELETE FROM public.enamed_specialties WHERE id=${quote(specialty)}; COMMIT;`);
    } finally { await s.close(); }
  }
}

async function concurrency(config) {
  const a = session(config, `cutoff-a-${process.pid}`), b = session(config, `cutoff-b-${process.pid}`);
  const u = randomUUID(), i = randomUUID(), sp = randomUUID(), refA = randomUUID(), refB = randomUUID();
  const auth = `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${quote(u)},false);`;
  const rows = names => JSON.stringify(names.map(practice_scenario => ({ institution_id: i, specialty_id: sp, practice_scenario, cutoff_score_general: 80, vagas: 2 })));
  const importSql = (ref, source, names) => `SELECT public.admin_import_cutoffs(${quote(ref)},${quote(source)},${quote(rows(names))}::jsonb);`;
  const report = { maxConnections: 2, barriers: [] };
  const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
  let seeded = false;
  async function blocked() {
    const until = Date.now() + 4000;
    do {
      const state = JSON.parse(await a.query(`RESET ROLE; SELECT pg_stat_clear_snapshot();
        SELECT jsonb_build_object('wait',x.wait_event,'blocking',pg_blocking_pids(x.pid),
        'advisory',EXISTS(SELECT 1 FROM pg_locks w JOIN pg_locks h ON w.locktype=h.locktype AND w.database=h.database
          AND w.classid=h.classid AND w.objid=h.objid AND w.objsubid=h.objsubid
          WHERE w.pid=x.pid AND NOT w.granted AND h.pid=pg_backend_pid() AND h.granted AND w.locktype='advisory'))
        FROM pg_stat_activity x WHERE application_name=${quote(b.name)} AND datname=current_database(); SET ROLE authenticated;`));
      if (state.wait === 'advisory' && state.advisory && state.blocking.length === 1) {
        report.barriers.push('pg_stat_activity + pg_locks advisory waiter/holder + pg_blocking_pids');
        return;
      }
      await delay(25);
    } while (Date.now() < until);
    throw new Error('Real per-reference advisory wait not observed');
  }
  try {
    await a.query(guard(config)); await b.query(guard(config));
    await a.query(`BEGIN; SET LOCAL session_replication_role=replica;
      INSERT INTO auth.users(id,email) VALUES(${quote(u)},${quote(`${u}@cutoff.invalid`)});
      SET LOCAL session_replication_role=origin;
      INSERT INTO public.user_roles(user_id,role) VALUES(${quote(u)},'content_editor');
      INSERT INTO public.enamed_institutions(id,name,slug,uf) VALUES(${quote(i)},'Concurrency',${quote(i)},'SP');
      INSERT INTO public.enamed_specialties(id,name,slug) VALUES(${quote(sp)},'Concurrency',${quote(sp)});
      INSERT INTO public.exam_editions(id,code,year,term,label,status,cutoff_reference_label) VALUES
        (${quote(refA)},'2198.1',2198,1,'Concurrency A','preparing','Fixture A'),
        (${quote(refB)},'2198.2',2198,2,'Concurrency B','active','Fixture B'); COMMIT;`);
    seeded = true;
    await a.query(auth); await b.query(auth);
    assert.equal(await a.query('SHOW transaction_isolation;'), 'read committed');
    assert.equal(await b.query('SHOW transaction_isolation;'), 'read committed');

    for (const stale of [false, true]) {
      const prefix = stale ? 'rr' : 'rc';
      await a.query('BEGIN ISOLATION LEVEL READ COMMITTED;');
      const winner = JSON.parse(await a.query(importSql(refA, `${prefix}-winner`, [`${prefix}-shared`, `${prefix}-winner-only`])));
      assert.equal(winner.imported, 2);
      if (stale) await b.query(`BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM public.enamed_cutoff_scores WHERE reference_edition_id=${quote(refA)};`);
      const waiting = outcome(b.query(importSql(refA, `${prefix}-loser`, [`${prefix}-loser-only`, `${prefix}-shared`])));
      await blocked();
      await a.query('COMMIT;');
      const result = await waiting;
      if (result.error) throw result.error;
      const loser = JSON.parse(result.value);
      assert.equal(loser.ok, false); assert.equal(loser.imported, 0);
      assert.match(loser.errors[0].message, stale ? /23505/ : /already exists/);
      if (stale) await b.query('ROLLBACK;');
      await a.query('RESET ROLE;');
      assert.equal(await a.query(`SELECT (SELECT count(*) FROM public.enamed_cutoff_scores WHERE reference_edition_id=${quote(refA)} AND source=${quote(`${prefix}-winner`)})||':'||
        (SELECT count(*) FROM public.enamed_programs WHERE reference_edition_id=${quote(refA)} AND source=${quote(`${prefix}-winner`)})||':'||
        (SELECT count(*) FROM public.enamed_cutoff_scores WHERE reference_edition_id=${quote(refA)} AND source=${quote(`${prefix}-loser`)})||':'||
        (SELECT count(*) FROM public.enamed_programs WHERE reference_edition_id=${quote(refA)} AND source=${quote(`${prefix}-loser`)})||':'||
        (SELECT count(*) FROM public.admin_audit_log WHERE actor_id=${quote(u)} AND metadata->>'source'=${quote(`${prefix}-winner`)});`), '2:2:0:0:1');
      await a.query('SET ROLE authenticated;');
      report[stale ? 'staleSnapshot' : 'sameReference'] = { winner, loser, counts: 'cuts/programs winner=2/2, loser=0/0, audit=1' };
    }

    await a.query('BEGIN;');
    assert.equal(JSON.parse(await a.query(importSql(refA, 'different-a', ['different-shared', 'different-a']))).imported, 2);
    await b.query('BEGIN; SET LOCAL lock_timeout=\'750ms\';');
    assert.equal(JSON.parse(await b.query(importSql(refB, 'different-b', ['different-shared', 'different-b']))).imported, 2);
    // B completed while A still owns its advisory lock: no global serialization.
    assert.equal(await a.query(`RESET ROLE; SELECT count(*) FROM pg_stat_activity x
      WHERE x.datname=current_database() AND x.application_name IN (${quote(a.name)},${quote(b.name)})
      AND (x.pid=pg_backend_pid() OR x.state='idle in transaction')
      AND cardinality(pg_blocking_pids(x.pid))=0
      AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=x.pid AND l.locktype='advisory' AND l.granted);`), '2');
    report.differentReferenceNotBlocked = true;
    report.differentReferenceEvidence = 'both advisory locks granted; B idle in transaction, no blocking PIDs; lock_timeout=750ms; A not released';
    await a.query('ROLLBACK;'); await b.query('ROLLBACK;');
  } finally {
    await a.close(); await b.close();
    if (seeded) {
      const cleanup = session(config, `cutoff-cleanup-${process.pid}`);
      try {
        await cleanup.query(guard(config));
        await cleanup.query(`BEGIN;
          DELETE FROM public.admin_audit_log WHERE actor_id=${quote(u)};
          DELETE FROM public.enamed_cutoff_scores WHERE reference_edition_id IN (${quote(refA)},${quote(refB)});
          DELETE FROM public.enamed_programs WHERE reference_edition_id IN (${quote(refA)},${quote(refB)});
          DELETE FROM public.exam_editions WHERE id IN (${quote(refA)},${quote(refB)});
          DELETE FROM public.enamed_institutions WHERE id=${quote(i)};
          DELETE FROM public.enamed_specialties WHERE id=${quote(sp)};
          DELETE FROM public.user_roles WHERE user_id=${quote(u)};
          SET LOCAL session_replication_role=replica; DELETE FROM auth.users WHERE id=${quote(u)}; COMMIT;`);
        assert.equal(await cleanup.query(`SELECT (SELECT count(*) FROM auth.users WHERE id=${quote(u)})+
          (SELECT count(*) FROM public.admin_audit_log WHERE actor_id=${quote(u)})+
          (SELECT count(*) FROM public.enamed_cutoff_scores WHERE reference_edition_id IN (${quote(refA)},${quote(refB)}))+
          (SELECT count(*) FROM public.enamed_programs WHERE reference_edition_id IN (${quote(refA)},${quote(refB)}))+
          (SELECT count(*) FROM public.exam_editions WHERE id IN (${quote(refA)},${quote(refB)}))+
          (SELECT count(*) FROM public.enamed_institutions WHERE id=${quote(i)})+(SELECT count(*) FROM public.enamed_specialties WHERE id=${quote(sp)});`), '0');
        report.noSyntheticRemainders = true;
      } finally { await cleanup.close(); }
    }
  }
  return report;
}

export async function runReview(config) {
  const t = cutoffTarget(config);
  const atomic = await atomicity(t);
  const applied = await runFile(t, migration);
  assert.equal(applied.code, 0, applied.stderr);
  const s = session(t, `cutoff-fixture-observer-${process.pid}`);
  let tested;
  try {
    await s.query(guard(t));
    const before = JSON.parse(await s.query(checkpoint));
    tested = await runFile(t, fixture);
    assert.equal(tested.code, 0, tested.stderr);
    assert.deepEqual(JSON.parse(await s.query(checkpoint)), before, 'fixture reapply cannot commit seeds or change catalog');
    assert.equal(await s.query("SELECT count(*) FROM auth.users WHERE id IN ('61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002');"), '0');
  } finally { await s.close(); }
  return { database: t.database, atomicity: atomic,
    fixture: { assertions: (tested.stderr.match(/NOTICE:  PASS:/g) ?? []).length, noCommittedSeeds: true },
    concurrency: await concurrency(t) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await runReview({ database: process.argv[2] }), null, 2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
