import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PG_BIN, target, connectionArgs, cleanEnvironment, runChecked } from './harness.mjs';

export function freshnessTarget(config) {
  const result = target(config);
  if (!/^enamed_test_answer_freshness_[a-z0-9_]+$/.test(result.database)) throw Error('Exclusive freshness clone required');
  return result;
}
const psql = resolve(PG_BIN, 'psql.exe');
function sql(config, statement) {
  return runChecked(psql, [...connectionArgs(config), '-At', '-c', statement]);
}
function preflight(config) {
  const expected = `127.0.0.1|54737|${config.database}|postgres`;
  const actual = sql(config, "SELECT host(inet_server_addr())||'|'||inet_server_port()||'|'||current_database()||'|'||session_user;").trim();
  assert.equal(actual, expected, 'host, port, DB and session_user verified before mutation');
  return actual;
}
function session(config, name) {
  const child = spawn(psql, [...connectionArgs(config), '-qAt'], {
    env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '', errors = '', pending, sequence = 0;
  child.stdout.on('data', chunk => {
    output += chunk;
    if (pending && output.includes(pending.marker)) {
      clearTimeout(pending.timer);
      const job = pending; pending = undefined;
      job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
    }
  });
  child.stderr.on('data', chunk => { errors += chunk; });
  const closed = new Promise(done => child.on('close', code => {
    if (pending) { clearTimeout(pending.timer); pending.reject(Error(`${name}: ${code}: ${errors}`)); pending = undefined; }
    done();
  }));
  child.on('error', error => { if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = undefined; } });
  return {
    name,
    query(statement) {
      if (pending) throw Error('Session busy');
      output = ''; errors = '';
      return new Promise((resolveQuery, reject) => {
        const marker = `FRESHNESS_DONE_${++sequence}`;
        pending = { marker, resolve: resolveQuery, reject, timer: setTimeout(() => { child.kill(); reject(Error('Query timeout')); }, 10000) };
        child.stdin.write(`${statement}\n\\echo ${marker}\n`);
      });
    },
    async close() { child.stdin.end('ROLLBACK;\n\\q\n'); const timer = setTimeout(() => child.kill(), 1000); await closed; clearTimeout(timer); },
  };
}

export async function runConcurrency(config) {
  const t = freshnessTarget(config);
  preflight(t);
  const a = session(t, `f3-freshness-${process.pid}-a`);
  const b = session(t, `f3-freshness-${process.pid}-b`);
  const id = label => `md5('f3-real:${label}')::uuid`;
  const student = id('student');
  const attempt = n => id(`a${n}`);
  const auth = `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${student}::text,false);
    SELECT set_config('request.jwt.claims',jsonb_build_object('sub',${student},'role','authenticated')::text,false);`;
  const upsert = (n, version) => `INSERT INTO public.answers(attempt_id,question_id,marked_for_review,client_updated_at)
    VALUES(${attempt(n)},${id(`q${n}`)},${version === 2},'2020-01-0${version}Z')
    ON CONFLICT(attempt_id,question_id) DO UPDATE SET marked_for_review=EXCLUDED.marked_for_review,client_updated_at=EXCLUDED.client_updated_at;`;
  try {
    for (const s of [a,b]) await s.query("SET statement_timeout='7s'; SET lock_timeout='6s'; SET idle_in_transaction_session_timeout='15s';");
    await a.query(`BEGIN;
      INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(${student},'f3-real@example.invalid','{}'),(${id('admin')},'f3-real-admin@example.invalid','{}');
      INSERT INTO public.user_roles(user_id,role) SELECT ${id('admin')},role FROM public.role_capabilities WHERE capability='content.manage' LIMIT 1;
      SELECT set_config('request.jwt.claim.sub',${id('admin')}::text,true);
      SELECT set_config('request.jwt.claims',jsonb_build_object('sub',${id('admin')},'role','authenticated')::text,true);
      INSERT INTO public.exam_editions(id,code,year,term,label,blueprint_id,format)
      SELECT ${id('edition')},'2099.2',2099,2,'F3 concurrency',id,'{"questions":1,"options":2,"duration_minutes":60,"scoring":"raw"}' FROM public.exam_blueprints ORDER BY code LIMIT 1;
      INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,edition_id,execution_window_start,execution_window_end,results_release_at)
      SELECT md5('f3-real:s'||n)::uuid,'Fixture','f3-real-'||n,998000+n,'draft',1,60,${id('edition')},now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours' FROM generate_series(1,2) n;
      INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme,area_id)
      SELECT md5('f3-real:q'||n)::uuid,md5('f3-real:s'||n)::uuid,1,'Fixture',a.label,'Fixture',a.id FROM generate_series(1,2) n
      CROSS JOIN LATERAL (SELECT * FROM public.exam_areas WHERE blueprint_id=(SELECT blueprint_id FROM public.exam_editions WHERE id=${id('edition')}) ORDER BY sort_order LIMIT 1) a;
      INSERT INTO public.question_options(question_id,label,text,is_correct)
      SELECT md5('f3-real:q'||n)::uuid,v.label,'Fixture',v.correct FROM generate_series(1,2) n CROSS JOIN (VALUES('A',true),('B',false)) v(label,correct);
      UPDATE public.simulados SET status='published' WHERE edition_id=${id('edition')};
      INSERT INTO public.attempts(id,user_id,simulado_id,status,attempt_type,started_at,effective_deadline,is_within_window)
      SELECT md5('f3-real:a'||n)::uuid,${student},md5('f3-real:s'||n)::uuid,'in_progress','online',now(),now()+interval '1 hour',true FROM generate_series(1,2) n;
      COMMIT;`);
    await a.query(auth); await b.query(auth);
    for (const [n, first, second] of [[1,2,1],[2,1,2]]) {
      await a.query(`BEGIN; ${upsert(n, first)}`);
      const waiting = b.query(upsert(n, second)).then(value => ({ value }), error => ({ error }));
      let observed = false;
      for (let i=0; i<80; i++) {
        const lock = await a.query(`RESET ROLE; SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
          AND application_name='${b.name}' AND wait_event_type='Lock' AND pg_backend_pid()=ANY(pg_blocking_pids(pid)); SET ROLE authenticated;`);
        if (lock === '1') { observed = true; break; }
        await new Promise(done => setTimeout(done, 25));
      }
      assert.ok(observed, 'two real connections meet at PostgreSQL lock barrier');
      await a.query('COMMIT;');
      const result = await waiting;
      if (result.error) throw result.error;
      assert.equal(await a.query(`SELECT marked_for_review AND client_updated_at='2020-01-02Z' FROM public.answers WHERE attempt_id=${attempt(n)};`), 't');
      console.log(`PASS real lock barrier: first version ${first}, waiting version ${second}; version 2 preserved`);
    }
    const snapshot = () => sql(t, `SELECT row_to_json(an) FROM public.answers an WHERE attempt_id IN (${attempt(1)},${attempt(2)}) ORDER BY attempt_id;
      SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.answers'::regclass AND tgname='trg_enforce_answer_integrity';`);
    const before = snapshot();
    const migration = readFileSync(resolve('supabase/migrations/20261104120001_fase3_answer_freshness.sql'), 'utf8');
    const body = migration.slice(migration.indexOf('BEGIN;') + 6, migration.indexOf('\nCOMMIT;'));
    const rollback = migration.split('-- ROLLBACK SQL START\n')[1].split('-- ROLLBACK SQL END')[0].replace(/^-- ?/gm, '');
    assert.throws(() => sql(t, `BEGIN; DROP TRIGGER zzzz_answer_freshness ON public.answers;
      CREATE TRIGGER zzzz_answer_freshness BEFORE INSERT ON public.answers FOR EACH ROW EXECUTE FUNCTION public.enforce_answer_integrity();
      ${body} ROLLBACK;`), /trigger drift/);
    assert.equal(snapshot(), before);
    console.log('PASS unknown trigger drift rejected atomically');
    const altered = `CREATE OR REPLACE FUNCTION public.enforce_answer_freshness() RETURNS trigger
      LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $guard$ BEGIN RETURN NEW; END $guard$;`;
    const definition = () => sql(t, "SELECT pg_get_functiondef('public.enforce_answer_freshness()'::regprocedure);").replace(/\r\n/g, '\n');
    const originalDefinition = definition();
    try {
      sql(t, altered);
      const changedDefinition = definition();
      assert.throws(() => runChecked(psql, [...connectionArgs(t), '-f', resolve('supabase/migrations/20261104120001_fase3_answer_freshness.sql')]), /function drift/);
      assert.equal(definition(), changedDefinition, 'failed reapply preserves the committed later helper');
      assert.throws(() => sql(t, rollback), /rollback drift/);
      assert.equal(definition(), changedDefinition, 'failed rollback preserves the committed later helper');
      sql(t, originalDefinition);
      sql(t, 'ALTER FUNCTION public.enforce_answer_freshness() SECURITY DEFINER;');
      const changedMetadata = definition();
      assert.throws(() => runChecked(psql, [...connectionArgs(t), '-f', resolve('supabase/migrations/20261104120001_fase3_answer_freshness.sql')]), /function drift/);
      assert.equal(definition(), changedMetadata, 'failed reapply preserves later metadata');
    } finally {
      // Restore only the exact helper captured from this exclusive test clone.
      sql(t, originalDefinition);
    }
    assert.equal(snapshot(), before);
    console.log('PASS unknown function body/metadata rejected by reapply and rollback');
    sql(t, rollback);
    assert.equal(snapshot(), before, 'rollback preserves nonzero answer/version data and F0');
    for (let i=0; i<2; i++) runChecked(psql, [...connectionArgs(t), '-f', resolve('supabase/migrations/20261104120001_fase3_answer_freshness.sql')]);
    assert.equal(snapshot(), before, 'reapply preserves nonzero answer/version data and F0');
    console.log('PASS rollback and double reapply preserve actual answers, versions and F0');
  } finally {
    await a.close(); await b.close();
    // Only exact committed fixture IDs from this run. Never drop a database.
    sql(t, `BEGIN; DELETE FROM public.answers WHERE attempt_id IN (${attempt(1)},${attempt(2)});
      DELETE FROM public.attempts WHERE id IN (${attempt(1)},${attempt(2)});
      DELETE FROM public.question_options WHERE question_id IN (${id('q1')},${id('q2')});
      DELETE FROM public.questions WHERE id IN (${id('q1')},${id('q2')});
      DELETE FROM public.simulados WHERE id IN (${id('s1')},${id('s2')});
      DELETE FROM public.exam_editions WHERE id=${id('edition')}; DELETE FROM auth.users WHERE id IN (${student},${id('admin')}); COMMIT;`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, database] = process.argv.slice(2);
  if (mode === '--create') {
    const template = target({ database: 'enamed_test_f1_admin_review_20261104' });
    console.log(preflight(template));
    const fresh = freshnessTarget({ database: `enamed_test_answer_freshness_${Date.now()}_${process.pid}` });
    sql(template, `CREATE DATABASE ${fresh.database} TEMPLATE ${template.database};`);
    console.log(preflight(fresh));
  } else if (mode === '--inspect') {
    const t = freshnessTarget({ database });
    console.log(preflight(t));
    console.log(sql(t, "SELECT tablename,policyname,qual FROM pg_policies WHERE tablename IN ('questions','question_options','simulados'); SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.answers'::regclass AND NOT tgisinternal;"));
  } else if (mode === '--red' || mode === '--run') {
    const t = freshnessTarget({ database });
    console.log(preflight(t));
    if (mode === '--run') {
      const file = resolve('supabase/migrations/20261104120001_fase3_answer_freshness.sql');
      console.log(runChecked(psql, [...connectionArgs(t), '-f', file]));
      console.log(runChecked(psql, [...connectionArgs(t), '-f', file]));
    }
    console.log(runChecked(psql, [...connectionArgs(t), '-f', resolve('supabase/tests/fase3_answer_freshness.sql')]));
    if (mode === '--run') await runConcurrency(t);
  } else throw Error('Use --create, --red <own-clone> or --run <own-clone>');
}
