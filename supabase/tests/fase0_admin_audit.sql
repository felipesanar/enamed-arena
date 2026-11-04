-- psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54737 -U postgres
--      -d enamed_test_<disposable> -f supabase/tests/fase0_admin_audit.sql
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() NOT LIKE 'enamed\_test\_%' ESCAPE '\'
     OR inet_server_port() IS DISTINCT FROM 54737
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet THEN
    RAISE EXCEPTION 'Only disposable enamed_test_* on 127.0.0.1:54737';
  END IF;
END $$;

CREATE TEMP TABLE audit_checks (label text NOT NULL);
CREATE FUNCTION pg_temp.audit_assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  INSERT INTO audit_checks VALUES (label);
END $$;
CREATE FUNCTION pg_temp.audit_id(label text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT md5('fase0-admin-audit:' || label)::uuid $$;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES (pg_temp.audit_id('admin'), 'audit-admin@example.invalid', '{}'),
       (pg_temp.audit_id('reader'), 'audit-reader@example.invalid', '{}');
INSERT INTO public.user_roles(user_id, role) VALUES (pg_temp.audit_id('admin'), 'admin')
ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub', pg_temp.audit_id('admin')::text, true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.audit_id('admin'),
  'role', 'authenticated')::text, true);
SELECT pg_temp.audit_assert(public.has_capability('audit.view'), 'admin has audit.view');

-- Exercise every operation with a real JWT identity, then again without one.
DO $$
DECLARE
  maintenance boolean;
  n integer;
  row_id uuid;
  result_id uuid;
  entity text;
  operation text;
  event public.admin_audit_log%ROWTYPE;
  content_key text;
  expected_before jsonb;
  expected_after jsonb;
  expected_diff jsonb;
  safe_text text := E'Aspas '' " <script> & \\ unicode: ' || chr(233) || chr(10) || 'fim';
  baseline bigint;
BEGIN
  FOREACH maintenance IN ARRAY ARRAY[false, true] LOOP
    IF maintenance THEN
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claims', '{}', true);
      PERFORM pg_temp.audit_assert(auth.uid() IS NULL, 'maintenance auth.uid is null');
    END IF;
    SELECT count(*) INTO baseline FROM public.admin_audit_log;
    INSERT INTO public.simulados(id, title, slug, sequence_number,
      execution_window_start, execution_window_end, results_release_at)
    VALUES (pg_temp.audit_id('sim'), safe_text, 'fase0-admin-audit', 987654,
      now(), now() + interval '1 hour', now() + interval '2 hours') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('sim'), 'simulado INSERT returns NEW');
    INSERT INTO public.questions(id, simulado_id, question_number, text, area, theme, image_url)
    VALUES (pg_temp.audit_id('question'), pg_temp.audit_id('sim'), 1, safe_text, 'Clinica Medica', 'Audit',
      'excluded-url-sentinel')
    RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('question'), 'question INSERT returns NEW');
    INSERT INTO public.question_options(id, question_id, label, text, is_correct)
    VALUES (pg_temp.audit_id('option'), pg_temp.audit_id('question'), 'A', safe_text, true)
    RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('option'), 'option INSERT returns NEW');
    UPDATE public.simulados SET title = safe_text || ' changed',
      execution_window_end = now() + interval '2 hours' WHERE id = pg_temp.audit_id('sim')
    RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('sim'), 'simulado UPDATE returns NEW');
    UPDATE public.questions SET text = safe_text || ' changed', explanation = 'Explanation'
    WHERE id = pg_temp.audit_id('question') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('question'), 'question UPDATE returns NEW');
    UPDATE public.question_options SET text = safe_text || ' changed', is_correct = false
    WHERE id = pg_temp.audit_id('option') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('option'), 'option UPDATE returns NEW');
    DELETE FROM public.question_options WHERE id = pg_temp.audit_id('option') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('option'), 'option DELETE returns OLD');
    DELETE FROM public.questions WHERE id = pg_temp.audit_id('question') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('question'), 'question DELETE returns OLD');
    DELETE FROM public.simulados WHERE id = pg_temp.audit_id('sim') RETURNING id INTO result_id;
    PERFORM pg_temp.audit_assert(result_id = pg_temp.audit_id('sim'), 'simulado DELETE returns OLD');
    IF maintenance THEN
      PERFORM pg_temp.audit_assert((SELECT count(*) = baseline FROM public.admin_audit_log),
        'maintenance creates no actorless audit events');
      CONTINUE;
    END IF;
    PERFORM pg_temp.audit_assert((SELECT count(*) = baseline + 9 FROM public.admin_audit_log),
      'exactly nine events for three tables x three operations');
    FOR n IN 1..3 LOOP
      entity := (ARRAY['simulados', 'questions', 'question_options'])[n];
      row_id := pg_temp.audit_id((ARRAY['sim', 'question', 'option'])[n]);
      content_key := CASE n WHEN 1 THEN 'title' ELSE 'text' END;
      FOREACH operation IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
        SELECT * INTO STRICT event FROM public.admin_audit_log
        WHERE entity_type = entity AND entity_id = row_id AND action = operation;
        PERFORM pg_temp.audit_assert(event.actor_id = pg_temp.audit_id('admin')
          AND event.actor_email = 'audit-admin@example.invalid', entity || operation || ' identity');
        PERFORM pg_temp.audit_assert(event.metadata->>'op' = operation, entity || operation || ' op');
        PERFORM pg_temp.audit_assert(event.metadata ?& ARRAY['op', 'before', 'after', 'diff']
          AND CASE operation
            WHEN 'INSERT' THEN event.metadata->'before' = 'null'::jsonb
              AND event.metadata->'after'->>'id' = row_id::text
            WHEN 'DELETE' THEN event.metadata->'after' = 'null'::jsonb
              AND event.metadata->'before'->>'id' = row_id::text
            ELSE event.metadata->'before'->>'id' = row_id::text
              AND event.metadata->'after'->>'id' = row_id::text END,
          entity || operation || ' snapshot shape and entity ids');
        PERFORM pg_temp.audit_assert(event.summary = CASE n
          WHEN 1 THEN 'Simulado: ' || safe_text || CASE WHEN operation = 'INSERT' THEN '' ELSE ' changed' END
          WHEN 2 THEN U&'Quest\00E3o n\00BA 1' ELSE 'Alternativa A' END, entity || operation || ' safe summary');
        expected_before := CASE WHEN operation = 'INSERT' THEN 'null'::jsonb
          ELSE to_jsonb(safe_text) END;
        IF operation = 'DELETE' THEN expected_before := to_jsonb(safe_text || ' changed'); END IF;
        expected_after := CASE WHEN operation = 'DELETE' THEN 'null'::jsonb
          WHEN operation = 'INSERT' THEN to_jsonb(safe_text) ELSE to_jsonb(safe_text || ' changed') END;
        PERFORM pg_temp.audit_assert(
          coalesce(event.metadata->'before'->content_key, 'null'::jsonb) = expected_before
          AND coalesce(event.metadata->'after'->content_key, 'null'::jsonb) = expected_after,
          entity || operation || ' content snapshots');
        SELECT coalesce(jsonb_object_agg(k, jsonb_build_object(
          'before', event.metadata->'before'->k, 'after', event.metadata->'after'->k)), '{}')
        INTO expected_diff
        FROM (SELECT jsonb_object_keys(nullif(event.metadata->'before', 'null')) AS k
              UNION SELECT jsonb_object_keys(nullif(event.metadata->'after', 'null'))) keys
        WHERE event.metadata->'before'->k IS DISTINCT FROM event.metadata->'after'->k;
        PERFORM pg_temp.audit_assert(event.metadata->'diff' = expected_diff
          AND event.metadata->'diff' ? content_key, entity || operation || ' exact diff');
        PERFORM pg_temp.audit_assert(NOT (coalesce(nullif(event.metadata->'after', 'null'),
          event.metadata->'before') ?| ARRAY['created_at', 'updated_at', 'actor_email', 'user_id', 'image_url']),
          entity || operation || ' no unrelated fields');
        IF operation = 'UPDATE' THEN
          PERFORM pg_temp.audit_assert(NOT (event.metadata->'diff' ? 'id'), entity || ' unchanged id omitted');
          IF n = 1 THEN
            PERFORM pg_temp.audit_assert(event.metadata->'diff'->'execution_window_end' =
              jsonb_build_object('before', now() + interval '1 hour', 'after', now() + interval '2 hours'),
              'execution window diff');
          ELSIF n = 2 THEN
            PERFORM pg_temp.audit_assert(event.metadata->'diff'->'explanation' =
              '{"before":null,"after":"Explanation"}'::jsonb, 'null to content diff');
          ELSIF n = 3 THEN
            PERFORM pg_temp.audit_assert(event.metadata->'diff'->'is_correct' =
              '{"before":true,"after":false}'::jsonb, 'answer key diff');
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- An audit insert failure must abort the content write, not pretend success.
SELECT set_config('request.jwt.claim.sub', pg_temp.audit_id('admin')::text, true);
ALTER TABLE public.admin_audit_log ADD CONSTRAINT fase0_audit_failure_probe
  CHECK (entity_id IS DISTINCT FROM md5('fase0-admin-audit:failure')::uuid) NOT VALID;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.simulados(id, title, slug, sequence_number,
      execution_window_start, execution_window_end, results_release_at)
    VALUES (pg_temp.audit_id('failure'), 'Must rollback', 'fase0-audit-failure', 987655,
      now(), now() + interval '1 hour', now() + interval '2 hours');
    RAISE EXCEPTION 'Expected audit failure';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM pg_temp.audit_assert(NOT EXISTS (SELECT FROM public.simulados
    WHERE id = pg_temp.audit_id('failure')), 'audit failure rolls back content');
END $$;

SELECT pg_temp.audit_assert(p.prosecdef AND p.prorettype = 'trigger'::regtype
  AND p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
  AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
  AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  AND NOT EXISTS (SELECT FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))
    WHERE grantee = 0 AND privilege_type = 'EXECUTE'), 'trigger signature, search_path and ACL')
FROM pg_proc p WHERE p.oid = 'public.tg_admin_audit()'::regprocedure;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.audit_id('reader')::text, true);
DO $$ BEGIN
  IF public.has_capability('audit.view') OR EXISTS (SELECT FROM public.admin_audit_log
    WHERE entity_id = pg_temp.audit_id('sim')) THEN
    RAISE EXCEPTION 'Reader without audit.view must not see content snapshots';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', pg_temp.audit_id('admin')::text, true);
DO $$ BEGIN
  IF NOT public.has_capability('audit.view') OR
     (SELECT count(*) FROM public.admin_audit_log WHERE entity_id IN
       (pg_temp.audit_id('sim'), pg_temp.audit_id('question'), pg_temp.audit_id('option'))) <> 9 THEN
    RAISE EXCEPTION 'audit.view admin must see all nine events';
  END IF;
END $$;
RESET ROLE;
SELECT count(*) AS passing_assertions FROM audit_checks;
SELECT 'PASS: audit.view reader denied, admin allowed' AS rls_checks;
ROLLBACK;
