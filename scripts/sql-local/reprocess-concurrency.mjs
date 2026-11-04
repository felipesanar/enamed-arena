import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

export function localTarget({ host = '127.0.0.1', port = 54737, user = 'postgres', database } = {}) {
  if (host !== '127.0.0.1' || Number(port) !== 54737 || user !== 'postgres'
    || typeof database !== 'string' || !/^enamed_test_reprocess_[a-z0-9_]+$/.test(database) || database.length > 63) {
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
 IF current_database() !~ '^enamed_test_reprocess_[a-z0-9_]+$'
 OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 54737
 OR session_user <> 'postgres' THEN RAISE EXCEPTION 'Unsafe local target'; END IF; END $$;`;

function session(config, name) {
  const child = spawn(psql, [...connectionArgs(config), '-qAt'], {
    env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let pending, output = '', errors = '', ended = false;
  function settle(error) {
    if (!pending || (!error && !output.includes(pending.marker))) return;
    const job = pending;
    pending = null;
    clearTimeout(job.timer);
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
          settle('10s query deadline exceeded'); child.kill();
        }, 10000) };
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

// Run ONCE on a fresh clone. Committed fixture/evidence is deliberately retained
// in that private disposable DB for review, never deleted or remotely applied.
export async function runConcurrency(config) {
  const t = localTarget(config);
  const prefix = `f2-reprocess-${randomUUID()}`;
  const a = session(t, `${prefix}-a`), b = session(t, `${prefix}-b`);
  const evidence = [];
  let assertions = 0;
  const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; };
  // Attach a rejection handler immediately, before observing a blocking query.
  const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
  const unwrap = result => { if (result.error) throw result.error; return result.value; };
  const auth = `SET request.jwt.claim.sub='f2500000-0000-0000-0000-000000000003';`;
  const call = `SELECT public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Concurrency fixture');`;
  const correction = `UPDATE public.question_options SET is_correct=label='B'
    WHERE question_id='f2530000-0000-0000-0000-000000000001';`;
  const noWait = `DO $$ BEGIN
    BEGIN PERFORM public.admin_reprocess_simulado('f2520000-0000-0000-0000-000000000001','Busy fixture');
      RAISE EXCEPTION 'Expected lock_not_available';
    EXCEPTION WHEN lock_not_available THEN NULL; END;
  END $$;`;
  async function barrier(observer, waiter) {
    const until = Date.now() + 4000;
    do {
      const observed = await observer.query(`SELECT EXISTS(SELECT FROM pg_stat_activity s
        WHERE s.datname=current_database() AND s.application_name='${waiter.name}' AND s.wait_event_type='Lock'
        AND pg_backend_pid()=ANY(pg_blocking_pids(s.pid))
        AND EXISTS(SELECT FROM pg_locks l WHERE l.pid=s.pid AND NOT l.granted));`);
      if (observed === 't') {
        assertions++; evidence.push('Real wait: pg_stat_activity Lock + pg_blocking_pids + ungranted pg_locks'); return;
      }
      await new Promise(done => setTimeout(done, 10));
    } while (Date.now() < until);
    throw new Error('Server lock barrier not observed within 4 seconds');
  }
  try {
    for (const s of [a, b]) await s.query(`${safety}
      SET statement_timeout='6s'; SET lock_timeout='5s'; SET idle_in_transaction_session_timeout='20s'; ${auth}`);
    eq(await a.query('SHOW transaction_isolation;'), 'read committed', 'real isolation');
    const helperIdentity = `SELECT jsonb_build_array(proowner,proacl,proconfig,prosecdef,
      pg_get_function_identity_arguments(oid),pg_get_function_result(oid))::text FROM pg_proc
      WHERE oid='public.recalculate_user_performance(uuid)'::regprocedure;`;
    const identityBefore = await a.query(helperIdentity);
    const fixture = (await readFile('supabase/tests/fase2_reprocess.sql', 'utf8')).split('-- Operator corrects Gabarito')[0];
    await a.query(`${fixture}\nALTER TABLE public.profiles ENABLE TRIGGER on_profile_created_hubspot; COMMIT;`);
    // An actual non-finalized attempt on ANOTHER exam for an affected user.
    // F0 finalizer must serialize on its per-attempt lock, not overwrite summary
    // from a stale history snapshot while the reprocess is uncommitted.
    await a.query(`BEGIN; ${safety}
      INSERT INTO public.attempts(id,simulado_id,user_id,status,attempt_type,effective_deadline,is_within_window)
      VALUES('f2550000-0000-0000-0000-000000000008','f2520000-0000-0000-0000-000000000002',
      'f2500000-0000-0000-0000-000000000001','in_progress','offline',now()-interval '1 day',false);
      COMMIT;`);
    await a.query(`BEGIN; ${call}`);
    const writer = outcome(b.query(`BEGIN; ${correction} COMMIT;`));
    await barrier(a, b);
    await a.query('COMMIT;'); unwrap(await writer);
    evidence.push('Correction after reprocess commits: no deadlock');

    await b.query(`BEGIN; ${correction}`);
    await a.query(noWait);
    assertions++; evidence.push('Correction owns parent SHARE: reprocess refuses with 55P03 before writes');
    await b.query('COMMIT;');

    await a.query(`BEGIN; ${call}`);
    const finalizing = outcome(b.query(`SELECT * FROM public.finalize_attempt_with_results_for_user(
      'f2550000-0000-0000-0000-000000000008','f2500000-0000-0000-0000-000000000001',true);`));
    await barrier(a, b);
    await a.query('COMMIT;'); unwrap(await finalizing);
    eq(await a.query(`SELECT status='submitted' AND score_percentage=0 AND total_answered=0 FROM public.attempts
      WHERE id='f2550000-0000-0000-0000-000000000008';`), 't', 'F0 finalizer really wrote blank results');
    eq(await a.query(`SELECT s.avg_score=round((SELECT avg(score_percentage) FROM public.user_performance_history
      WHERE user_id=s.user_id),2) FROM public.user_performance_summary s
      WHERE user_id='f2500000-0000-0000-0000-000000000001';`), 't', 'summary consistent after actual finalization');

    await a.query(`UPDATE public.user_performance_summary SET updated_at=now()-interval '10 days'
      WHERE user_id='f2500000-0000-0000-0000-000000000001';`);
    const summaryRow = `SELECT to_jsonb(s)::text FROM public.user_performance_summary s
      WHERE user_id='f2500000-0000-0000-0000-000000000001';`;
    const summaryBefore = await a.query(summaryRow);
    // Re-execute the real F0 calculation (expired has no submitted early return)
    // with identical inputs. Its helper call must not refresh summary.updated_at.
    await a.query(`UPDATE public.attempts SET status='expired' WHERE id='f2550000-0000-0000-0000-000000000008';`);
    await b.query(`SELECT * FROM public.finalize_attempt_with_results_for_user(
      'f2550000-0000-0000-0000-000000000008','f2500000-0000-0000-0000-000000000001',true);`);
    eq(await a.query(summaryRow), summaryBefore, 'F0 calculation preserves summary timestamp on semantic no-op');

    await b.query(`BEGIN; SELECT id FROM public.attempts WHERE id='f2550000-0000-0000-0000-000000000008' FOR UPDATE;`);
    await a.query(noWait); assertions++;
    await b.query('ROLLBACK;');
    evidence.push('Finalizer owns attempt first: reprocess refuses 55P03, no lock-order cycle');

    await a.query(`BEGIN; ${call}`);
    eq(await b.query(`SET request.jwt.claim.sub='f2500000-0000-0000-0000-000000000005';
      SELECT (public.create_attempt_guarded('f2520000-0000-0000-0000-000000000002')).user_id;`),
    'f2500000-0000-0000-0000-000000000005', 'different user/exam is not globally locked');
    await a.query('COMMIT;');
    const digest = `SELECT md5(jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.attempts t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.attempt_question_results t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.user_performance_history t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM public.user_performance_summary t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.admin_audit_log t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.error_notebook t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY signature) FROM fase2_private.reprocess_ddl_checkpoint t),
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY operation_id) FROM fase2_private.reprocess_operations t))::text);`;
    const before = await a.query(digest);
    await a.query(`BEGIN; ${safety} DROP FUNCTION public.admin_reprocess_simulado(uuid,text);
      DO $$ BEGIN EXECUTE (SELECT definition FROM fase2_private.reprocess_ddl_checkpoint
        WHERE signature='public.recalculate_user_performance(uuid)'); END $$; COMMIT;`);
    eq(await a.query(digest), before, 'documented rollback preserves data/checkpoints');
    eq(await a.query(`SELECT pg_get_functiondef('public.recalculate_user_performance(uuid)'::regprocedure)=
      (SELECT definition FROM fase2_private.reprocess_ddl_checkpoint
        WHERE signature='public.recalculate_user_performance(uuid)');`), 't', 'rollback restores exact first helper definition');
    eq(await a.query(helperIdentity), identityBefore, 'helper rollback preserves owner/ACL/signature/config');
    const migration = await readFile('supabase/migrations/20261104110000_fase2_reprocess.sql', 'utf8');
    await a.query(`${safety}\n${migration}`);
    eq(await a.query(digest), before, 'reapply preserves populated data/checkpoints');
    await a.query(`${safety}\n${migration}`);
    eq(await a.query(digest), before, 'second reapply preserves populated data/checkpoints');
    eq(await a.query(helperIdentity), identityBefore, 'helper reapply preserves owner/ACL/signature/config');
    return { database: t.database, assertions, evidence, fixture_retained: true, limits: '6s statement / 5s lock / 4s observed barrier / 10s client' };
  } finally {
    await a.close(); await b.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await runConcurrency({ database: process.argv[2] }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
