-- Disposable fixture only, after F0 + F1 model + admin migrations. Always rollback.
BEGIN;
CREATE TEMP TABLE f1_legacy_edition_before AS SELECT to_jsonb(e) AS value FROM public.exam_editions e WHERE code='2026';
CREATE FUNCTION pg_temp.fail_f1_clone_option() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF current_setting('test.f1_clone_failure',true)='on' THEN RAISE EXCEPTION 'fixture clone failure' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_fail_f1_clone BEFORE INSERT ON public.question_options FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_f1_clone_option();
DO $$ BEGIN
  ASSERT NOT has_column_privilege('authenticated','public.question_options','is_correct','SELECT');
  ASSERT NOT has_function_privilege('anon','public.admin_upsert_edition(jsonb)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.admin_clone_simulado(uuid,uuid,timestamptz,timestamptz,timestamptz,boolean)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.admin_publish_simulado(uuid)','EXECUTE');
END $$;
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.admin_upsert_edition('{}');
    RAISE EXCEPTION 'negative capability bypass';
  EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
  BEGIN
    PERFORM public.admin_publish_simulado(gen_random_uuid());
    RAISE EXCEPTION 'negative publish bypass';
  EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
  BEGIN
    PERFORM public.admin_clone_simulado(gen_random_uuid(),gen_random_uuid(),now(),now(),now(),true);
    RAISE EXCEPTION 'negative clone bypass';
  EXCEPTION WHEN SQLSTATE 'P0003' THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email) VALUES ('f1300000-0000-0000-0000-000000000001','f1-admin@example.invalid');
INSERT INTO public.user_roles(user_id,role)
SELECT 'f1300000-0000-0000-0000-000000000001',role FROM public.role_capabilities WHERE capability='content.manage' LIMIT 1;
SELECT set_config('request.jwt.claims','{"sub":"f1300000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE e uuid; source_id uuid; cloned uuid; qid uuid; bp uuid; area uuid; dto jsonb; before_source jsonb; attempts_before bigint; clones_before bigint;
BEGIN
  SELECT id INTO bp FROM public.exam_blueprints ORDER BY code LIMIT 1;
  SELECT id INTO area FROM public.exam_areas WHERE blueprint_id=bp ORDER BY sort_order LIMIT 1;
  dto := jsonb_build_object('code','2098.1','year',2098,'term',1,'label','Fixture','status','planned',
    'exam_date',NULL,'exam_date_confirmed',false,'official_results_at',NULL,'blueprint_id',bp,
    'cutoff_reference_label',NULL,'format',jsonb_build_object('questions',1,'options',2,'duration_minutes',30,'scoring','raw'));
  e := public.admin_upsert_edition(dto);
  ASSERT (SELECT exam_date IS NULL AND NOT exam_date_confirmed FROM public.exam_editions WHERE id=e);
  BEGIN
    PERFORM public.admin_upsert_edition(dto || jsonb_build_object('id',gen_random_uuid()));
    RAISE EXCEPTION 'unknown update inserted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    PERFORM public.admin_upsert_edition(dto || '{"exam_date_confirmed":true}'::jsonb);
    RAISE EXCEPTION 'confirmed null date';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  INSERT INTO public.simulados(title,slug,sequence_number,edition_id,status,duration_minutes,questions_count,
    execution_window_start,execution_window_end,results_release_at)
  VALUES ('Fixture','fixture-f1-source',1,e,'draft',30,1,'2098-01-01','2098-01-02','2098-01-03') RETURNING id INTO source_id;
  INSERT INTO public.questions(simulado_id,question_number,text,area,theme,area_id)
  SELECT source_id,1,'Question',label,'Fixture',id FROM public.exam_areas WHERE id=area RETURNING id INTO qid;
  INSERT INTO public.question_options(question_id,label,text,is_correct) VALUES (qid,'A','Yes',true),(qid,'B','No',false);
  SELECT to_jsonb(s) INTO before_source FROM public.simulados s WHERE id=source_id;
  SELECT count(*) INTO attempts_before FROM public.attempts;
  SELECT count(*) INTO clones_before FROM public.simulados WHERE edition_id=e;
  -- Even an authorized admin must inspect answer keys through the guarded RPC.
  BEGIN
    PERFORM is_correct FROM public.question_options LIMIT 0;
    RAISE EXCEPTION 'direct answer key read bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('test.f1_clone_failure','on',true);
  BEGIN
    PERFORM public.admin_clone_simulado(source_id,e,'2098-02-01','2098-02-02','2098-02-03',true);
    RAISE EXCEPTION 'fixture failed to interrupt clone';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('test.f1_clone_failure','off',true);
  ASSERT (SELECT count(*)=clones_before FROM public.simulados WHERE edition_id=e), 'partial clone leaked';
  cloned := public.admin_clone_simulado(source_id,e,'2098-02-01','2098-02-02','2098-02-03',true);
  ASSERT cloned <> source_id;
  ASSERT (SELECT status='draft' AND source_simulado_id=source_id AND sequence_number=2 FROM public.simulados WHERE id=cloned);
  ASSERT (SELECT to_jsonb(s)=before_source FROM public.simulados s WHERE id=source_id);
  ASSERT (SELECT count(*)=attempts_before FROM public.attempts);
  ASSERT (SELECT count(*)=1 FROM public.questions WHERE simulado_id=cloned AND id<>qid);
  ASSERT (SELECT count(*)=2 FROM public.question_options o JOIN public.questions q ON q.id=o.question_id WHERE q.simulado_id=cloned);
  ASSERT NOT EXISTS ((SELECT o->>'label',o->>'text',o->>'is_correct' FROM public.admin_get_simulado_questions(source_id) q CROSS JOIN LATERAL jsonb_array_elements(q.options) o)
    EXCEPT (SELECT o->>'label',o->>'text',o->>'is_correct' FROM public.admin_get_simulado_questions(cloned) q CROSS JOIN LATERAL jsonb_array_elements(q.options) o));
  ASSERT NOT EXISTS (SELECT 1 FROM public.question_options a JOIN public.question_options b ON a.id=b.id
    JOIN public.questions qa ON qa.id=a.question_id JOIN public.questions qb ON qb.id=b.question_id
    WHERE qa.simulado_id=source_id AND qb.simulado_id=cloned);
  PERFORM public.admin_publish_simulado(cloned);
  ASSERT (SELECT status='published' FROM public.simulados WHERE id=cloned);
  cloned := public.admin_clone_simulado(source_id,e,'2098-03-01','2098-03-02','2098-03-03',false);
  BEGIN
    PERFORM public.admin_publish_simulado(cloned);
    RAISE EXCEPTION 'partial published';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.simulados SET status='published' WHERE id=cloned;
    RAISE EXCEPTION 'direct publish bypass';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT (SELECT status='draft' FROM public.simulados WHERE id=cloned);
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT to_jsonb(e)=(SELECT value FROM f1_legacy_edition_before) FROM public.exam_editions e WHERE code='2026'), '2026 changed';
END $$;
ROLLBACK;
