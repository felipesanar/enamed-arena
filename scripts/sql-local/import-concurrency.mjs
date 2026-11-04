import { spawn } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export function localTarget({ host = '127.0.0.1', port = 54737, user = 'postgres', database } = {}) {
  if (host !== '127.0.0.1' || Number(port) !== 54737 || user !== 'postgres'
    || typeof database !== 'string' || !/^enamed_test_[a-z0-9_]+$/.test(database) || database.length > 63) {
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
  IF current_database() !~ '^enamed_test_[a-z0-9_]+$' OR inet_server_port() IS DISTINCT FROM 54737
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR session_user <> 'postgres'
  THEN RAISE EXCEPTION 'Unsafe local target'; END IF;
END $$;`;

function session(config, name) {
  const child = spawn(psql, [...connectionArgs(config), '-qAt'], {
    env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let pending, output = '', errors = '', ended = false;
  const settle = error => {
    if (!pending || (!error && !output.includes(pending.marker))) return;
    const job = pending;
    pending = null;
    clearTimeout(job.timer);
    if (error) job.reject(new Error(`${name}: ${error}; ${errors}`));
    else job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
  };
  child.stdout.on('data', data => { output += data; settle(); });
  child.stderr.on('data', data => { errors += data; });
  child.on('error', error => settle(error.message));
  const closed = new Promise(done => child.on('close', code => {
    ended = true;
    settle(`psql exit ${code}`);
    done(code);
  }));
  return {
    name,
    query(sql) {
      if (pending || ended) throw new Error(`${name}: session busy/closed`);
      output = ''; errors = '';
      return new Promise((done, reject) => {
        const marker = `DONE_${randomUUID()}`;
        pending = { marker, resolve: done, reject, timer: setTimeout(() => {
          settle('bounded query timeout'); child.kill();
        }, 10000) };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    async close() {
      if (ended) return;
      child.stdin.end('ROLLBACK;\n\\q\n');
      const timer = setTimeout(() => child.kill(), 1000);
      await closed;
      clearTimeout(timer);
    },
  };
}

export async function runConcurrency(config) {
  const t = localTarget(config);
  const prefix = `f1-import-${randomUUID()}`;
  const year = randomInt(2100, 9900);
  const ids = { user: randomUUID(), blueprint: randomUUID(), area: randomUUID(), edition: randomUUID(),
    sims: Array.from({ length: 4 }, () => randomUUID()) };
  const quote = value => `'${value}'`;
  const list = ids.sims.map(quote).join(',');
  const auth = `SET ROLE authenticated; SET request.jwt.claim.sub = '${ids.user}';`;
  const rows = `'[{"question_number":1,"text":"Concurrency fixture","area":"PED","options":[{"label":"A","text":"a","is_correct":true},{"label":"B","text":"b","is_correct":false},{"label":"C","text":"c","is_correct":false},{"label":"D","text":"d","is_correct":false}]}]'::jsonb`;
  const importing = n => `SELECT public.admin_import_questions('${ids.sims[n]}',${rows});`;
  const creating = n => `SELECT (public.create_attempt_guarded('${ids.sims[n]}')).id;`;
  const a = session(t, `${prefix}-a`), b = session(t, `${prefix}-b`);
  let assertions = 0, created = false;
  const evidence = [];
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
  const unwrap = result => { if (result.error) throw result.error; return result.value; };
  async function lockState(observer, waiter) {
    return observer.query(`RESET ROLE; SELECT EXISTS(SELECT 1 FROM pg_stat_activity
      WHERE datname=current_database() AND application_name='${waiter.name}' AND wait_event_type='Lock'
      AND pg_backend_pid()=ANY(pg_blocking_pids(pid))
      AND EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_stat_activity.pid AND NOT granted)); SET ROLE authenticated;`);
  }
  async function blocked(observer, waiter) {
    const until = Date.now() + 4000;
    do {
      if (await lockState(observer, waiter) === 't') {
        assertions++;
        evidence.push(`${waiter.name.slice(-1)} waits for ${observer.name.slice(-1)}: pg_stat_activity Lock + pg_blocking_pids + ungranted pg_locks`);
        return;
      }
      // Poll pacing is not evidence: only server lock state satisfies the barrier.
      await new Promise(done => setTimeout(done, 10));
    } while (Date.now() < until);
    throw new Error('Real lock barrier not observed within 4s');
  }
  async function independent(sql) {
    let done = false;
    const result = outcome(b.query(sql));
    result.then(() => { done = true; });
    while (!done) {
      assert.equal(await lockState(a, b), 'f', 'attempt on OTHER simulado must not wait for importer');
      await new Promise(next => setTimeout(next, 10));
    }
    assertions++;
    return unwrap(await result);
  }
  try {
    for (const s of [a, b]) {
      await s.query(`SET statement_timeout='6s'; SET lock_timeout='5s'; SET idle_in_transaction_session_timeout='15s'; ${safety}`);
      equal(await s.query('SHOW transaction_isolation;'), 'read committed', 'actual connection isolation');
    }
    const definitions = await a.query(`SELECT pg_get_functiondef('public.create_attempt_guarded(uuid)'::regprocedure)
      || pg_get_functiondef('public.enforce_attempt_edition_snapshot()'::regprocedure);`);
    equal(/FOR SHARE/i.test(definitions), true, 'real model trigger takes parent SHARE lock');
    equal(await a.query(`SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.attempts'::regclass
      AND confrelid='public.simulados'::regclass AND contype='f' AND convalidated);`), 't', 'validated parent FK');
    await a.query(`BEGIN; ${safety}
      INSERT INTO auth.users(id,email) VALUES('${ids.user}','${prefix}@example.invalid');
      INSERT INTO public.user_roles(user_id,role) VALUES('${ids.user}','content_editor');
      INSERT INTO public.exam_blueprints(id,code,label) VALUES('${ids.blueprint}','${prefix}','Concurrency fixture');
      INSERT INTO public.exam_areas(id,blueprint_id,code,label,aliases,weight,sort_order)
        VALUES('${ids.area}','${ids.blueprint}','PED','Pediatria',ARRAY['PED'],1,1);
      INSERT INTO public.exam_editions(id,code,year,term,label,status,format,blueprint_id)
        VALUES('${ids.edition}','${year}.1',${year},1,'Concurrency fixture','preparing',
        '{"questions":120,"options":4,"duration_minutes":60,"scoring":"raw"}','${ids.blueprint}');
      INSERT INTO public.simulados(id,title,slug,sequence_number,status,edition_id,duration_minutes,
        execution_window_start,execution_window_end,results_release_at)
      SELECT id,'Concurrency fixture','${prefix}-'||ordinality,990000+ordinality,'test','${ids.edition}',60,
        now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours'
      FROM unnest(ARRAY[${list}]::uuid[]) WITH ORDINALITY s(id,ordinality);
      COMMIT;`);
    created = true;
    await a.query(auth); await b.query(auth);

    await a.query('BEGIN;');
    equal(JSON.parse(await a.query(importing(0))).imported, 1, 'import writes while transaction remains open');
    const other = await independent(creating(1));
    equal(/^[0-9a-f-]{36}$/.test(other), true, 'other simulado creates before import commit');
    await independent(`SELECT public.update_attempt_progress_guarded('${other}',0,3,2);`);
    equal(await b.query(`SELECT tab_exit_count||':'||fullscreen_exit_count FROM public.attempts WHERE id='${other}';`), '3:2', 'other simulado updates before import commit');
    evidence.push('Other simulado INSERT and guarded UPDATE completed while importer transaction remained open');

    const target = outcome(b.query(creating(0)));
    await blocked(a, b);
    equal(await a.query(`SELECT count(*) FROM public.attempts WHERE simulado_id='${ids.sims[0]}';`), '0', 'no target attempt before import commit');
    await a.query('COMMIT;');
    equal(/^[0-9a-f-]{36}$/.test(unwrap(await target)), true, 'target creation resumes after commit');
    equal(await b.query(`SELECT count(*) FROM public.question_options o JOIN public.questions q ON q.id=o.question_id WHERE q.simulado_id='${ids.sims[0]}';`), '4', 'target sees full imported batch after commit');
    evidence.push('Import-first: target guarded creation waited until full batch committed');

    await b.query(`BEGIN; ${creating(2)}`);
    const waitingImport = outcome(a.query(importing(2)));
    await blocked(b, a);
    await b.query('COMMIT;');
    const rejected = JSON.parse(unwrap(await waitingImport));
    equal(rejected.ok, false, 'attempt-first: post-lock READ COMMITTED check sees committed attempt');
    equal(rejected.errors[0].field, 'simulado', 'attempt blocks import with content error');
    equal(await a.query(`SELECT count(*) FROM public.questions WHERE simulado_id='${ids.sims[2]}';`), '0', 'attempt-first wrote zero questions');
    evidence.push('Attempt-first: importer waited on parent then rejected newly committed attempt, questions=0');

    await a.query(`BEGIN; ${importing(3)}`);
    const direct = outcome(b.query(`RESET ROLE; INSERT INTO public.attempts(simulado_id,user_id,effective_deadline)
      VALUES('${ids.sims[3]}','${ids.user}',now()+interval '1 hour') RETURNING id; ${auth}`));
    await blocked(a, b);
    await a.query('ROLLBACK;');
    equal(/^[0-9a-f-]{36}$/.test(unwrap(await direct)), true, 'trusted direct INSERT obeys parent trigger/FK lock too');
    equal(await b.query(`SELECT count(*) FROM public.questions WHERE simulado_id='${ids.sims[3]}';`), '0', 'rollback left no imported questions');
    evidence.push('Trusted direct INSERT also waited for importer parent lock; rollback left questions=0');
    return { database: t.database, assertions, evidence };
  } finally {
    await Promise.all([a.close(), b.close()]);
    if (created) {
      const cleanup = session(t, `${prefix}-cleanup`);
      try {
        await cleanup.query(`SET statement_timeout='6s'; SET lock_timeout='5s'; BEGIN; ${safety}
          DELETE FROM public.attempts WHERE simulado_id IN (${list}) AND user_id='${ids.user}';
          DELETE FROM public.simulados WHERE id IN (${list});
          DELETE FROM public.exam_editions WHERE id='${ids.edition}';
          DELETE FROM public.exam_areas WHERE id='${ids.area}';
          DELETE FROM public.exam_blueprints WHERE id='${ids.blueprint}';
          DELETE FROM public.admin_audit_log WHERE actor_id='${ids.user}';
          DELETE FROM auth.users WHERE id='${ids.user}'; COMMIT;`);
      } finally { await cleanup.close(); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await runConcurrency({ database: process.argv[2] }), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
