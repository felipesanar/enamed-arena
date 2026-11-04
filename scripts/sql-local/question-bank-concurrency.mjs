import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

export function localTarget({ host = '127.0.0.1', port = 54737, user = 'postgres', database } = {}) {
  if (host !== '127.0.0.1' || Number(port) !== 54737 || user !== 'postgres'
    || typeof database !== 'string' || !/^enamed_test_bank_[a-z0-9_]+$/.test(database) || database.length > 63) {
    throw new Error('Connection outside local allowlist');
  }
  return { host, port: 54737, user, database };
}
export function connectionArgs(config) {
  const t = localTarget(config);
  return ['-X', '-w', '-h', t.host, '-p', String(t.port), '-U', t.user, '-d', t.database, '-v', 'ON_ERROR_STOP=1'];
}
export function cleanEnvironment(env = process.env) {
  return { ...Object.fromEntries(Object.entries(env).filter(([key]) => !/^pg/i.test(key))),
    PGCONNECT_TIMEOUT: '5', PGPASSFILE: process.platform === 'win32' ? 'NUL' : '/dev/null', PGSSLMODE: 'disable' };
}
const psql = resolve('../../fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe');
const safety = `DO $$ BEGIN
 IF current_database() !~ '^enamed_test_bank_[a-z0-9_]+$' OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
 OR inet_server_port() IS DISTINCT FROM 54737 OR session_user<>'postgres' THEN RAISE EXCEPTION 'Unsafe local target'; END IF;
 END $$;`;

function session(config, name) {
  const child = spawn(psql, [...connectionArgs(config), '-qAt'], {
    env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let pending, output = '', errors = '', ended = false;
  function settle(error) {
    if (!pending || (!error && !output.includes(pending.marker))) return;
    const job = pending; pending = null; clearTimeout(job.timer);
    if (error) job.reject(new Error(`${name}: ${error}; ${errors}`));
    else job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
  }
  child.stdout.on('data', data => { output += data; settle(); });
  child.stderr.on('data', data => { errors += data; });
  child.on('error', error => settle(error.message));
  const closed = new Promise(done => child.on('close', code => {
    ended = true; settle(`psql exit ${code}`); done(code);
  }));
  return {
    name,
    query(sql) {
      if (pending || ended) throw new Error(`${name}: busy/closed`);
      output = ''; errors = '';
      return new Promise((done, reject) => {
        const marker = `DONE_${randomUUID()}`;
        pending = { marker, resolve: done, reject, timer: setTimeout(() => {
          settle('12s query deadline exceeded'); child.kill();
        }, 12000) };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    async close() {
      if (ended) return;
      child.stdin.end('ROLLBACK;\n\\q\n');
      const timer = setTimeout(() => child.kill(), 1000);
      await closed; clearTimeout(timer);
    },
  };
}

// Requires the committed synthetic fixture from fase4_question_bank.sql.
// Commits are local SQL transactions, never Git commits; evidence is retained.
export async function runConcurrency(config) {
  const t = localTarget(config), prefix = `bank-${randomUUID()}`;
  const a = session(t, `${prefix}-a`), b = session(t, `${prefix}-b`);
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const qid = 'f4230000-0000-0000-0000-000000000010';
  const observed = `SELECT v.payload FROM public.question_bank_versions v
    JOIN public.question_bank_usage u ON u.version_id=v.id WHERE u.original_question_id='${qid}' AND u.archived_at IS NULL`;
  const count = `SELECT count(*) FROM public.question_bank_versions v JOIN public.question_bank q ON q.id=v.bank_id WHERE q.original_question_id='${qid}';`;
  const expectedConflict = `DO $$ BEGIN BEGIN
    UPDATE public.question_options SET text='must not persist' WHERE question_id='${qid}' AND label='C';
    RAISE EXCEPTION 'Expected 55P03'; EXCEPTION WHEN lock_not_available THEN NULL; END; END $$;`;
  try {
    for (const s of [a, b]) await s.query(`${safety} SET statement_timeout='8s'; SET lock_timeout='6s';
      SET idle_in_transaction_session_timeout='20s'; SET request.jwt.claim.sub='f4200000-0000-0000-0000-000000000001';`);
    eq(await a.query(`SELECT count(*) FROM public.questions WHERE id='${qid}';`), '1', 'synthetic fixture exists');
    eq(await a.query(`SELECT to_regprocedure('public.admin_reprocess_simulado(uuid,text)') IS NOT NULL;`), 't', 'F2 prerequisite installed');
    const initial = Number(await a.query(count));
    await a.query(`BEGIN; UPDATE public.question_options SET is_correct=label='B' WHERE question_id='${qid}';`);
    await b.query(expectedConflict); assertions++;
    await a.query('COMMIT;');
    await b.query(`UPDATE public.question_options SET text='Serialized C' WHERE question_id='${qid}' AND label='C';`);
    eq(await a.query(count), String(initial + 2), 'two statements produce two terminal snapshots');
    eq(await a.query(`SELECT (payload->'options'->1->>'is_correct')::boolean AND payload->'options'->2->>'text'='Serialized C' FROM (${observed}) x;`), 't', 'retry sees both committed edits');

    await a.query(`BEGIN; UPDATE public.questions SET explanation='rolled back' WHERE id='${qid}';`);
    await b.query(expectedConflict); assertions++;
    await a.query('ROLLBACK;');
    eq(await b.query(count), String(initial + 2), 'rolled back edit leaves no version');

    // Same option row: PostgreSQL waits before BEFORE ROW, then our capture must
    // see the new committed row rather than the waiter's original query snapshot.
    await a.query(`BEGIN; UPDATE public.question_options SET text='First writer' WHERE question_id='${qid}' AND label='D';`);
    const waiting = b.query(`UPDATE public.question_options SET text='Second writer' WHERE question_id='${qid}' AND label='D';`)
      .then(value => ({ value }), error => ({ error }));
    let blocked = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const result = await a.query(`SELECT EXISTS(SELECT FROM pg_stat_activity s WHERE s.datname=current_database()
        AND s.application_name='${b.name}' AND s.wait_event_type='Lock'
        AND pg_backend_pid()=ANY(pg_blocking_pids(s.pid))
        AND EXISTS(SELECT FROM pg_locks l WHERE l.pid=s.pid AND NOT l.granted));`);
      if (result === 't') { blocked = true; break; }
      await new Promise(done => setTimeout(done, 10));
    }
    eq(blocked, true, 'real wait observed through pg_stat_activity and pg_locks');
    await a.query('COMMIT;');
    const result = await waiting;
    if (result.error) throw result.error;
    eq(await a.query(count), String(initial + 4), 'both serial updates append once');
    eq(await a.query(`SELECT payload->'options'->3->>'text'='Second writer' FROM (${observed}) x;`), 't', 'terminal payload equals latest committed content');

    // Call the REAL F2 RPC only while the writer holds parent SHARE. It must
    // refuse before any score mutation; this test never runs a recalculation.
    await a.query(`BEGIN; UPDATE public.question_options SET text='held' WHERE question_id='${qid}' AND label='A';`);
    await b.query(`DO $$ BEGIN BEGIN
      PERFORM public.admin_reprocess_simulado('f4220000-0000-0000-0000-000000000001','Bank lock-order test, must fail before writes');
      RAISE EXCEPTION 'Expected parent 55P03'; EXCEPTION WHEN lock_not_available THEN NULL; END; END $$;`);
    assertions++;
    await a.query('ROLLBACK;');
    const reuseTarget = 'f4260000-0000-0000-0000-000000000001';
    const reuseSource = `(SELECT v.id FROM public.question_bank_versions v JOIN public.question_bank c ON c.id=v.bank_id
      WHERE c.original_question_id='f4230000-0000-0000-0000-000000000002' ORDER BY v.version_number LIMIT 1)`;
    const reuseConflict = `DO $$ BEGIN BEGIN
      PERFORM public.admin_add_bank_version_to_simulado(${reuseSource},'${reuseTarget}',2);
      RAISE EXCEPTION 'Expected reuse 55P03'; EXCEPTION WHEN lock_not_available THEN NULL; END; END $$;`;
    await a.query(`BEGIN; SELECT id FROM public.simulados WHERE id='${reuseTarget}' FOR UPDATE;`);
    await b.query(reuseConflict); assertions++;
    await a.query('ROLLBACK;');
    await a.query(`BEGIN; UPDATE public.questions SET explanation='held canonical identity'
      WHERE id='f4230000-0000-0000-0000-000000000002';`);
    await b.query(reuseConflict); assertions++;
    await a.query('ROLLBACK;');
    eq(await b.query(`SELECT NOT EXISTS(SELECT FROM public.questions WHERE simulado_id='${reuseTarget}' AND question_number=2)
      AND NOT EXISTS(SELECT FROM question_bank_private.materializations WHERE initializing);`), 't', 'reuse conflicts leave no partial rows');
    await b.query(`BEGIN; SELECT public.admin_add_bank_version_to_simulado(${reuseSource},'${reuseTarget}',2);`);
    eq(await b.query(`SELECT count(*) FROM public.questions WHERE simulado_id='${reuseTarget}' AND question_number=2;`), '1', 'reuse retry succeeds after both locks release');
    await b.query('ROLLBACK;');
    return { status: 'passed', assertions, database: t.database,
      evidence: ['different-option 55P03 and retry', 'question/option conflict and rollback',
        'same-row real lock wait, fresh terminal snapshot', 'real F2 RPC refuses before recalculation',
        'reuse parent and canonical identity NOWAIT, atomic rollback and retry'] };
  } finally { await a.close(); await b.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runConcurrency({ database: process.argv[2] }).then(result => console.log(JSON.stringify(result)),
    error => { console.error(error.message); process.exitCode = 1; });
}
