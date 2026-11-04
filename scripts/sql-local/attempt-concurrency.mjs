import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { PG_BIN, target, connectionArgs, cleanEnvironment } from './harness.mjs';

export function concurrencyTarget(config) {
  const t = target(config);
  if (!/^enamed_test_attempt_[a-z0-9_]+$/.test(t.database)) throw new Error('An exclusive attempt test database is required');
  return t;
}

// Persistent psql children are the two real connections. No shell, credentials,
// process-name termination, trigger changes, RLS bypass for client operations or HTTP.
function session(config, name) {
  const child = spawn(resolve(PG_BIN, 'psql.exe'), [...connectionArgs(config), '-qAt'], {
    env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '', errors = '', pending = null, sequence = 0, ended = false;
  function settle(error) {
    if (!pending) return;
    const job = pending;
    if (!error && !output.includes(job.marker)) return;
    pending = null;
    clearTimeout(job.timer);
    if (error) job.reject(new Error(`${name}: ${error}; ${errors}`));
    else job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
  }
  child.stdout.on('data', data => { output += data; settle(); });
  child.stderr.on('data', data => { errors += data; });
  child.on('error', error => settle(error.message));
  const closed = new Promise(resolveClosed => child.on('close', code => {
    ended = true;
    settle(`psql exit ${code}`);
    resolveClosed(code);
  }));
  return {
    name,
    query(sql) {
      if (pending || ended) throw new Error(`${name}: session busy or closed`);
      output = ''; errors = '';
      const marker = `DONE_${++sequence}`;
      return new Promise((resolveQuery, reject) => {
        pending = { marker, resolve: resolveQuery, reject, timer: setTimeout(() => {
          settle('bounded query timeout'); child.kill();
        }, 10000) };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    async close() {
      if (!ended) {
        child.stdin.end('ROLLBACK;\n\\q\n');
        const timer = setTimeout(() => child.kill(), 1000);
        await closed;
        clearTimeout(timer);
      }
    },
  };
}

const id = label => `md5('f1-concurrency:${label}')::uuid`;
const student = id('student');
const sim = n => id(`sim${n}`);
const attempt = n => `(SELECT id FROM public.attempts WHERE simulado_id=${sim(n)} AND user_id=${student} AND attempt_type='online')`;
const create = n => `SELECT (public.create_attempt_guarded(${sim(n)})).id;`;
const answer = n => `INSERT INTO public.answers(attempt_id,question_id,selected_option_id)
 VALUES(${attempt(n)},${id(`q${n}`)},${id(`opt${n}`)})
 ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id;`;
const finalize = n => `SELECT score_percentage FROM public.finalize_attempt_with_results(${attempt(n)},true);`;
const auth = `SET ROLE authenticated;
 SELECT set_config('request.jwt.claim.sub',${student}::text,false);
 SELECT set_config('request.jwt.claims',jsonb_build_object('sub',${student},'role','authenticated')::text,false);`;

export async function runConcurrency(config) {
  const t = concurrencyTarget(config);
  const prefix = `f1-attempt-${process.pid}`;
  const a = session(t, `${prefix}-a`);
  const b = session(t, `${prefix}-b`);
  const evidence = [];
  // The lock holder is also the observer, so only two connections are needed.
  async function blocked(observer, waiter) {
    const until = Date.now() + 4000;
    do {
      const observed = await observer.query(`RESET ROLE; SELECT count(*) FROM pg_stat_activity
        WHERE datname=current_database() AND application_name='${waiter.name}'
        AND wait_event_type='Lock' AND pg_backend_pid()=ANY(pg_blocking_pids(pid));
        SET ROLE authenticated;`);
      if (observed === '1') {
        evidence.push(`${waiter.name} blocked by ${observer.name}: pg_blocking_pids + wait_event_type=Lock`);
        return;
      }
      await new Promise(done => setTimeout(done, 20));
    } while (Date.now() < until);
    throw new Error('Expected real lock barrier was not observed');
  }
  // Attach a rejection handler immediately; an expected server rejection may
  // arrive while the other session is still committing.
  const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
  try {
    for (const s of [a,b]) await s.query("SET statement_timeout='6s'; SET lock_timeout='5s'; SET idle_in_transaction_session_timeout='15s';");
    await a.query(`BEGIN;
      INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(${student},'f1-concurrency@example.invalid','{}');
      INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,
       execution_window_start,execution_window_end,results_release_at)
      SELECT md5('f1-concurrency:sim'||n)::uuid,'F1 concurrency','f1-concurrency-'||n,991000+n,
       'published',1,60,now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours'
      FROM generate_series(1,3) n;
      INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
      SELECT md5('f1-concurrency:q'||n)::uuid,md5('f1-concurrency:sim'||n)::uuid,1,
       'Fixture','Clinica Medica','Fixture' FROM generate_series(1,3) n;
      INSERT INTO public.question_options(id,question_id,label,text,is_correct)
      SELECT md5('f1-concurrency:opt'||n)::uuid,md5('f1-concurrency:q'||n)::uuid,'A','Correct',true
      FROM generate_series(1,3) n;
      COMMIT;`);
    await a.query(auth); await b.query(auth);

    await a.query('BEGIN;');
    const first = await a.query(create(1));
    const secondPending = outcome(b.query(create(1)));
    await blocked(a,b);
    await a.query('COMMIT;');
    const second = await secondPending;
    if (second.error) throw second.error;
    assert.match(first, /^[0-9a-f-]{36}$/);
    assert.equal(second.value, first, 'overlapping creates return one non-null ID');
    assert.equal(await a.query(`SELECT count(*) FROM public.attempts WHERE simulado_id=${sim(1)};`), '1');
    evidence.push(`create: one ID ${first}, one row`);

    await a.query(`BEGIN; SELECT public.update_attempt_progress_guarded(${attempt(1)},0,25,17);`);
    const oldCounters = outcome(b.query(`SELECT public.update_attempt_progress_guarded(${attempt(1)},0,1,2);`));
    await blocked(a,b);
    await a.query('COMMIT;');
    const counters = await oldCounters;
    if (counters.error) throw counters.error;
    assert.equal(await a.query(`SELECT tab_exit_count||':'||fullscreen_exit_count FROM public.attempts WHERE id=${attempt(1)};`),'25:17');
    evidence.push('old counter request waiting for newer update: tab=25, fullscreen=17');

    await a.query(create(2));
    await a.query(`BEGIN; ${answer(2)}`);
    const finalizing = outcome(b.query(finalize(2)));
    await blocked(a,b);
    await a.query('COMMIT;');
    const finalized = await finalizing;
    if (finalized.error) throw finalized.error;
    assert.equal(Number(finalized.value),100, 'answer holding parent lock enters real RPC score');
    assert.equal(await a.query(`SELECT total_correct||':'||total_answered||':'||score_percentage FROM public.attempts WHERE id=${attempt(2)};`),'1:1:100.00');
    assert.equal(Number(await a.query(finalize(2))),100, 'finalization remains idempotent');
    evidence.push('answer before finalizer: persisted score=100, correct=1, answered=1, idempotent RPC=100');

    await a.query(create(3));
    await a.query('BEGIN;');
    assert.equal(Number(await a.query(finalize(3))),0);
    const lateAnswer = outcome(b.query(answer(3)));
    await blocked(a,b);
    await a.query('COMMIT;');
    const late = await lateAnswer;
    assert.match(late.error?.message ?? '',/psql exit 3/);
    assert.match(late.error?.message ?? '',/online attempt is not in progress/);
    assert.equal(await a.query(`SELECT count(*) FROM public.answers WHERE attempt_id=${attempt(3)};`),'0');
    assert.equal(Number(await a.query(finalize(3))),0);
    evidence.push('answer waiting for committed finalization: rejected, answers=0, score remains 0');
    return { database: t.database, connections: 2, evidence };
  } finally {
    // Only our known children are stopped. Restore/delete only our fixture IDs.
    await b.close();
    try {
      await a.query(`ROLLBACK; RESET ROLE; BEGIN;
        SELECT set_config('request.jwt.claim.sub','',false);
        SELECT set_config('request.jwt.claims','{}',false);
        DELETE FROM auth.users WHERE id=${student};
        DELETE FROM public.simulados WHERE id IN (${sim(1)},${sim(2)},${sim(3)}); COMMIT;`);
    } finally { await a.close(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await runConcurrency({ database: process.argv[2] }),null,2)); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
