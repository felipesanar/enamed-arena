import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const PSQL = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe';
const TEMPLATE = 'enamed_test_f1_target_review_20261104';
export function adminTarget({ host = '127.0.0.1', port = 54737, user = 'postgres', database, template = TEMPLATE } = {}) {
  if (host !== '127.0.0.1' || Number(port) !== 54737 || user !== 'postgres' || template !== TEMPLATE
    || typeof database !== 'string' || !/^enamed_test_admin_[a-z0-9_]+$/.test(database) || database.length > 63) {
    throw new Error('Connection outside admin local allowlist');
  }
  return { host, port: 54737, user, database, template };
}
export function cleanEnvironment(env = process.env) {
  return { ...Object.fromEntries(Object.entries(env).filter(([key]) => !/^pg/i.test(key))),
    PGCONNECT_TIMEOUT: '5', PGPASSFILE: process.platform === 'win32' ? 'NUL' : '/dev/null', PGSSLMODE: 'disable' };
}
export function barrierSql(holder, waiter) {
  if (![holder, waiter].every(pid => Number.isInteger(pid) && pid > 0)) throw new Error('Invalid backend pid');
  return `SELECT count(*) FROM pg_stat_activity a WHERE a.pid=${waiter} AND a.datname=current_database()
    AND a.wait_event_type='Lock' AND ${holder}=ANY(pg_blocking_pids(a.pid))
    AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND NOT l.granted);`;
}
const args = (t, database = t.database) => ['-X', '-w', '-h', t.host, '-p', String(t.port), '-U', t.user,
  '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'];
function checked(t, extra, maintenance = false) {
  const result = spawnSync(PSQL, [...args(t, maintenance ? t.template : t.database), ...extra], {
    env: cleanEnvironment(), encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`psql exit ${result.status}: ${result.error?.message ?? ''}\n${result.stderr}`);
  return { exit: result.status, output: result.stdout.trim() };
}

// Two persistent psql children, no driver, shell, external connection or sleep barrier.
function session(t, name) {
  const child = spawn(PSQL, args(t), { env: { ...cleanEnvironment(), PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', pending = null, ended = false, sequence = 0;
  const settle = error => {
    if (!pending || (!error && !output.includes(pending.marker))) return;
    const job = pending; pending = null; clearTimeout(job.timer);
    if (error) job.reject(new Error(`${name}: ${error}; ${errors}`));
    else job.resolve(output.slice(0, output.indexOf(job.marker)).trim());
  };
  child.stdout.on('data', data => { output += data; settle(); });
  child.stderr.on('data', data => { errors += data; });
  child.on('error', error => settle(error.message));
  const closed = new Promise(done => child.on('close', code => { ended = true; settle(`psql exit ${code}`); done(code); }));
  return {
    name,
    query(sql) {
      if (pending || ended) throw new Error(`${name}: session busy or closed`);
      output = ''; errors = '';
      const marker = `ADMIN_DONE_${++sequence}`;
      return new Promise((done, reject) => {
        pending = { marker, resolve: done, reject, timer: setTimeout(() => { settle('query timeout'); child.kill(); }, 12000) };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    },
    async close() {
      if (!ended) {
        child.stdin.end('ROLLBACK;\n\\q\n');
        const timer = setTimeout(() => child.kill(), 1000);
        await closed; clearTimeout(timer);
      }
      return closed;
    },
  };
}

export async function runConcurrency(config) {
  const t = adminTarget(config);
  const evidence = [], exits = {}, connections = [];
  let created = false;
  const id = label => `md5('${t.database}:${label}')::uuid`;
  const user = id('admin'), edition = id('edition');
  const sim = n => id(`sim${n}`), question = n => id(`q${n}`);
  const fixtureIds = {};
  const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
  try {
    exits.create = checked(t, ['-c', `CREATE DATABASE ${t.database} TEMPLATE ${t.template};`], true).exit;
    created = true;
    const ids = checked(t, ['-c', `SELECT json_build_object('admin',${user});`]);
    Object.assign(fixtureIds, JSON.parse(ids.output));
    const authSql = `SET ROLE authenticated; SET request.jwt.claim.sub='${fixtureIds.admin}';
      SET request.jwt.claims='{"sub":"${fixtureIds.admin}","role":"authenticated"}';`;
    exits.migration = checked(t, ['-f', fileURLToPath(new URL('../../supabase/migrations/20261104073841_fase1_admin_editions.sql', import.meta.url))]).exit;
    exits.fixture = checked(t, ['-f', fileURLToPath(new URL('../../supabase/tests/fase1_admin_editions.sql', import.meta.url))]).exit;
    checked(t, ['-c', `BEGIN;
      INSERT INTO auth.users(id,email) VALUES(${user},'admin-concurrency@example.invalid');
      INSERT INTO public.user_roles(user_id,role) SELECT ${user},role FROM public.role_capabilities WHERE capability='content.manage' LIMIT 1;
      INSERT INTO public.exam_editions(id,code,year,term,label,status,format,blueprint_id)
      SELECT ${edition},'2097.2',2097,2,'Admin concurrency','planned',
        '{"questions":1,"options":2,"duration_minutes":30,"scoring":"raw"}',b.id
      FROM public.exam_blueprints b WHERE EXISTS(SELECT 1 FROM public.exam_areas a WHERE a.blueprint_id=b.id) ORDER BY b.code LIMIT 1;
      INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,status,duration_minutes,questions_count,
        execution_window_start,execution_window_end,results_release_at)
      SELECT md5('${t.database}:sim'||n)::uuid,'Concurrency fixture','${t.database}-'||n,n,${edition},'draft',30,1,
        '2097-01-01','2097-01-02','2097-01-03' FROM generate_series(1,3) n;
      INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme,area_id)
      SELECT md5('${t.database}:q'||n)::uuid,md5('${t.database}:sim'||n)::uuid,1,'Fixture',a.label,'Fixture',a.id
      FROM generate_series(1,3) n CROSS JOIN LATERAL
        (SELECT a.* FROM public.exam_areas a JOIN public.exam_editions e ON e.blueprint_id=a.blueprint_id WHERE e.id=${edition} ORDER BY a.sort_order LIMIT 1) a;
      INSERT INTO public.question_options(question_id,label,text,is_correct)
      SELECT md5('${t.database}:q'||n)::uuid,'A','Yes',true FROM generate_series(1,3) n;
      INSERT INTO public.question_options(question_id,label,text,is_correct) VALUES(${question(1)},'B','No',false),(${question(3)},'B','No',false);
      COMMIT;`]);
    const a = session(t, `admin-${process.pid}-a`), b = session(t, `admin-${process.pid}-b`);
    connections.push(a, b);
    for (const s of connections) await s.query("SET statement_timeout='8s'; SET lock_timeout='6s'; SET idle_in_transaction_session_timeout='20s';");
    const pidA = Number(await a.query('SELECT pg_backend_pid();')), pidB = Number(await b.query('SELECT pg_backend_pid();'));
    assert.notEqual(pidA, pidB);
    evidence.push({ connections: [pidA, pidB], database: t.database });
    await a.query(authSql); await b.query(authSql);
    const blocked = async (label) => {
      const until = Date.now() + 4000;
      do {
        const observed = await a.query(`RESET ROLE; ${barrierSql(pidA, pidB)} SET ROLE authenticated;`);
        if (observed === '1') { evidence.push({ scenario: label, holder: pidA, waiter: pidB, barrier: 'pg_stat_activity Lock + pg_locks ungranted + pg_blocking_pids' }); return; }
      } while (Date.now() < until);
      throw new Error(`${label}: real lock barrier not observed`);
    };
    const snapshot = `SELECT jsonb_build_object('simulado',to_jsonb(s),'questions',
      (SELECT jsonb_agg(to_jsonb(q)) FROM public.admin_get_simulado_questions(s.id) q),
      'attempts',(SELECT count(*) FROM public.attempts WHERE simulado_id=s.id)) FROM public.simulados s WHERE s.id=${sim(1)};`;
    const before = await a.query(snapshot);
    const clone = `SELECT public.admin_clone_simulado(${sim(1)},${edition},'2097-02-01','2097-02-02','2097-02-03',true);`;
    await a.query('BEGIN;');
    const first = await a.query(clone);
    const cloning = outcome(b.query(clone));
    await blocked('clone/clone same edition');
    await a.query('COMMIT;');
    const second = await cloning;
    if (second.error) throw second.error;
    for (const value of [first, second.value]) assert.match(value, /^[0-9a-f-]{36}$/);
    assert.notEqual(first, second.value);
    assert.equal(await a.query(snapshot), before, 'source and its content/history unchanged');
    const clones = JSON.parse(await a.query(`SELECT json_agg(json_build_object('id',id,'sequence',sequence_number) ORDER BY sequence_number)
      FROM public.simulados WHERE source_simulado_id=${sim(1)};`));
    assert.deepEqual(clones.map(c => c.sequence), [4, 5]);
    await a.query(`DO $$ BEGIN
      ASSERT (SELECT count(*)=2 FROM public.simulados WHERE source_simulado_id=${sim(1)} AND status='draft');
      ASSERT (SELECT count(*)=2 FROM public.questions q JOIN public.simulados s ON s.id=q.simulado_id WHERE s.source_simulado_id=${sim(1)} AND q.id<>${question(1)});
      ASSERT (SELECT count(*)=4 FROM public.question_options o JOIN public.questions q ON q.id=o.question_id JOIN public.simulados s ON s.id=q.simulado_id WHERE s.source_simulado_id=${sim(1)});
    END $$;`);
    evidence.push({ scenario: 'clone/clone', clones, sourceUnchanged: true });

    // Missing B is uncommitted: publisher must wait, then validate the complete structure.
    await a.query(`BEGIN; INSERT INTO public.question_options(question_id,label,text,is_correct) VALUES(${question(2)},'B','No',false);`);
    const publishing = outcome(b.query(`SELECT public.admin_publish_simulado(${sim(2)});`));
    await blocked('insert missing option/publish');
    await a.query('COMMIT;');
    const published = await publishing;
    if (published.error) throw published.error;
    assert.equal(await a.query(`SELECT status||':'||(SELECT count(*) FROM public.question_options WHERE question_id=${question(2)}) FROM public.simulados WHERE id=${sim(2)};`), 'published:2');
    evidence.push({ scenario: 'insert missing option/publish', result: 'published:2 only after insertion commits' });

    // An invalid third option wins the lock: publication must wait and then reject.
    await a.query(`BEGIN; INSERT INTO public.question_options(question_id,label,text,is_correct) VALUES(${question(3)},'C','Extra',false);`);
    const invalidPublishing = outcome(b.query(`SELECT public.admin_publish_simulado(${sim(3)});`));
    await blocked('insert extra option/publish');
    await a.query('COMMIT;');
    const rejected = await invalidPublishing;
    assert.match(rejected.error?.message ?? '', /psql exit 3/);
    assert.match(rejected.error?.message ?? '', /Publicação bloqueada/);
    assert.equal(await a.query(`SELECT status||':'||(SELECT count(*) FROM public.question_options WHERE question_id=${question(3)}) FROM public.simulados WHERE id=${sim(3)};`), 'draft:3');
    assert.equal(await a.query(snapshot), before);
    assert.equal(await a.query("SELECT has_column_privilege('authenticated','public.question_options','is_correct','SELECT');"), 'f');
    evidence.push({ scenario: 'insert extra option/publish', result: 'rejected exit 3; draft:3; answer-key SELECT still revoked' });
  } finally {
    exits.sessions = await Promise.all(connections.map(s => s.close()));
    if (created) {
      exits.drop = checked(t, ['-c', `DROP DATABASE ${t.database};`], true).exit;
      assert.equal(checked(t, ['-c', `SELECT count(*) FROM pg_database WHERE datname='${t.database}';`], true).output, '0');
      evidence.push({ cleanup: 'sandbox dropped; no synthetic rows/database retained' });
    }
  }
  assert.deepEqual(exits.sessions, [0, 3], 'only the deliberate invalid publication may terminate a session with exit 3');
  return { status: 'passed', exits, evidence };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runConcurrency({ database: `enamed_test_admin_concurrency_${Date.now()}_${process.pid}` });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
}
