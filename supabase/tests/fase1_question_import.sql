-- Run only against a disposable fixture with F0 + F1 model + import migrations.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() !~ '^enamed_test_[a-z0-9_]+$' OR inet_server_port() IS DISTINCT FROM 54737
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Requires 127.0.0.1:54737/enamed_test_*';
  END IF;
END $$;
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion: %', message; END IF;
  RAISE NOTICE 'PASS: %', message;
END $$;

SELECT pg_temp.assert(has_function_privilege('authenticated','public.admin_import_questions(uuid,jsonb)','EXECUTE')
  AND has_function_privilege('authenticated','public.admin_validate_question_import(uuid,jsonb)','EXECUTE'), 'authenticated RPC grants preserved');
SELECT pg_temp.assert(NOT has_function_privilege('anon','public.admin_import_questions(uuid,jsonb)','EXECUTE')
  AND NOT has_function_privilege('anon','public.admin_validate_question_import(uuid,jsonb)','EXECUTE'), 'anon RPC execution denied');
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
  WHERE p.oid IN ('public.admin_import_questions(uuid,jsonb)'::regprocedure,'public.admin_validate_question_import(uuid,jsonb)'::regprocedure)
  AND acl.grantee=0 AND acl.privilege_type='EXECUTE'), 'PUBLIC RPC execution denied');
SELECT pg_temp.assert(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.questions'::regclass
  AND conname='questions_simulado_number_key' AND contype='u' AND convalidated), 'question uniqueness preserved');

INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000041','import-fixture@example.invalid');
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-4000-8000-000000000041','content_editor');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);

DO $$ DECLARE
  edition uuid; sim uuid; source_sim uuid; b uuid; rows jsonb; result jsonb; original jsonb;
BEGIN
  INSERT INTO public.exam_blueprints(code,label) VALUES ('import-fixture','Fixture') RETURNING id INTO b;
  INSERT INTO public.exam_areas(blueprint_id,code,label,aliases,weight,sort_order)
    VALUES (b,'ped','Pediatria',ARRAY['PED'],1,1);
  INSERT INTO public.exam_editions(code,year,term,label,status,format,blueprint_id)
    VALUES ('2099.1',2099,1,'Fixture','preparing','{"questions":120,"options":4,"duration_minutes":300,"scoring":"raw"}',b) RETURNING id INTO edition;
  INSERT INTO public.simulados(title,slug,sequence_number,status,edition_id,execution_window_start,execution_window_end,results_release_at)
    VALUES ('Source','import-fixture-source',2,'draft',edition,now(),now()+interval '1 day',now()+interval '2 days') RETURNING id INTO source_sim;
  INSERT INTO public.simulados(title,slug,sequence_number,status,edition_id,source_simulado_id,execution_window_start,execution_window_end,results_release_at)
    VALUES ('Fixture','import-fixture',1,'draft',edition,source_sim,now(),now()+interval '1 day',now()+interval '2 days') RETURNING id INTO sim;
  rows := '[{"question_number":1,"text":"Conduta?","area":"PED","options":[{"label":"A","text":"a","is_correct":true},{"label":"B","text":"b","is_correct":false},{"label":"C","text":"c","is_correct":false},{"label":"D","text":"d","is_correct":false}]}]';
  original := rows;
  result := public.admin_import_questions(sim, rows || jsonb_set(rows,'{0,question_number}','0'));
  PERFORM pg_temp.assert(NOT (result->>'ok')::boolean AND result->'errors' @> '[{"row":2,"field":"question_number"}]', 'bad row reported');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.questions WHERE simulado_id=sim), 'invalid batch wrote zero questions');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.question_options o JOIN public.questions q ON q.id=o.question_id WHERE q.simulado_id=sim), 'invalid batch wrote zero options');
  result := public.admin_import_questions(sim,rows || rows);
  PERFORM pg_temp.assert(NOT (result->>'ok')::boolean, 'duplicate in payload rejected');
  result := public.admin_import_questions(sim,jsonb_set(rows,'{0,area}','"Preventiva"'));
  PERFORM pg_temp.assert(result->'errors' @> '[{"row":1,"field":"area"}]', 'ambiguous area rejected');
  UPDATE public.exam_editions SET format=jsonb_set(format,'{options}','5') WHERE id=edition;
  result := public.admin_import_questions(sim,rows);
  PERFORM pg_temp.assert(result->'errors' @> '[{"field":"options"}]', 'four options invalid for five-option edition');
  result := public.admin_validate_question_import(sim,jsonb_set(rows,'{0,options}',(rows->0->'options') || '[{"label":"E","text":"e","is_correct":false}]'::jsonb));
  PERFORM pg_temp.assert((result->>'ok')::boolean, 'five options valid for five-option edition');
  UPDATE public.exam_editions SET format=jsonb_set(format,'{options}','4') WHERE id=edition;
  result := public.admin_import_questions(sim,rows);
  PERFORM pg_temp.assert((result->>'imported')::int=1, 'valid row imported');
  PERFORM pg_temp.assert(rows=original, 'source unchanged');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.questions WHERE simulado_id=source_sim), 'source simulado content unchanged');
  PERFORM pg_temp.assert((SELECT source_simulado_id=source_sim FROM public.simulados WHERE id=sim), 'source provenance unchanged');
  result := public.admin_import_questions(sim,rows);
  PERFORM pg_temp.assert(NOT (result->>'ok')::boolean, 'resend rejected');
  PERFORM pg_temp.assert((SELECT count(*)=4 FROM public.question_options o JOIN public.questions q ON q.id=o.question_id WHERE q.simulado_id=sim), 'exactly four options');
  -- This one-question fixture must satisfy the installed publication contract.
  -- Keep the guard enabled: publication itself is a real operation under test.
  UPDATE public.exam_editions SET format=jsonb_set(format,'{questions}','1') WHERE id=edition;
  UPDATE public.simulados SET questions_count=1,status='published' WHERE id=sim;
  result := public.admin_import_questions(sim,jsonb_set(rows,'{0,question_number}','2'));
  PERFORM pg_temp.assert(NOT (result->>'ok')::boolean
    AND result->'errors' @> '[{"field":"simulado"}]'::jsonb,
    'published bulk import rejected by status, not question-number validation');
END $$;

-- Force an option-insert error after question insertion; function must roll back.
CREATE FUNCTION pg_temp.fail_import_option() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.text='force-rollback' THEN RAISE EXCEPTION 'fixture insert failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fixture_fail_import BEFORE INSERT ON public.question_options FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_option();
DO $$ DECLARE sim uuid; n bigint; BEGIN
  SELECT id INTO sim FROM public.simulados WHERE slug='import-fixture';
  UPDATE public.simulados SET status='draft' WHERE id=sim;
  UPDATE public.exam_editions SET format=jsonb_set(format,'{questions}','120')
    WHERE id=(SELECT edition_id FROM public.simulados WHERE id=sim);
  SELECT count(*) INTO n FROM public.questions WHERE simulado_id=sim;
  BEGIN
    PERFORM public.admin_import_questions(sim,'[{"question_number":2,"text":"Fail","area":"PED","options":[{"label":"A","text":"force-rollback","is_correct":true},{"label":"B","text":"b","is_correct":false},{"label":"C","text":"c","is_correct":false},{"label":"D","text":"d","is_correct":false}]}]');
    RAISE EXCEPTION 'Expected insert failure' USING ERRCODE='ZX001';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  PERFORM pg_temp.assert((SELECT count(*)=n FROM public.questions WHERE simulado_id=sim),'insert error rolled back all writes');
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000042',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_import_questions(gen_random_uuid(),'[]');
    RAISE EXCEPTION 'Expected capability exception' USING ERRCODE='ZX001';
   EXCEPTION WHEN SQLSTATE 'P0003' THEN PERFORM pg_temp.assert(true,'capability denied');
     WHEN insufficient_privilege THEN PERFORM pg_temp.assert(true,'capability denied');
  END;
END $$;
ROLLBACK;

-- A transaction-wide snapshot can hide an attempt committed while waiting for
-- the parent lock. Refuse both non-READ-COMMITTED isolation levels explicitly.
BEGIN ISOLATION LEVEL REPEATABLE READ;
DO $$ BEGIN
  IF current_database() !~ '^enamed_test_[a-z0-9_]+$' OR inet_server_port() IS DISTINCT FROM 54737
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Requires 127.0.0.1:54737/enamed_test_*';
  END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000041','import-fixture@example.invalid');
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-4000-8000-000000000041','content_editor');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_import_questions(gen_random_uuid(),'[]');
    RAISE EXCEPTION 'Expected isolation exception' USING ERRCODE='ZX001';
  EXCEPTION WHEN invalid_transaction_state THEN RAISE NOTICE 'PASS: repeatable read rejected';
  END;
END $$;
ROLLBACK;

BEGIN ISOLATION LEVEL SERIALIZABLE;
DO $$ BEGIN
  IF current_database() !~ '^enamed_test_[a-z0-9_]+$' OR inet_server_port() IS DISTINCT FROM 54737
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Requires 127.0.0.1:54737/enamed_test_*';
  END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000041','import-fixture@example.invalid');
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-4000-8000-000000000041','content_editor');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000041',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_import_questions(gen_random_uuid(),'[]');
    RAISE EXCEPTION 'Expected isolation exception' USING ERRCODE='ZX001';
  EXCEPTION WHEN invalid_transaction_state THEN RAISE NOTICE 'PASS: serializable rejected';
  END;
END $$;
ROLLBACK;
