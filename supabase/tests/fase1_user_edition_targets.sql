-- ONLY a disposable database, after F0 + F1 model + F1 user targets.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/fase1_user_edition_targets.sql
-- No external services required; the production auth schema/roles must exist.
BEGIN;

INSERT INTO auth.users(id,email) VALUES
 ('f1800000-0000-0000-0000-000000000001','target-one@example.invalid'),
 ('f1800000-0000-0000-0000-000000000002','target-two@example.invalid'),
 ('f1800000-0000-0000-0000-000000000003','target-first-id@example.invalid'),
 ('f1800000-0000-0000-0000-000000000004','target-first-text@example.invalid');
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('f1800000-0000-0000-0000-000000000011','2198.1',2198,1,'Fixture target A','preparing'),
 ('f1800000-0000-0000-0000-000000000012','2198.2',2198,2,'Fixture target B','active');
INSERT INTO public.enamed_specialties(id,name,slug) VALUES
 ('f1800000-0000-0000-0000-000000000021','Fixture specialty','fixture-target-specialty');
INSERT INTO public.enamed_institutions(id,name,uf,slug) VALUES
 ('f1800000-0000-0000-0000-000000000022','Fixture institution','SP','fixture-target-institution');
INSERT INTO public.onboarding_profiles(user_id,status,completed_at) VALUES
 ('f1800000-0000-0000-0000-000000000001','completed','2026-01-01T00:00:00Z');
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,
 execution_window_start,execution_window_end,results_release_at,status) VALUES
 ('f1800000-0000-0000-0000-000000000031','Fixture B','fixture-target-b',9901,
 'f1800000-0000-0000-0000-000000000012',now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours','published');

CREATE TEMP TABLE target_before AS SELECT
 (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.attempts a) AS attempts,
 (SELECT jsonb_agg(jsonb_build_object('id',p.id,'segment',p.segment) ORDER BY p.id) FROM public.profiles p) AS segments;

DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.set_target_edition_guarded(uuid,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.resolve_user_edition_id(timestamptz)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.user_edition_targets','INSERT');
 ASSERT NOT has_table_privilege('anon','public.user_edition_targets','SELECT');
 ASSERT NOT has_table_privilege('authenticated','public.onboarding_profiles','INSERT');
 ASSERT NOT has_table_privilege('authenticated','public.onboarding_profiles','UPDATE');
 ASSERT NOT has_table_privilege('authenticated','public.onboarding_profiles','DELETE');
 ASSERT NOT has_table_privilege('authenticated','public.onboarding_profiles','TRUNCATE');
 ASSERT NOT has_table_privilege('anon','public.onboarding_profiles','INSERT');
 ASSERT NOT has_table_privilege('anon','public.onboarding_profiles','UPDATE');
 ASSERT NOT has_table_privilege('anon','public.onboarding_profiles','DELETE');
 ASSERT NOT has_any_column_privilege('authenticated','public.onboarding_profiles','INSERT');
 ASSERT NOT has_any_column_privilege('authenticated','public.onboarding_profiles','UPDATE');
END $$;

SELECT set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE n bigint; r public.onboarding_profiles;
BEGIN
 PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000011','2198.1');
 SELECT count(*) INTO n FROM public.user_edition_targets;
 ASSERT n = 1, 'first changed target must be audited';
 PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000011','2198.1');
 ASSERT (SELECT count(*) FROM public.user_edition_targets) = n, 'idempotent call creates no history';
 ASSERT (SELECT status = 'completed' AND completed_at = '2026-01-01T00:00:00Z' FROM public.onboarding_profiles
   WHERE user_id = auth.uid()), 'target save reset completion';
 ASSERT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'another edition must not lock A';
 r := public.save_onboarding_guarded('f1800000-0000-0000-0000-000000000021'::uuid,
   ARRAY['f1800000-0000-0000-0000-000000000022','f1800000-0000-0000-0000-000000000022']::uuid[]);
 ASSERT cardinality(r.target_institution_ids) = 1, 'dedupe institution IDs';
 r := public.save_onboarding_guarded('Fixture specialty'::text,ARRAY['Fixture institution']::text[]);
 ASSERT r.specialty_id = 'f1800000-0000-0000-0000-000000000021', 'legacy canonical mapping';

 -- Target changes remain allowed during B's active window.
 PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000012',NULL);
 ASSERT NOT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'B must lock';
 ASSERT (SELECT reason = 'edicao_bloqueada_janela_aberta' AND next_edit_available_at = now()+interval '1 hour'
   FROM public.get_onboarding_edit_guard_state()), 'wrong window end/reason';
 BEGIN
   PERFORM public.save_onboarding_guarded(NULL::uuid,'{}'::uuid[]);
   RAISE EXCEPTION 'ID save bypassed lock';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Perfil so pode ser editado entre janelas de execucao' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.save_onboarding_guarded('Fixture specialty'::text,ARRAY['Fixture institution']::text[]);
   RAISE EXCEPTION 'legacy save bypassed lock';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Perfil so pode ser editado entre janelas de execucao' THEN RAISE; END IF;
 END;
 -- A role claim cannot grant the invoker server privileges.
  PERFORM set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000001","role":"service_role"}',true);
 BEGIN
   UPDATE public.onboarding_profiles SET status = 'pending', specialty = 'spoofed', specialty_id = NULL,
     target_institution_ids = '{}', target_institutions = '{}' WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner bypassed academic lock directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM public.onboarding_profiles WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner deleted onboarding to bypass completed lock';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE public.onboarding_profiles SET target_edition_id = 'f1800000-0000-0000-0000-000000000011' WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner spoofed target directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE public.onboarding_profiles SET expected_graduation_term = '2198.2' WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner spoofed graduation directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO public.user_edition_targets(user_id,target_edition_id) VALUES(auth.uid(),NULL);
   RAISE EXCEPTION 'owner spoofed history';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE public.user_edition_targets SET target_edition_id = NULL WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner rewrote history';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM public.user_edition_targets WHERE user_id = auth.uid();
   RAISE EXCEPTION 'owner deleted history';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000099',NULL);
   RAISE EXCEPTION 'missing edition accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
   PERFORM public.set_target_edition_guarded(NULL,'2027.3');
   RAISE EXCEPTION 'invalid term accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 PERFORM public.set_target_edition_guarded(NULL,NULL);
 ASSERT (SELECT target_edition_id IS NULL AND expected_graduation_term IS NULL
   FROM public.onboarding_profiles WHERE user_id = auth.uid()), 'undecided must remain null';
 ASSERT (SELECT count(*) FROM public.user_edition_targets) = n+2, 'history must include null transition';
 PERFORM public.set_target_edition_guarded(NULL,NULL);
 ASSERT (SELECT count(*) FROM public.user_edition_targets) = n+2, 'null idempotence';
 -- Term-only resolution must select B and enforce the exact same lock.
 PERFORM public.set_target_edition_guarded(NULL,'2198.2');
 ASSERT NOT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'term code resolution';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
 ASSERT (SELECT count(*) FROM public.user_edition_targets) = 0, 'another account history leaked';
 ASSERT NOT EXISTS (SELECT 1 FROM public.onboarding_profiles WHERE user_id = 'f1800000-0000-0000-0000-000000000001'), 'another profile leaked';
 BEGIN
   UPDATE public.onboarding_profiles SET target_edition_id = NULL WHERE user_id = 'f1800000-0000-0000-0000-000000000001';
   GET DIAGNOSTICS affected = ROW_COUNT;
   ASSERT affected = 0, 'another account target changed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO public.onboarding_profiles(user_id,target_edition_id)
   VALUES (auth.uid(),'f1800000-0000-0000-0000-000000000011');
   RAISE EXCEPTION 'direct insert spoofed target';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO public.onboarding_profiles(user_id,status,specialty) VALUES(auth.uid(),'completed','spoofed');
   RAISE EXCEPTION 'direct academic insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000012',NULL);
 ASSERT (SELECT status = 'pending' AND completed_at IS NULL FROM public.onboarding_profiles WHERE user_id = auth.uid()), 'new target completed onboarding';
 ASSERT (SELECT can_edit AND reason = 'ok' AND next_edit_available_at IS NULL FROM public.get_onboarding_edit_guard_state()),
   'target-created pending profile must permit first completion during its open window';
 PERFORM public.save_onboarding_guarded(NULL::uuid,'{}'::uuid[]);
 ASSERT (SELECT status = 'completed' AND completed_at IS NOT NULL AND target_edition_id = 'f1800000-0000-0000-0000-000000000012'
   FROM public.onboarding_profiles WHERE user_id = auth.uid()), 'initial save lost target or did not complete';
 ASSERT NOT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'completed profile must now lock';
 BEGIN
   PERFORM public.save_onboarding_guarded(NULL::uuid,'{}'::uuid[]);
   RAISE EXCEPTION 'second academic save during window accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Perfil so pode ser editado entre janelas de execucao' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;

-- Isolated resolver oracle. Everything in this nested block is rolled back,
-- including changes to seed statuses, so the rest of the fixture is unaffected.
-- Run as DB owner: helpers are intentionally not public authenticated RPCs.
SELECT set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000001","role":"authenticated"}',true);
DO $$
BEGIN
 BEGIN
   UPDATE public.exam_editions SET status = 'archived';
   UPDATE public.exam_editions SET status = 'active', exam_date = NULL, exam_date_confirmed = false
     WHERE id = 'f1800000-0000-0000-0000-000000000012';
   -- No onboarding row: resolve B, allow first completion, then lock both
   -- overloads. These inserts are rolled back with the oracle's savepoint.
   PERFORM set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000003","role":"authenticated"}',true);
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000012';
   ASSERT NOT EXISTS (SELECT 1 FROM public.onboarding_profiles WHERE user_id = auth.uid());
   ASSERT (SELECT can_edit AND next_edit_available_at IS NULL FROM public.get_onboarding_edit_guard_state()), 'no-row first completion blocked';
   PERFORM public.save_onboarding_guarded(NULL::uuid,'{}'::uuid[]);
   ASSERT NOT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'no-row completion did not activate guard';
   BEGIN
     PERFORM public.save_onboarding_guarded(NULL::uuid,'{}'::uuid[]);
     RAISE EXCEPTION 'completed ID edit accepted';
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM <> 'Perfil so pode ser editado entre janelas de execucao' THEN RAISE; END IF;
   END;
   PERFORM set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000004","role":"authenticated"}',true);
   ASSERT (SELECT can_edit FROM public.get_onboarding_edit_guard_state());
   -- Legacy callers also complete a target-created pending row during B's window.
   PERFORM public.set_target_edition_guarded('f1800000-0000-0000-0000-000000000012',NULL);
   ASSERT (SELECT status = 'pending' FROM public.onboarding_profiles WHERE user_id = auth.uid());
   ASSERT (SELECT can_edit FROM public.get_onboarding_edit_guard_state());
   PERFORM public.save_onboarding_guarded('Fixture specialty'::text,ARRAY['Fixture institution']::text[]);
   ASSERT NOT (SELECT can_edit FROM public.get_onboarding_edit_guard_state()), 'legacy first completion did not activate guard';
   BEGIN
     PERFORM public.save_onboarding_guarded('Fixture specialty'::text,ARRAY['Fixture institution']::text[]);
     RAISE EXCEPTION 'completed legacy edit accepted';
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM <> 'Perfil so pode ser editado entre janelas de execucao' THEN RAISE; END IF;
   END;
   PERFORM set_config('request.jwt.claims','{"sub":"f1800000-0000-0000-0000-000000000001","role":"authenticated"}',true);
   UPDATE public.exam_editions SET status = 'planned', exam_date = NULL, exam_date_confirmed = false
     WHERE id = 'f1800000-0000-0000-0000-000000000011';
   UPDATE public.onboarding_profiles SET target_edition_id = NULL, expected_graduation_term = NULL
     WHERE user_id = auth.uid();
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000012', 'active before earlier planned';
   UPDATE public.exam_editions SET status = 'preparing' WHERE id = 'f1800000-0000-0000-0000-000000000011';
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000011', 'oldest preparing/active';
   UPDATE public.exam_editions SET exam_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date + 2
     WHERE id = 'f1800000-0000-0000-0000-000000000012';
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000012', 'future date before undated';
   UPDATE public.exam_editions SET exam_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
     WHERE id = 'f1800000-0000-0000-0000-000000000011';
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000011', 'nearest date including today';
   UPDATE public.onboarding_profiles SET expected_graduation_term = '2198.2' WHERE user_id = auth.uid();
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000012', 'graduation before nearest';
   UPDATE public.exam_editions SET status = 'archived' WHERE id = 'f1800000-0000-0000-0000-000000000011';
   UPDATE public.onboarding_profiles SET target_edition_id = 'f1800000-0000-0000-0000-000000000011' WHERE user_id = auth.uid();
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000011', 'explicit historical before graduation';
   BEGIN
     DELETE FROM public.exam_editions WHERE id = 'f1800000-0000-0000-0000-000000000011';
     RAISE EXCEPTION 'referenced edition deleted';
   EXCEPTION WHEN foreign_key_violation THEN NULL;
   END;
   UPDATE public.onboarding_profiles SET target_edition_id = NULL, expected_graduation_term = NULL WHERE user_id = auth.uid();
   UPDATE public.exam_editions SET status = 'archived' WHERE id = 'f1800000-0000-0000-0000-000000000012';
   UPDATE public.exam_editions SET status = 'planned', exam_date = NULL WHERE id = 'f1800000-0000-0000-0000-000000000011';
   ASSERT public.resolve_user_edition_id(now()) = 'f1800000-0000-0000-0000-000000000011', 'planned final fallback';
   UPDATE public.exam_editions SET status = 'archived' WHERE id = 'f1800000-0000-0000-0000-000000000011';
   ASSERT public.resolve_user_edition_id(now()) IS NULL, 'no eligible edition';
   RAISE SQLSTATE 'ZX001' USING MESSAGE = 'rollback resolver oracle';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END $$;

SELECT set_config('request.jwt.claims','{}',true);
-- Real server role remains trusted without a JWT role claim. CRUD below is
-- confined to fixture accounts and the outer transaction rolls it all back.
SET LOCAL ROLE service_role;
DO $$ DECLARE affected integer; BEGIN
 INSERT INTO public.onboarding_profiles(user_id) VALUES('f1800000-0000-0000-0000-000000000003');
 UPDATE public.onboarding_profiles SET specialty = specialty WHERE user_id = 'f1800000-0000-0000-0000-000000000003';
 GET DIAGNOSTICS affected = ROW_COUNT;
 ASSERT affected = 1, 'server UPDATE unexpectedly blocked';
 DELETE FROM public.onboarding_profiles WHERE user_id = 'f1800000-0000-0000-0000-000000000003';
 GET DIAGNOSTICS affected = ROW_COUNT;
 ASSERT affected = 1, 'server DELETE unexpectedly blocked';
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
   PERFORM public.set_target_edition_guarded(NULL,NULL);
   RAISE EXCEPTION 'missing auth accepted';
 EXCEPTION WHEN invalid_authorization_specification THEN NULL;
 END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
   INSERT INTO public.onboarding_profiles(user_id,status) VALUES('f1800000-0000-0000-0000-000000000003','completed');
   RAISE EXCEPTION 'anon onboarding insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE public.onboarding_profiles SET status = 'pending' WHERE user_id = 'f1800000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'anon onboarding update accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM public.onboarding_profiles WHERE user_id = 'f1800000-0000-0000-0000-000000000001';
   RAISE EXCEPTION 'anon onboarding delete accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM public.set_target_edition_guarded(NULL,NULL);
   RAISE EXCEPTION 'anon RPC accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM 1 FROM public.user_edition_targets;
   RAISE EXCEPTION 'anon read history';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

DO $$ BEGIN
 ASSERT (SELECT attempts FROM target_before) IS NOT DISTINCT FROM
   (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.attempts a), 'attempts/scores changed';
 ASSERT (SELECT segments FROM target_before) IS NOT DISTINCT FROM
   (SELECT jsonb_agg(jsonb_build_object('id',p.id,'segment',p.segment) ORDER BY p.id) FROM public.profiles p), 'segments changed';
END $$;
ROLLBACK;
