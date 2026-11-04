-- Run only on the dedicated disposable clone; all fixtures roll back.
\set ON_ERROR_STOP on
SELECT 1 / ((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
 AND current_database() LIKE 'enamed_test_notebook_%' AND session_user='postgres')::int);
BEGIN;
DO $$ BEGIN
 ASSERT to_regprocedure('public.list_error_notebook_page(uuid,integer,integer)') IS NOT NULL,
   'RED: notebook page RPC missing';
 ASSERT to_regprocedure('public.get_error_notebook_counts(uuid)') IS NOT NULL;
END $$;
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
INSERT INTO auth.users(id,email) SELECT
 ('f2700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'notebook-'||n||'@example.invalid' FROM generate_series(1,2) n;
UPDATE public.profiles SET segment='pro' WHERE id::text LIKE 'f2700000-%';
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f2700000-0000-0000-0000-000000000011','2197.1',2197,1,'Notebook A','closed'),
 ('f2700000-0000-0000-0000-000000000012','2197.2',2197,2,'Notebook B','active');
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at,status)
 SELECT ('f2710000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'Notebook '||n,'notebook-fixture-'||n,n,
 CASE WHEN n=2 THEN 'f2700000-0000-0000-0000-000000000012'::uuid
 ELSE 'f2700000-0000-0000-0000-000000000011'::uuid END,
 now()-interval '10 days',now()-interval '9 days',
 CASE WHEN n=3 THEN now()+interval '1 day' ELSE now()-interval '8 days' END,
 (CASE WHEN n=4 THEN 'draft' ELSE 'published' END)::public.simulado_status FROM generate_series(1,5) n;
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
 SELECT ('f2720000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2710000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,1,
 'Synthetic question '||n,'Exam','Theme' FROM generate_series(1,5) n;
INSERT INTO public.question_options(question_id,label,text,is_correct)
 SELECT id,'A','SECRET CORRECT OPTION',true FROM public.questions
 WHERE id::text LIKE 'f2720000-%';
INSERT INTO public.attempts(user_id,simulado_id,status,attempt_type,
 effective_deadline,finished_at,is_within_window)
 SELECT 'f2700000-0000-0000-0000-000000000001',id,'submitted','offline',
 now(),now()-interval '9 days',id<>'f2710000-0000-0000-0000-000000000002'::uuid
 FROM public.simulados WHERE id::text LIKE 'f2710000-%' AND sequence_number<=4;
-- Exactly 1500 visible REAL rows: A=700, B=700 (training), manual=100.
-- Equal created_at forces deterministic UUID tie breaking across all 30 pages.
INSERT INTO public.error_notebook(id,user_id,simulado_id,question_id,area,theme,
 reason,question_text,created_at,mastered_at,resolved_at,srs_due_at,next_review_at)
 SELECT ('f2730000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'f2700000-0000-0000-0000-000000000001',
 CASE WHEN n<=1400 THEN ('f2710000-0000-0000-0000-'||lpad((CASE WHEN n<=700 THEN 1 ELSE 2 END)::text,12,'0'))::uuid END,
 CASE WHEN n<=1400 THEN ('f2720000-0000-0000-0000-'||lpad((CASE WHEN n<=700 THEN 1 ELSE 2 END)::text,12,'0'))::uuid END,
 CASE WHEN n<=1400 THEN 'Exam' ELSE 'Manual' END,'Theme','confused_alternatives',
 'Synthetic notebook '||n,now()-interval '7 days',
 CASE WHEN n<=10 THEN now() END,
 CASE WHEN n BETWEEN 11 AND 20 THEN now() END,
 CASE WHEN n<=100 OR (n>200 AND n<1499) THEN now()-interval '1 day' END,
 CASE WHEN n=1500 THEN NULL WHEN n=1499 THEN now()-interval '1 day'
 ELSE now()+interval '2 days' END
 FROM generate_series(1,1500) n;
-- Excluded: unreleased, draft, no finished attempt, mismatch, deleted, other owner.
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,reason,question_text,ai_option_rationales,deleted_at)
 SELECT 'f2700000-0000-0000-0000-000000000001',s.id,q.id,'Hidden',
 'confused_alternatives','SECRET CORRECT OPTION','{"answer":"SECRET"}',null
 FROM public.simulados s JOIN public.questions q ON q.simulado_id=s.id
 WHERE s.id::text LIKE 'f2710000-%' AND s.sequence_number>=3;
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,reason) VALUES
 ('f2700000-0000-0000-0000-000000000001','f2710000-0000-0000-0000-000000000001','f2720000-0000-0000-0000-000000000002','Mismatch','confused_alternatives');
INSERT INTO public.error_notebook(user_id,reason,deleted_at) VALUES
 ('f2700000-0000-0000-0000-000000000001','confused_alternatives',now());
INSERT INTO public.error_notebook(user_id,reason) VALUES
 ('f2700000-0000-0000-0000-000000000002','confused_alternatives');
CREATE TEMP TABLE notebook_before AS SELECT id,to_jsonb(n) AS row FROM public.error_notebook n;
SELECT set_config('request.jwt.claims','{"sub":"f2700000-0000-0000-0000-000000000001","role":"authenticated","segment":"pro"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE j jsonb; c jsonb; page jsonb; ids uuid[]:='{}'; e uuid; n integer; item jsonb;
BEGIN
 j:=public.list_error_notebook_page(); c:=public.get_error_notebook_counts();
 ASSERT (j->>'total')::int=1500 AND jsonb_array_length(j->'items')=50;
 ASSERT j->>'limit'='50' AND j->>'offset'='0';
 ASSERT c->>'total'='1500' AND c->>'mastered'='10' AND c->>'due'='1380', 'SRS precedence / resolved is not mastery';
 ASSERT (SELECT sum((a->>'total')::int) FROM jsonb_array_elements(c->'by_area') a)=1500;
 ASSERT c->'by_area' @> '[{"area":"Manual","total":100}]'::jsonb;
 ASSERT j#>'{items,0,edition_id}'='null'::jsonb;
 ASSERT j#>'{items,0,edition_code}'='null'::jsonb;
 ASSERT j#>'{items,0,edition_label}'='null'::jsonb;
 ASSERT j::text NOT LIKE '%SECRET%', 'no correction or cached rationale before release';
 FOR n IN 0..29 LOOP
   page:=public.list_error_notebook_page(null,50,n*50);
   ASSERT page->>'total'='1500' AND jsonb_array_length(page->'items')=50;
   FOR item IN SELECT value FROM jsonb_array_elements(page->'items') LOOP
     ASSERT NOT (item->>'id')::uuid=ANY(ids),'duplicate across pages';
     ids:=array_append(ids,(item->>'id')::uuid);
   END LOOP;
 END LOOP;
 ASSERT cardinality(ids)=1500;
 ASSERT ids[1]='f2730000-0000-0000-0000-000000001500'::uuid;
 ASSERT ids[1500]='f2730000-0000-0000-0000-000000000001'::uuid;
 ASSERT jsonb_array_length(public.list_error_notebook_page(null,50,1499)->'items')=1;
 ASSERT jsonb_array_length(public.list_error_notebook_page(null,50,1500)->'items')=0;
 ASSERT public.list_error_notebook_page(null,50,999999)->>'total'='1500';
 ASSERT jsonb_array_length(public.list_error_notebook_page(null,50,999999)->'items')=0;
 FOR n IN 11..12 LOOP
   e:=('f2700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
   j:=public.list_error_notebook_page(e); c:=public.get_error_notebook_counts(e);
   ASSERT j->>'total'='700' AND c->>'total'='700';
   ASSERT (SELECT sum((a->>'total')::int) FROM jsonb_array_elements(c->'by_area') a)=700;
   ASSERT NOT EXISTS(SELECT FROM jsonb_array_elements(j->'items') a WHERE a->>'edition_id'<>e::text OR a->>'edition_id' IS NULL);
   ASSERT j#>>'{items,0,edition_code}'=CASE WHEN n=11 THEN '2197.1' ELSE '2197.2' END;
   ASSERT j#>>'{items,0,edition_label}'=CASE WHEN n=11 THEN 'Notebook A' ELSE 'Notebook B' END;
 END LOOP;
 e:='f2700000-0000-0000-0000-000000000099';
 ASSERT public.list_error_notebook_page(e)->>'total'='0';
 ASSERT public.get_error_notebook_counts(e)='{"total":0,"mastered":0,"due":0,"by_area":[]}'::jsonb;
 ASSERT public.list_error_notebook_page(null,1,0)->>'limit'='1';
 ASSERT jsonb_array_length(public.list_error_notebook_page(null,100,0)->'items')=100;
 FOR n IN 1..5 LOOP
   BEGIN
     PERFORM public.list_error_notebook_page(null,CASE n WHEN 1 THEN 0 WHEN 2 THEN 101 WHEN 3 THEN NULL ELSE 50 END,
       CASE n WHEN 4 THEN -1 WHEN 5 THEN NULL ELSE 0 END);
     RAISE EXCEPTION 'invalid pagination accepted';
   EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN PERFORM public.notebook_page_scope(null); RAISE EXCEPTION 'helper exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- F0 question visibility depends on the caller-visible simulado. A finished
-- synthetic attempt must not let SECURITY DEFINER bypass test-only visibility.
SAVEPOINT test_visibility;
UPDATE public.simulados SET status='test'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.has_capability('content.manage') IS FALSE;
 ASSERT NOT EXISTS(SELECT FROM public.simulados WHERE id='f2710000-0000-0000-0000-000000000001'),
   'actual simulado RLS must hide test from a normal PRO';
 ASSERT NOT EXISTS(SELECT FROM public.questions WHERE id='f2720000-0000-0000-0000-000000000001'),
   'actual F0 question RLS must hide test from a normal PRO';
 ASSERT public.list_error_notebook_page()->>'total'='800', 'RED: normal PRO must not read test notebook';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
 ASSERT public.get_error_notebook_counts()->'by_area' @> '[{"area":"Manual","total":100}]'::jsonb;
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')->>'total'='0';
 ASSERT public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011')->>'total'='0';
 ASSERT NOT EXISTS(SELECT FROM jsonb_array_elements(public.list_error_notebook_page(null,100,100)->'items') n
   WHERE n->>'simulado_id'='f2710000-0000-0000-0000-000000000001');
END $$;
RESET ROLE;
-- Use an existing real role-to-capability mapping, not JWT metadata/admin flags.
INSERT INTO public.user_roles(user_id,role) VALUES
 ('f2700000-0000-0000-0000-000000000001','content_editor');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.has_capability('content.manage') IS TRUE;
 ASSERT EXISTS(SELECT FROM public.simulados WHERE id='f2710000-0000-0000-0000-000000000001');
 ASSERT EXISTS(SELECT FROM public.questions WHERE id='f2720000-0000-0000-0000-000000000001');
 ASSERT public.list_error_notebook_page()->>'total'='1500';
 ASSERT public.get_error_notebook_counts()->>'total'='1500';
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')->>'total'='700';
 ASSERT public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011')->>'total'='700';
END $$;
RESET ROLE;
SAVEPOINT privileged_release;
UPDATE public.simulados SET results_release_at=now()+interval '1 day'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='800','content capability cannot bypass release';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT privileged_release;
SAVEPOINT privileged_draft;
UPDATE public.simulados SET status='draft'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='800','draft excluded even with content capability';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT privileged_draft;
UPDATE public.profiles SET segment='standard' WHERE id='f2700000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'capability promoted non-PRO';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'capability promoted non-PRO counts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT test_visibility;
-- Explicit ordinary-user draft negative, independent of the hidden controls.
SAVEPOINT draft_visibility;
UPDATE public.simulados SET status='draft'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM public.simulados WHERE id='f2710000-0000-0000-0000-000000000001');
 ASSERT public.list_error_notebook_page()->>'total'='800';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')->>'total'='0';
 ASSERT public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011')->>'total'='0';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT draft_visibility;
SAVEPOINT archived_history;
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE notebook_published_snapshot AS SELECT
 public.list_error_notebook_page() AS page,
 public.get_error_notebook_counts() AS counts,
 public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011') AS edition_page,
 public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011') AS edition_counts;
RESET ROLE;
UPDATE public.simulados SET status='archived'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.has_capability('content.manage') IS FALSE;
 ASSERT EXISTS(SELECT FROM public.simulados WHERE id='f2710000-0000-0000-0000-000000000001'),
   'actual F1 archived owner visibility';
 ASSERT NOT EXISTS(SELECT FROM public.questions WHERE id='f2720000-0000-0000-0000-000000000001'),
   'F1 did not broaden F0 question browsing for archived exams';
 ASSERT public.list_error_notebook_page()=(SELECT page FROM notebook_published_snapshot),
   'RED: archiving must preserve cumulative notebook page';
 ASSERT public.get_error_notebook_counts()=(SELECT counts FROM notebook_published_snapshot),
   'archiving must preserve full cumulative counts including manual';
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')=
   (SELECT edition_page FROM notebook_published_snapshot),'same archived entries/edition metadata';
 ASSERT public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011')=
   (SELECT edition_counts FROM notebook_published_snapshot);
 ASSERT public.get_error_notebook_counts()->>'total'='1500';
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')->>'total'='700';
END $$;
RESET ROLE;
UPDATE public.simulados SET results_release_at=now()+interval '1 day'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='800','archived still needs release';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT archived_history;
-- PG release, not the browser clock; hidden cached correction only appears
-- after release. Reverting this savepoint leaves the original fixtures intact.
SAVEPOINT release_gate;
UPDATE public.simulados SET results_release_at=now()-interval '1 day'
 WHERE id='f2710000-0000-0000-0000-000000000003';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='1501';
 ASSERT public.get_error_notebook_counts()->>'total'='1501';
 ASSERT public.list_error_notebook_page()::text LIKE '%SECRET CORRECT OPTION%';
 ASSERT public.list_error_notebook_page('f2700000-0000-0000-0000-000000000011')->>'total'='701';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT release_gate;
SAVEPOINT future_start;
UPDATE public.simulados SET execution_window_start=now()+interval '1 day',
 execution_window_end=now()+interval '2 days',results_release_at=now()+interval '3 days'
 WHERE id='f2710000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='800';
 ASSERT public.get_error_notebook_counts()->>'total'='800';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT future_start;
-- Question-only linkage resolves real edition; simulado-only linkage also works.
SAVEPOINT linkage;
UPDATE public.error_notebook SET simulado_id=NULL WHERE id='f2730000-0000-0000-0000-000000000001';
UPDATE public.error_notebook SET question_id=NULL WHERE id='f2730000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.get_error_notebook_counts('f2700000-0000-0000-0000-000000000011')->>'total'='700';
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT linkage;
-- Live profile, not JWT metadata; even a PRO/admin-looking claim cannot override it.
DO $$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['standard','guest'] LOOP
   UPDATE public.profiles SET segment=s::public.user_segment WHERE id='f2700000-0000-0000-0000-000000000001';
   SET LOCAL ROLE authenticated;
   BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'non-PRO list';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'non-PRO counts';
   EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   RESET ROLE;
 END LOOP;
END $$;
UPDATE public.profiles SET segment='pro' WHERE id='f2700000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='1500','restored live PRO access';
 ASSERT public.get_error_notebook_counts()->>'total'='1500';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2700000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT public.list_error_notebook_page()->>'total'='1','owner isolation';
 ASSERT public.get_error_notebook_counts()->>'total'='1';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'NULL uid';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'NULL uid counts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','service_role'] LOOP
   ASSERT NOT has_function_privilege(r,'public.list_error_notebook_page(uuid,integer,integer)','EXECUTE');
   ASSERT NOT has_function_privilege(r,'public.get_error_notebook_counts(uuid)','EXECUTE');
   ASSERT NOT has_function_privilege(r,'public.notebook_page_scope(uuid)','EXECUTE');
 END LOOP;
 ASSERT NOT has_function_privilege('authenticated','public.notebook_page_scope(uuid)','EXECUTE');
 ASSERT NOT EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
   WHERE p.oid IN ('public.notebook_page_scope(uuid)'::regprocedure,
     'public.list_error_notebook_page(uuid,integer,integer)'::regprocedure,
     'public.get_error_notebook_counts(uuid)'::regprocedure) AND a.grantee=0 AND a.privilege_type='EXECUTE');
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'anon';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'anon counts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f2700000-0000-0000-0000-000000000001","role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'service impersonation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'service counts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Defense in depth: even an accidental future service grant cannot turn a
-- service JWT with a student's sub into a PRO read. Roll back these grants.
SAVEPOINT service_grant;
GRANT EXECUTE ON FUNCTION public.list_error_notebook_page(uuid,integer,integer),
 public.get_error_notebook_counts(uuid) TO service_role;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.list_error_notebook_page(); RAISE EXCEPTION 'service bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_counts(); RAISE EXCEPTION 'service counts bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT service_grant;
-- Reapply inside this transaction without committing the fixtures.
\ir ../migrations/20261104103000_fase2_notebook_pages.sql
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT FROM notebook_before b FULL JOIN public.error_notebook n ON n.id=b.id
   WHERE b.row IS DISTINCT FROM to_jsonb(n)), 'reapply/read RPCs changed stored data';
END $$;
ANALYZE public.error_notebook;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.error_notebook
 WHERE user_id='f2700000-0000-0000-0000-000000000001' AND deleted_at IS NULL
 ORDER BY created_at DESC,id DESC LIMIT 50;
ROLLBACK;
\echo 'PASS: notebook pages, 1500 rows, scope/security, reapply, rollback'
