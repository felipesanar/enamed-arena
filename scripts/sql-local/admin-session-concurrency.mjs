import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PG_BIN, target, connectionArgs, cleanEnvironment } from './harness.mjs';

export function adminSessionTarget(config) {
  const t=target(config);
  if (!/^enamed_test_admin_session_[a-z0-9_]+$/.test(t.database)) throw new Error('Exclusive admin session clone required');
  return t;
}

function session(t,name) {
  const child=spawn(resolve(PG_BIN,'psql.exe'),[...connectionArgs(t),'-qAt','-v','ON_ERROR_STOP=0','-v','VERBOSITY=verbose'],{env:{...cleanEnvironment(),PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
  let pending, out='', err='', seq=0;
  child.stdout.on('data',data=>{
    out+=data;
    if (!pending || !out.includes(pending.marker)) return;
    const p=pending; pending=null; clearTimeout(p.timer);
    p.resolve({out:out.slice(0,out.indexOf(p.marker)).trim(),err});
  });
  child.stderr.on('data',data=>{err+=data;});
  child.on('error',error=>{if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}});
  return {
    name,
    async query(sql,expectedError) {
      assert.equal(pending,undefined,'session already running'); out='';err='';
      const result=await new Promise((resolveQuery,reject)=>{
        const marker=`DONE_${++seq}`;
        pending={marker,resolve:resolveQuery,reject,timer:setTimeout(()=>{child.kill();reject(new Error('bounded SQL timeout'));},12000)};
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
      // Reset to undefined because assertions also guard accidental overlap.
      pending=undefined;
      if(expectedError) assert.match(result.err,expectedError);
      else assert.doesNotMatch(result.err,/ERROR|FATAL|PANIC/);
      return result.out;
    },
    close(){child.stdin.end('ROLLBACK;\n\\q\n');},
  };
}

export async function runAdminSessionConcurrency(config) {
  const t=adminSessionTarget(config), prefix=`as-lock-${process.pid}-${Date.now()}`;
  const a=session(t,`${prefix}-a`), b=session(t,`${prefix}-b`);
  const id=label=>`md5('${prefix}:${label}')::uuid`, sim=id('sim'), student=id('student'), admin=id('admin'), q=id('q'), option=id('option');
  const auth=user=>`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${user}::text,false);`;
  const reset='RESET ROLE;';
  const apply=`SELECT public.admin_update_simulado_window(${sim},now()-interval '2 hours',now()-interval '1 hour',now()+interval '1 day',
   (SELECT public.admin_preview_simulado_window(${sim},now()-interval '2 hours',now()-interval '1 hour',now()+interval '1 day')->>'current_window_hash'),'concurrency QA');`;
  const create=`SELECT (public.create_attempt_guarded(${sim})).id;`;
  const attempt=`(SELECT id FROM public.attempts WHERE simulado_id=${sim} AND user_id=${student} AND attempt_type='online')`;
  async function blocked(observer,waiter) {
    for(let n=0;n<100;n++) {
      const count=await observer.query(`RESET ROLE; SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='${waiter.name}' AND wait_event_type='Lock' AND pg_backend_pid()=ANY(pg_blocking_pids(pid));`);
      if(count==='1') return;
      await new Promise(done=>setTimeout(done,20));
    }
    throw new Error('No real lock wait observed');
  }
  try {
    for(const s of [a,b]) {
      const guard=await s.query("SELECT current_database()||'|'||session_user||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port();");
      assert.equal(guard,`${t.database}|postgres|postgres|127.0.0.1|54737`);
      await s.query("SET statement_timeout='8s'; SET lock_timeout='6s'; SET idle_in_transaction_session_timeout='20s';");
    }
    // The sanitized integrated template exports public objects only. Restore
    // precisely the existing canonical private backup DDL, never bypass it.
    const canonical=readFileSync(new URL('../../supabase/migrations/20260812100000_presencial_schema.sql',import.meta.url),'utf8');
    const backup=canonical.match(/CREATE SCHEMA IF NOT EXISTS backup;\s+CREATE TABLE IF NOT EXISTS backup\.presencial_superseded_answers \([\s\S]*?\n\);/g);
    assert.equal(backup?.length,1,'canonical backup DDL drift');
    await a.query(`${backup[0]} REVOKE ALL ON SCHEMA backup FROM PUBLIC,anon,authenticated; REVOKE ALL ON backup.presencial_superseded_answers FROM PUBLIC,anon,authenticated;`);
    await a.query(`BEGIN; INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(${student},'${prefix}-s@example.invalid','{}'),(${admin},'${prefix}-a@example.invalid','{}');
     INSERT INTO public.user_roles(user_id,role) VALUES(${admin},'admin');
     INSERT INTO public.exam_editions(id,code,year,label,blueprint_id,format)
     SELECT ${id('edition')},n::text,n,'Concurrency QA',(SELECT blueprint_id FROM public.exam_editions WHERE code='2026'),
      '{"questions":1,"options":1,"duration_minutes":60,"scoring":"raw"}'::jsonb
     FROM generate_series(8000,9999) n WHERE NOT EXISTS(SELECT 1 FROM public.exam_editions e WHERE e.code=n::text) LIMIT 1;
     INSERT INTO public.simulados(id,title,slug,sequence_number,status,questions_count,duration_minutes,execution_window_start,execution_window_end,results_release_at,edition_id)
     VALUES(${sim},'Concurrency QA','${prefix}',${900000000+process.pid},'draft',1,60,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 day',${id('edition')});
     INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme) VALUES(${q},${sim},1,'Fixture','Clinica Medica','Fixture');
     INSERT INTO public.question_options(id,question_id,label,text,is_correct) VALUES(${option},${q},'A','Fixture',true);
     SELECT set_config('request.jwt.claim.sub',${admin}::text,false);
     UPDATE public.simulados SET status='published' WHERE id=${sim}; COMMIT;`);
    // A real apply stays uncommitted with the parent locked. New creator must
    // wait at the first SHARE read, then derive BOTH flag and deadline anew.
    await a.query(`${auth(admin)} BEGIN; ${apply}`);
    await b.query(auth(student));
    const creating=b.query(create);
    await blocked(a,b);
    await a.query('COMMIT;');
    const created=await creating;
    assert.match(created,/^[0-9a-f-]{36}$/);
    await a.query(reset);
    assert.equal(await a.query(`SELECT (NOT is_within_window AND effective_deadline>started_at+interval '59 minutes')::text FROM public.attempts WHERE id=${attempt};`),'true');
    // Other direction: creator holds SHARE; apply must fail 55P03, no writes.
    await a.query(`BEGIN; SELECT id FROM public.simulados WHERE id=${sim} FOR SHARE;`);
    await b.query(auth(admin));
    await b.query(apply,/55P03/);
    await a.query('ROLLBACK;');
    // A finalizer/save holds attempt, B holds parent briefly but NOWAIT fails
    // before writes. Then the ACTUAL finalizer finishes; no deadlock.
    await a.query(`${auth(student)} BEGIN; INSERT INTO public.answers(attempt_id,question_id,selected_option_id) VALUES(${attempt},${q},${option});`);
    await b.query(apply,/55P03/);
    await a.query(`${reset} SELECT score_percentage FROM public.finalize_attempt_with_results_for_user(${attempt},${student},true); COMMIT;`);
    assert.equal(await a.query(`SELECT status||':'||score_percentage FROM public.attempts WHERE id=${attempt};`),'submitted:100.00');
    // Concurrent first check-ins cannot change the initial frozen snapshot.
    await a.query(`INSERT INTO public.presencial_sessions(id,simulado_id,code,label,opens_at,closes_at,ranking_rule)
     VALUES(${id('session')},${sim},'qa-${process.pid}-${Date.now()%100000}', 'Fixture',now()-interval '1 hour',now()+interval '1 hour','session_window_v1');`);
    const checkin=`SELECT public.create_or_convert_presencial_attempt_for_session(${sim},${student},${id('session')});`;
    await a.query(`BEGIN; ${checkin}`);
    await b.query(reset);
    const retry=b.query(checkin);
    await blocked(a,b);
    const before=await a.query(`SELECT row_to_json(r)::text FROM admin_session_private.attempt_rules r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id=${sim} AND a.user_id=${student};`);
    await a.query('COMMIT;'); await retry;
    assert.equal(await a.query(`SELECT row_to_json(r)::text FROM admin_session_private.attempt_rules r JOIN public.attempts a ON a.id=r.attempt_id WHERE a.simulado_id=${sim} AND a.user_id=${student};`),before);
    assert.equal(await a.query(`SELECT (previous_score=100 AND answers @> jsonb_build_array(jsonb_build_object('question_id',${q},'selected_option_id',${option})))::text FROM backup.presencial_superseded_answers WHERE simulado_id=${sim} AND user_id=${student};`),'true');
    return {checks:4, database:t.database};
  } finally { a.close();b.close(); }
}
