-- Dedicated local clone only. All synthetic fixtures and DDL probes roll back.
\set ON_ERROR_STOP on
SELECT 1 / ((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737
 AND current_database() LIKE 'enamed_test_notebook_front_%' AND session_user='postgres')::int);
BEGIN;
DO $$ BEGIN
 ASSERT to_regprocedure('public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer)') IS NOT NULL,
   'RED: filtered RPC missing';
 ASSERT to_regprocedure('public.get_error_notebook_filtered_counts(uuid,text,text,text,text)') IS NOT NULL;
END $$;
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created_hubspot;
-- Synthetic incomplete exams only; publication validation is not under test.
-- Transaction rollback restores the trigger. All RLS/release helpers stay active.
ALTER TABLE public.simulados DISABLE TRIGGER trg_admin_publication;
INSERT INTO auth.users(id,email) SELECT
 ('f2800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'filters-'||n||'@example.invalid' FROM generate_series(1,2) n;
UPDATE public.profiles SET segment='pro' WHERE id::text LIKE 'f2800000-%';
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f2800000-0000-0000-0000-000000000011','2198.1',2198,1,'DEMO A','closed'),
 ('f2800000-0000-0000-0000-000000000012','2198.2',2198,2,'DEMO B','active');
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at,status)
 SELECT ('f2810000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'DEMO '||n,'filters-fixture-'||n,n,
 CASE WHEN n=2 THEN 'f2800000-0000-0000-0000-000000000012'::uuid
 ELSE 'f2800000-0000-0000-0000-000000000011'::uuid END,
 now()-interval '10 days',now()-interval '9 days',
 CASE WHEN n=3 THEN now()+interval '1 day' ELSE now()-interval '8 days' END,
 (CASE WHEN n=4 THEN 'draft' ELSE 'published' END)::public.simulado_status
 FROM generate_series(1,5) n;
INSERT INTO public.questions(id,simulado_id,question_number,text,area,theme)
 SELECT ('f2820000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('f2810000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,1,
 'DEMO question','Exam','Theme' FROM generate_series(1,5) n;
INSERT INTO public.attempts(user_id,simulado_id,status,attempt_type,effective_deadline,finished_at,is_within_window)
 SELECT 'f2800000-0000-0000-0000-000000000001',id,'submitted','offline',
 now(),now()-interval '9 days',false FROM public.simulados
 WHERE id::text LIKE 'f2810000-%' AND sequence_number<=4;
INSERT INTO public.error_notebook(id,user_id,simulado_id,question_id,area,theme,reason,
 question_text,learning_text,simulado_title,created_at,mastered_at,resolved_at,srs_due_at,next_review_at,last_review_outcome)
 SELECT ('f2830000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'f2800000-0000-0000-0000-000000000001',
 CASE WHEN n<=1400 THEN ('f2810000-0000-0000-0000-'||lpad((CASE WHEN n<=700 THEN 1 ELSE 2 END)::text,12,'0'))::uuid END,
 CASE WHEN n<=1400 THEN ('f2820000-0000-0000-0000-'||lpad((CASE WHEN n<=700 THEN 1 ELSE 2 END)::text,12,'0'))::uuid END,
 CASE WHEN n<=1400 THEN 'Exam' ELSE 'Manual' END,
 CASE WHEN n=1499 THEN 'Literal 50%_ VALUE' ELSE 'Theme' END,
 (CASE WHEN n%2=0 THEN 'did_not_know' ELSE 'reading_error' END)::public.error_reason,
 CASE WHEN n=1498 THEN 'QuestionNeedle' ELSE 'DEMO question '||n END,
 CASE WHEN n=1497 THEN 'LearningNeedle' END,
 CASE WHEN n=1496 THEN 'TitleNeedle' END,
 now()-interval '7 days', CASE WHEN n<=10 THEN now() END,
 CASE WHEN n BETWEEN 11 AND 20 THEN now() END,
 CASE WHEN n<>1494 THEN now()-interval '1 day' END,
 CASE WHEN n=1494 THEN now()+interval '1 day' ELSE now()-interval '1 day' END,
 CASE WHEN n=21 THEN 'leech_blocked' WHEN n=22 THEN 'awaiting_lesson' END
 FROM generate_series(1,1500) n;
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,area,reason,question_text)
 SELECT 'f2800000-0000-0000-0000-000000000001',s.id,q.id,'Hidden','did_not_know','SECRET'
 FROM public.simulados s JOIN public.questions q ON q.simulado_id=s.id
 WHERE s.id::text LIKE 'f2810000-%' AND s.sequence_number>=3;
INSERT INTO public.error_notebook(user_id,simulado_id,question_id,reason) VALUES
 ('f2800000-0000-0000-0000-000000000001','f2810000-0000-0000-0000-000000000001','f2820000-0000-0000-0000-000000000002','did_not_know');
INSERT INTO public.error_notebook(user_id,reason,deleted_at) VALUES
 ('f2800000-0000-0000-0000-000000000001','did_not_know',now());
INSERT INTO public.error_notebook(user_id,reason) VALUES
 ('f2800000-0000-0000-0000-000000000002','did_not_know');
CREATE TEMP TABLE before_hash AS SELECT md5(string_agg(to_jsonb(n)::text,'' ORDER BY id)) hash FROM public.error_notebook n;
SELECT set_config('request.jwt.claims','{"sub":"f2800000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE j jsonb; c jsonb; item jsonb; ids text[]:='{}'; n int; e uuid; v text;
BEGIN
 j:=public.list_error_notebook_filtered_page(); c:=public.get_error_notebook_filtered_counts();
 ASSERT j->>'total'='1500' AND jsonb_array_length(j->'items')=50;
 ASSERT j->'counts'=c AND c->>'mastered'='20' AND c->>'due'='1477';
 ASSERT j::text NOT LIKE '%SECRET%';
 ASSERT j#>'{items,0,edition_id}'='null'::jsonb;
 ASSERT public.get_error_notebook_filtered_counts(p_state=>'pending')->>'total'='1480';
 ASSERT public.get_error_notebook_filtered_counts(p_state=>'mastered')->>'total'='20';
 ASSERT public.get_error_notebook_filtered_counts(p_state=>'mastered')->>'due'='0';
 ASSERT public.get_error_notebook_filtered_counts(p_area=>'exam')->>'total'='0','area exact case';
 ASSERT public.get_error_notebook_filtered_counts(p_reason=>'reading_error',p_area=>'Manual')->>'total'='50';
 FOREACH v IN ARRAY ARRAY[' 50%_ ','questionneedle','LEARNINGNEEDLE','titleneedle'] LOOP
  ASSERT public.get_error_notebook_filtered_counts(p_search=>v)->>'total'='1','literal trimmed case insensitive across fields';
 END LOOP;
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'%')->>'total'='1';
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'_')->>'total'='1';
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'  ')->>'total'='1500';
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'Manual')->>'total'='100','search includes area';
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'Exam')->>'total'='1400';
 -- Search includes question_number, without borrowing the question table text.
 FOR n IN 0..14 LOOP
  j:=public.list_error_notebook_filtered_page(p_limit=>100,p_offset=>n*100);
  ASSERT j->>'total'='1500' AND jsonb_array_length(j->'items')=100;
  FOR item IN SELECT value FROM jsonb_array_elements(j->'items') LOOP
   ASSERT NOT item->>'id'=ANY(ids),'duplicate across pages'; ids:=array_append(ids,item->>'id');
  END LOOP;
 END LOOP;
 ASSERT cardinality(ids)=1500 AND ids[1]='f2830000-0000-0000-0000-000000001500'
  AND ids[1500]='f2830000-0000-0000-0000-000000000001';
 FOR n IN 11..12 LOOP
  e:=('f2800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid;
  j:=public.list_error_notebook_filtered_page(e,'did_not_know','Exam',null,'pending',100,100);
  c:=public.get_error_notebook_filtered_counts(e,'did_not_know','Exam',null,'pending');
  ASSERT j->'counts'=c AND j->>'total'=CASE WHEN n=11 THEN '340' ELSE '350' END;
  ASSERT jsonb_array_length(j->'items')=100;
  ASSERT NOT EXISTS(SELECT FROM jsonb_array_elements(j->'items') a WHERE a->>'edition_id' IS DISTINCT FROM e::text);
 END LOOP;
 ASSERT public.get_error_notebook_filtered_counts('f2800000-0000-0000-0000-000000000011')->>'total'='700';
 ASSERT public.get_error_notebook_filtered_counts('f2800000-0000-0000-0000-000000000012')->>'total'='700';
 ASSERT public.list_error_notebook_filtered_page(p_area=>'Manual',p_limit=>50,p_offset=>99)->>'total'='100';
 ASSERT jsonb_array_length(public.list_error_notebook_filtered_page(p_area=>'Manual',p_offset=>100)->'items')=0;
 ASSERT public.get_error_notebook_filtered_counts(p_search=>'nothing')='{"total":0,"mastered":0,"due":0,"by_area":[]}'::jsonb;
 FOR n IN 1..5 LOOP
  BEGIN
   PERFORM public.list_error_notebook_filtered_page(p_limit=>CASE n WHEN 1 THEN 0 WHEN 2 THEN 101 WHEN 3 THEN NULL ELSE 50 END,
    p_offset=>CASE n WHEN 4 THEN -1 WHEN 5 THEN NULL ELSE 0 END);
   RAISE EXCEPTION 'pagination accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 FOREACH v IN ARRAY ARRAY['bad','',NULL] LOOP
  BEGIN PERFORM public.get_error_notebook_filtered_counts(p_state=>v); RAISE EXCEPTION 'state accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.list_error_notebook_filtered_page(p_state=>v); RAISE EXCEPTION 'state accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN PERFORM public.get_error_notebook_filtered_counts(p_reason=>'nao_sei'); RAISE EXCEPTION 'reason accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.list_error_notebook_filtered_page(p_search=>repeat('x',201)); RAISE EXCEPTION 'long search accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.notebook_filtered_scope(null,null,null,null,'all'); RAISE EXCEPTION 'private helper exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Reapply and rollback only the NEW functions with fixtures still present.
\ir ../migrations/20261104120002_fase2_notebook_filters.sql
DO $$ BEGIN ASSERT (SELECT hash FROM before_hash)=(SELECT md5(string_agg(to_jsonb(n)::text,'' ORDER BY id)) FROM public.error_notebook n); END $$;
SAVEPOINT rollback_probe;
DROP FUNCTION public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer);
DROP FUNCTION public.get_error_notebook_filtered_counts(uuid,text,text,text,text);
DROP FUNCTION public.notebook_filtered_counts_json(jsonb);
DROP FUNCTION public.notebook_filtered_scope(uuid,text,text,text,text);
DO $$ BEGIN ASSERT (SELECT hash FROM before_hash)=(SELECT md5(string_agg(to_jsonb(n)::text,'' ORDER BY id)) FROM public.error_notebook n); END $$;
ROLLBACK TO SAVEPOINT rollback_probe;
-- Existing helper's release/visibility decisions must hold for both wrappers.
-- Defense-in-depth null probes; schema constraints restored by final rollback.
ALTER TABLE public.simulados ALTER COLUMN execution_window_start DROP NOT NULL;
ALTER TABLE public.simulados ALTER COLUMN results_release_at DROP NOT NULL;
DO $$ DECLARE mode text; expected text; BEGIN
 FOREACH mode IN ARRAY ARRAY['archived','draft','test','future_release','null_start','future_start','null_release','future_end'] LOOP
  UPDATE public.simulados SET status=(CASE WHEN mode IN ('archived','draft','test') THEN mode ELSE 'published' END)::public.simulado_status,
   execution_window_start=CASE WHEN mode='null_start' THEN NULL WHEN mode='future_start' THEN now()+interval '1 day' ELSE now()-interval '10 days' END,
   execution_window_end=CASE WHEN mode IN ('future_start','future_end') THEN now()+interval '2 days' ELSE now()-interval '9 days' END,
   results_release_at=CASE WHEN mode='null_release' THEN NULL WHEN mode IN ('future_release','future_start','future_end') THEN now()+interval '3 days' ELSE now()-interval '8 days' END
   WHERE id='f2810000-0000-0000-0000-000000000001';
  expected:=CASE WHEN mode='archived' THEN '1500' ELSE '800' END;
  SET LOCAL ROLE authenticated;
  ASSERT public.list_error_notebook_filtered_page()->>'total'=expected,mode;
  ASSERT public.get_error_notebook_filtered_counts()->>'total'=expected,mode;
  RESET ROLE;
 END LOOP;
 UPDATE public.simulados SET status='published',execution_window_start=now()-interval '10 days',
  execution_window_end=now()-interval '9 days',results_release_at=now()-interval '8 days'
  WHERE id='f2810000-0000-0000-0000-000000000001';
 -- Another real PRO can only see its own single manual row.
 PERFORM set_config('request.jwt.claims','{"sub":"f2800000-0000-0000-0000-000000000002","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 ASSERT public.list_error_notebook_filtered_page()->>'total'='1';
 ASSERT public.get_error_notebook_filtered_counts()->>'total'='1';
 RESET ROLE;
 PERFORM set_config('request.jwt.claims','{"sub":"f2800000-0000-0000-0000-000000000001","role":"authenticated","segment":"pro"}',true);
 UPDATE public.profiles SET segment='standard' WHERE id='f2800000-0000-0000-0000-000000000001';
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.list_error_notebook_filtered_page(); RAISE EXCEPTION 'non-PRO accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_error_notebook_filtered_counts(); RAISE EXCEPTION 'non-PRO accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 UPDATE public.profiles SET segment='pro' WHERE id='f2800000-0000-0000-0000-000000000001';
 PERFORM set_config('request.jwt.claims','{}',true);
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.list_error_notebook_filtered_page(); RAISE EXCEPTION 'no auth accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
END $$;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','service_role'] LOOP
  ASSERT NOT has_function_privilege(r,'public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer)','EXECUTE');
  ASSERT NOT has_function_privilege(r,'public.get_error_notebook_filtered_counts(uuid,text,text,text,text)','EXECUTE');
  -- Even accidental future grants must not allow impersonation of a real PRO.
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer) TO %I',r);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.get_error_notebook_filtered_counts(uuid,text,text,text,text) TO %I',r);
  PERFORM set_config('request.jwt.claims','{"sub":"f2800000-0000-0000-0000-000000000001","role":"authenticated"}',true);
  EXECUTE format('SET LOCAL ROLE %I',r);
  BEGIN PERFORM public.list_error_notebook_filtered_page(); RAISE EXCEPTION 'impersonation accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.get_error_notebook_filtered_counts(); RAISE EXCEPTION 'impersonation accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
 END LOOP;
END $$;
ROLLBACK;
