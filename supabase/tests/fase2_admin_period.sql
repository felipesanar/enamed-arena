\set ON_ERROR_STOP on
-- Only the explicitly named disposable clone may run this fixture.
DO $$ BEGIN
  ASSERT inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737;
  ASSERT (current_database() LIKE 'enamed_test_admin_period_%' OR current_database() ~ '^enamed_test_fixtures_integrated_[a-z0-9_]+$') AND session_user='postgres' AND current_user='postgres';
END $$;

-- Optional fresh-clone test: psql -v fault=1 -f this-file.
-- The deliberately failing migration must roll back intrinsically, without -1.
\if :{?fault}
CREATE TEMP TABLE fault_before AS SELECT p.proname,pg_get_functiondef(p.oid) ddl,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
AND p.proname IN ('admin_score_evolution','admin_segment_breakdown','admin_cohort_retention','admin_intel_insights','admin_score_distribution','admin_performance_by_area','admin_performance_by_theme');
DO $$ BEGIN ASSERT to_regnamespace('admin_period_private') IS NULL; END $$;
SET test.admin_period_fail_after='admin_performance_by_area';
\set ON_ERROR_STOP off
\ir ../migrations/20261104115402_fase2_admin_period.sql
\set ON_ERROR_STOP on
RESET test.admin_period_fail_after;
DO $$ BEGIN
  ASSERT to_regnamespace('admin_period_private') IS NULL,'partial checkpoint/schema survived';
  ASSERT (SELECT count(*)=7 FROM fault_before b JOIN pg_proc p ON p.proname=b.proname
    JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
    WHERE pg_get_functiondef(p.oid)=b.ddl AND p.proacl=b.proacl),'partial signature/definition/ACL survived';
END $$;
\echo 'PASS: injected migration failure rolled back all seven definitions/ACLs and private schema'
\ir ../migrations/20261104115402_fase2_admin_period.sql
\endif

-- Optional installed-clone recovery/reapply test, before disposable data below.
\if :{?lifecycle}
CREATE TEMP TABLE checkpoint_before AS SELECT * FROM admin_period_private.checkpoints;
CREATE TEMP TABLE installed_before AS SELECT p.oid,p.proname,pg_get_functiondef(p.oid) ddl,p.proacl
FROM pg_proc p WHERE p.oid IN (SELECT to_regprocedure(expanded_identity) FROM checkpoint_before);
CREATE TEMP TABLE business_before AS SELECT
 (SELECT count(*) FROM public.attempts) attempts,(SELECT count(*) FROM public.profiles) profiles,
 (SELECT count(*) FROM public.user_performance_history) history;
DO $$ DECLARE ddl text; BEGIN
  SELECT i.ddl INTO ddl FROM installed_before i JOIN pg_proc p ON p.oid=i.oid WHERE p.proname='admin_score_evolution';
  EXECUTE replace(ddl,E'begin\n',E'begin\n  -- future migration marker\n');
END $$;
\ir ../migrations/20261104115402_fase2_admin_period.sql
DO $$ DECLARE ddl text; BEGIN
  ASSERT NOT EXISTS ((SELECT to_jsonb(c) FROM checkpoint_before c) EXCEPT (SELECT to_jsonb(c) FROM admin_period_private.checkpoints c));
  ASSERT NOT EXISTS ((SELECT to_jsonb(c) FROM admin_period_private.checkpoints c) EXCEPT (SELECT to_jsonb(c) FROM checkpoint_before c));
  ASSERT position('future migration marker' IN pg_get_functiondef('public.admin_score_evolution(uuid,timestamptz,timestamptz)'::regprocedure))>0,
    'reapply overwrote future changes';
  BEGIN
    CALL admin_period_private.rollback_admin_period();
    RAISE EXCEPTION 'rollback overwrote future migration';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'later definition or missing function:%' THEN RAISE; END IF;
  END;
  SELECT i.ddl INTO ddl FROM installed_before i JOIN pg_proc p ON p.oid=i.oid WHERE p.proname='admin_score_evolution';
  EXECUTE ddl;
END $$;
BEGIN;
CALL admin_period_private.rollback_admin_period();
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT * FROM checkpoint_before LOOP
    ASSERT pg_get_functiondef(to_regprocedure(c.original_identity))=c.original_definition;
    ASSERT (SELECT pg_get_userbyid(proowner)=c.original_owner FROM pg_proc WHERE oid=to_regprocedure(c.original_identity));
    ASSERT (SELECT proacl FROM pg_proc WHERE oid=to_regprocedure(c.original_identity))=
      (SELECT i.proacl FROM installed_before i WHERE i.proname=c.name);
  END LOOP;
  ASSERT NOT EXISTS (SELECT FROM admin_period_private.checkpoints WHERE active);
  ASSERT (SELECT (SELECT count(*) FROM public.attempts)=attempts AND (SELECT count(*) FROM public.profiles)=profiles
    AND (SELECT count(*) FROM public.user_performance_history)=history FROM business_before);
  ASSERT NOT EXISTS (SELECT FROM checkpoint_before cp WHERE has_function_privilege('anon',to_regprocedure(cp.original_identity),'EXECUTE'));
END $$;
ROLLBACK;
\echo 'PASS: reapply preserved future definition/checkpoints; recovery restored seven originals without data loss'
\endif

BEGIN;
DO $$ BEGIN
  ASSERT inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737;
  ASSERT (current_database() LIKE 'enamed_test_admin_period_%' OR current_database() ~ '^enamed_test_fixtures_integrated_[a-z0-9_]+$') AND session_user='postgres' AND current_user='postgres';
  ASSERT to_regprocedure('public.admin_score_evolution(uuid,timestamptz,timestamptz)') IS NOT NULL,
    'RED: expanded admin period signature missing';
END $$;

CREATE TEMP TABLE fixture_users AS
SELECT i, ('fd860000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid AS id
FROM generate_series(1,10) i;
INSERT INTO auth.users(id,email) SELECT id,'period-'||i||'@example.invalid' FROM fixture_users;
UPDATE public.profiles SET created_at='2097-02-01 01:00Z',segment='guest'
WHERE id IN (SELECT id FROM fixture_users);
INSERT INTO public.user_roles(user_id,role)
SELECT id,CASE i WHEN 8 THEN 'analyst' WHEN 9 THEN 'content_editor' ELSE 'admin' END::public.app_role
FROM fixture_users WHERE i>=8;
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
('fd860001-0000-0000-0000-000000000001','2098.1',2098,1,'Period One','preparing'),
('fd860001-0000-0000-0000-000000000002','2098.2',2098,2,'Period Two','preparing');
INSERT INTO public.onboarding_profiles(user_id,target_edition_id,status)
SELECT id,'fd860001-0000-0000-0000-000000000001','completed' FROM fixture_users WHERE i<=5;
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,status,duration_minutes,questions_count,
 execution_window_start,execution_window_end,results_release_at)
SELECT ('fd860002-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Period '||i,'period-fd86-'||i,
 CASE WHEN i<=2 THEN i ELSE i-2 END,
 CASE WHEN i<=2 THEN 'fd860001-0000-0000-0000-000000000001' ELSE 'fd860001-0000-0000-0000-000000000002' END::uuid,
 'draft',30,1,'2098-01-01Z','2098-02-01Z','2098-02-02Z' FROM generate_series(1,4) i;
CREATE TEMP TABLE fixture_attempts(i int,u int,s int,st text,ts timestamptz,valid boolean,score numeric);
INSERT INTO fixture_attempts VALUES
(1,1,1,'submitted','2098-01-01Z',true,80),
(2,2,1,'submitted','2097-12-31 23:59:59Z',true,100),
(3,1,2,'submitted','2098-01-15Z',true,60),
(4,2,2,'submitted','2098-02-01Z',true,0),
(5,3,1,'submitted','2098-01-15Z',false,90),
(6,4,1,'offline_pending','2098-01-15Z',true,NULL),
(7,6,1,'in_progress','2098-01-01Z',true,NULL),
(8,1,3,'submitted','2098-01-15Z',true,5),
(9,2,3,'submitted','2098-01-15Z',true,5),
(10,1,4,'submitted','2098-01-15Z',true,5);
INSERT INTO public.attempts(id,user_id,simulado_id,status,started_at,created_at,effective_deadline,is_within_window,score_percentage)
SELECT ('fd860003-0000-0000-0000-'||lpad(f.i::text,12,'0'))::uuid,u.id,s.id,f.st::public.attempt_status,
 f.ts,f.ts,'2098-03-01Z',f.valid,f.score
FROM fixture_attempts f JOIN fixture_users u ON u.i=f.u
JOIN public.simulados s ON s.slug='period-fd86-'||f.s;
UPDATE public.attempts SET tab_exit_count=4 WHERE simulado_id IN
  (SELECT id FROM public.simulados WHERE slug IN ('period-fd86-3','period-fd86-4'));
INSERT INTO public.user_performance_history(user_id,attempt_id,simulado_id,score_percentage,total_correct,total_answered,total_questions,finished_at)
SELECT a.user_id,a.id,a.simulado_id,a.score_percentage,1,1,1,a.started_at
FROM public.attempts a JOIN fixture_attempts f ON a.id=('fd860003-0000-0000-0000-'||lpad(f.i::text,12,'0'))::uuid
WHERE f.st='submitted';
INSERT INTO public.questions(simulado_id,question_number,text,area,theme)
SELECT id,1,'Fixture question','Fixture area','Fixture theme' FROM public.simulados WHERE slug LIKE 'period-fd86-%';
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered)
SELECT a.id,q.id,a.score_percentage>=80,true FROM public.attempts a
JOIN public.questions q ON q.simulado_id=a.simulado_id
WHERE a.id IN (SELECT ('fd860003-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM fixture_attempts WHERE st='submitted');
-- Defensive boundary: even an inconsistent AQR must not cross editions.
INSERT INTO public.attempt_question_results(attempt_id,question_id,is_correct,was_answered)
SELECT 'fd860003-0000-0000-0000-000000000001',q.id,true,true
FROM public.questions q JOIN public.simulados s ON s.id=q.simulado_id WHERE s.slug='period-fd86-3';

SELECT set_config('request.jwt.claims','{"sub":"fd860000-0000-0000-0000-000000000008","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE e uuid:='fd860001-0000-0000-0000-000000000001'; b timestamptz:='2098-01-01Z'; z timestamptz:='2098-02-01Z'; r record; n int:=0; BEGIN
  SELECT * INTO r FROM public.admin_segment_breakdown(e,b,z) WHERE segment='guest';
  ASSERT r.users=6 AND r.participants=3 AND r.concluded_participants=1 AND r.pending_participants=1;
  ASSERT r.avg_score=70 AND r.avg_attempts=0.3 AND r.participation_rate=50;
  SELECT * INTO r FROM public.admin_cohort_retention(1,e,b,z);
  ASSERT r.cohort_month='2097-01-01'::date AND r.cohort_size=6 AND r.did_onboarding=5;
  ASSERT r.did_1_plus=1 AND r.did_2_plus=1 AND r.did_3_plus=0 AND r.started_any=4 AND r.did_offline_pending=1 AND r.avg_score=70;
  ASSERT (SELECT count(*)=2 AND sum(participants)=2 AND min(edition_code)='2098.1'
    AND bool_and(edition_id=e AND edition_label='Period One') FROM public.admin_score_evolution(e,b,z));
  ASSERT (SELECT count(*)=4 FROM public.admin_score_evolution(NULL,b,z));
  ASSERT (SELECT sum(count)=2 FROM public.admin_score_distribution(NULL,e,b,z));
  ASSERT (SELECT sum(count)=3 FROM public.admin_score_distribution(NULL,e,b,NULL));
  ASSERT (SELECT sum(count)=3 FROM public.admin_score_distribution(NULL,e,NULL,z));
  ASSERT (SELECT sum(count)=0 FROM public.admin_score_distribution('fd860002-0000-0000-0000-000000000003',e,b,z));
  SELECT * INTO r FROM public.admin_performance_by_area(NULL,'guest',e,b,z);
  ASSERT r.total_responses=2 AND r.correct_responses=1 AND r.correct_rate=50 AND r.n_users=1 AND r.n_questions=2;
  ASSERT NOT EXISTS (SELECT FROM public.admin_performance_by_area('fd860002-0000-0000-0000-000000000003','all',e,b,z));
  SELECT * INTO r FROM public.admin_performance_by_theme(NULL,'Fixture area',12,e,b,z);
  ASSERT r.total_responses=2 AND r.correct_rate=50;
  ASSERT NOT EXISTS (SELECT FROM public.admin_performance_by_theme(NULL,'Other',12,e,b,z));
  ASSERT NOT EXISTS (SELECT FROM public.admin_performance_by_theme(NULL,NULL,0,e,b,z));
  ASSERT NOT EXISTS (SELECT FROM public.admin_performance_by_theme('fd860002-0000-0000-0000-000000000003',NULL,12,e,b,z));
  ASSERT EXISTS (SELECT FROM public.admin_intel_insights(e,b,z) WHERE id='score_decline' AND metric_value=-25);
  ASSERT NOT EXISTS (SELECT FROM public.admin_intel_insights(e,b,z) WHERE id='integrity_spike');
  ASSERT NOT EXISTS (SELECT FROM public.admin_intel_insights(NULL,b,z) WHERE id IN ('score_decline','participation_drop'));
  -- Reverse the edition to catch leakage from every pending/started/score CTE.
  e:='fd860001-0000-0000-0000-000000000002';
  SELECT * INTO r FROM public.admin_segment_breakdown(e,b,z) WHERE segment='guest';
  ASSERT r.users=2 AND r.participants=2 AND r.concluded_participants=2 AND r.pending_participants=0 AND r.avg_score=5 AND r.avg_attempts=1.5;
  SELECT * INTO r FROM public.admin_cohort_retention(1,e,b,z);
  ASSERT r.cohort_size=2 AND r.did_1_plus=2 AND r.did_2_plus=1 AND r.started_any=2 AND r.did_offline_pending=0 AND r.avg_score=5;
  ASSERT (SELECT sum(count)=3 FROM public.admin_score_distribution(NULL,e,b,z));
  SELECT * INTO r FROM public.admin_performance_by_area(NULL,'guest',e,b,z);
  ASSERT r.total_responses=3 AND r.correct_responses=0 AND r.n_users=2;
  SELECT * INTO r FROM public.admin_performance_by_theme(NULL,NULL,12,e,b,z);
  ASSERT r.total_responses=3 AND r.correct_rate=0;
  ASSERT EXISTS (SELECT FROM public.admin_intel_insights(e,b,z) WHERE id='integrity_spike' AND metric_value=100);
  ASSERT NOT EXISTS (SELECT FROM public.admin_intel_insights(e,b,z) WHERE id='high_abandonment');
  FOR r IN SELECT proname FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND proname IN ('admin_score_evolution','admin_segment_breakdown','admin_cohort_retention','admin_intel_insights','admin_score_distribution','admin_performance_by_area','admin_performance_by_theme') LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I(p_start_at => $1, p_end_at => $2)',r.proname) USING z,b;
      RAISE EXCEPTION 'invalid period accepted by %',r.proname;
    EXCEPTION WHEN invalid_parameter_value THEN n:=n+1; END;
    BEGIN
      EXECUTE format('SELECT * FROM public.%I(p_start_at => $1, p_end_at => $2)',r.proname) USING b,b;
      RAISE EXCEPTION 'empty period accepted by %',r.proname;
    EXCEPTION WHEN invalid_parameter_value THEN n:=n+1; END;
  END LOOP;
  ASSERT n=14;
  BEGIN PERFORM * FROM admin_period_private.checkpoints; RAISE EXCEPTION 'checkpoint read bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN CALL admin_period_private.rollback_admin_period(); RAISE EXCEPTION 'recovery bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- Golden comparison against checkpointed real legacy definitions, with a single
-- edition containing nonzero data. SAVEPOINT restores the multi-edition fixture.
SAVEPOINT legacy_single_edition;
DELETE FROM public.attempt_question_results WHERE attempt_id IN
  (SELECT id FROM public.attempts WHERE simulado_id IN (SELECT id FROM public.simulados WHERE slug IN ('period-fd86-3','period-fd86-4')));
DELETE FROM public.user_performance_history WHERE simulado_id IN
  (SELECT id FROM public.simulados WHERE slug IN ('period-fd86-3','period-fd86-4'));
DELETE FROM public.attempts WHERE simulado_id IN
  (SELECT id FROM public.simulados WHERE slug IN ('period-fd86-3','period-fd86-4'));
UPDATE public.profiles SET created_at=now()-interval '40 days' WHERE id IN (SELECT id FROM fixture_users);
SET LOCAL timezone='America/Sao_Paulo';
DO $$ DECLARE c record; old_rows jsonb; new_rows jsonb; projection text; BEGIN
  FOR c IN SELECT * FROM admin_period_private.checkpoints ORDER BY name LOOP
    EXECUTE replace(c.original_definition,'FUNCTION public.'||c.name||'(','FUNCTION pg_temp.'||c.name||'(');
    EXECUTE format('SELECT coalesce(jsonb_agg(v ORDER BY v::text),''[]'') FROM (SELECT to_jsonb(x) v FROM pg_temp.%I() x) q',c.name) INTO old_rows;
    projection:=CASE WHEN c.name='admin_score_evolution' THEN 'to_jsonb(x)-''edition_id''-''edition_code''-''edition_label''' ELSE 'to_jsonb(x)' END;
    EXECUTE format('SELECT coalesce(jsonb_agg(v ORDER BY v::text),''[]'') FROM (SELECT %s v FROM public.%I() x) q',projection,c.name) INTO new_rows;
    ASSERT old_rows=new_rows,format('legacy result drift in %s: old=%s new=%s',c.name,old_rows,new_rows);
    ASSERT jsonb_array_length(new_rows)>0,format('zero-data legacy comparison: %s',c.name);
  END LOOP;
END $$;
ROLLBACK TO legacy_single_edition;

-- Missing authentication and content-only roles must fail all seven RPCs.
SET LOCAL ROLE authenticated;
DO $$ DECLARE claims text; r record; n int:=0; BEGIN
  FOREACH claims IN ARRAY ARRAY['{}','{"sub":"fd860000-0000-0000-0000-000000000009","role":"authenticated"}'] LOOP
    PERFORM set_config('request.jwt.claims',claims,true);
    FOR r IN SELECT proname FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
      WHERE s.nspname='public' AND proname IN ('admin_score_evolution','admin_segment_breakdown','admin_cohort_retention','admin_intel_insights','admin_score_distribution','admin_performance_by_area','admin_performance_by_theme') LOOP
      BEGIN EXECUTE format('SELECT * FROM public.%I()',r.proname); RAISE EXCEPTION 'unauthorized %',r.proname;
      EXCEPTION WHEN SQLSTATE 'P0003' THEN n:=n+1; END;
    END LOOP;
  END LOOP;
  ASSERT n=14;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ DECLARE r record; n int:=0; BEGIN
  FOR r IN SELECT p.proname FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND proname IN ('admin_score_evolution','admin_segment_breakdown','admin_cohort_retention','admin_intel_insights','admin_score_distribution','admin_performance_by_area','admin_performance_by_theme') LOOP
    BEGIN EXECUTE format('SELECT * FROM public.%I()',r.proname); RAISE EXCEPTION 'anon %',r.proname;
    EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
  END LOOP;
  ASSERT n=7;
END $$;
RESET ROLE;
DO $$ DECLARE r record; n int:=0; BEGIN
  FOR r IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND proname IN ('admin_score_evolution','admin_segment_breakdown','admin_cohort_retention','admin_intel_insights','admin_score_distribution','admin_performance_by_area','admin_performance_by_theme') LOOP
    ASSERT NOT has_function_privilege('anon',r.oid,'EXECUTE');
    ASSERT has_function_privilege('authenticated',r.oid,'EXECUTE');
    ASSERT has_function_privilege('service_role',r.oid,'EXECUTE');
    n:=n+1;
  END LOOP;
  ASSERT n=7,'ambiguous overloads';
  ASSERT NOT has_schema_privilege('authenticated','admin_period_private','USAGE');
  ASSERT NOT has_table_privilege('authenticated','admin_period_private.checkpoints','SELECT');
  ASSERT (SELECT relrowsecurity AND relforcerowsecurity AND relowner='postgres'::regrole
    FROM pg_class WHERE oid='admin_period_private.checkpoints'::regclass);
END $$;

-- Recovery with NONZERO business data: compare complete fixture rows, not only counts.
SAVEPOINT recovery_with_data;
CREATE TEMP TABLE recovery_rows AS
SELECT 'attempts' t,jsonb_agg(to_jsonb(a) ORDER BY a.id) j FROM public.attempts a WHERE a.user_id IN (SELECT id FROM fixture_users)
UNION ALL SELECT 'profiles',jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.profiles p WHERE p.id IN (SELECT id FROM fixture_users)
UNION ALL SELECT 'history',jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.user_performance_history h WHERE h.user_id IN (SELECT id FROM fixture_users);
CALL admin_period_private.rollback_admin_period();
DO $$ BEGIN
  ASSERT (SELECT j FROM recovery_rows WHERE t='attempts')=(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attempts a WHERE a.user_id IN (SELECT id FROM fixture_users));
  ASSERT (SELECT j FROM recovery_rows WHERE t='profiles')=(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.profiles p WHERE p.id IN (SELECT id FROM fixture_users));
  ASSERT (SELECT j FROM recovery_rows WHERE t='history')=(SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.user_performance_history h WHERE h.user_id IN (SELECT id FROM fixture_users));
  ASSERT NOT EXISTS (SELECT FROM admin_period_private.checkpoints WHERE active);
END $$;
ROLLBACK TO recovery_with_data;
ROLLBACK;
\echo 'PASS: admin period fixture; all assertions completed; fixture data rolled back'
