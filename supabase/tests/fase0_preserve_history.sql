-- Run only against a disposable local DB after applying migrations. No extensions required.
-- All fixtures and JWT settings are rolled back; never run this in production.
BEGIN;

DO $$
DECLARE
  item record;
  fk record;
  child_id uuid := gen_random_uuid();
  parent_id uuid := gen_random_uuid();
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('attempts', 'attempts_simulado_id_fkey', 'simulados', 'simulado_id'),
    ('user_performance_history', 'user_performance_history_simulado_id_fkey', 'simulados', 'simulado_id'),
    ('answers', 'answers_question_id_fkey', 'questions', 'question_id'),
    ('attempt_question_results', 'attempt_question_results_question_id_fkey', 'questions', 'question_id')
  ) AS required(child_table, constraint_name, parent_table, column_name)
  LOOP
    SELECT c.*, pg_get_constraintdef(c.oid) AS definition INTO fk
    FROM pg_constraint c
    WHERE c.conrelid = format('public.%I', item.child_table)::regclass
      AND c.conname = item.constraint_name AND c.contype = 'f';
    IF NOT FOUND OR fk.confdeltype <> 'r' OR NOT fk.convalidated OR fk.condeferrable
      OR fk.confrelid <> format('public.%I', item.parent_table)::regclass
      OR fk.conkey <> ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = fk.conrelid AND attname = item.column_name)]::smallint[] THEN
      RAISE EXCEPTION 'Missing immediate validated RESTRICT FK: %', item.constraint_name;
    END IF;

    -- Exercise the exact catalog definition in isolated fixtures, without bypassing
    -- auth/attempt guards or depending on preexisting users and production data.
    CREATE TEMP TABLE preserve_parent (id uuid PRIMARY KEY) ON COMMIT DROP;
    EXECUTE format('CREATE TEMP TABLE preserve_child (id uuid PRIMARY KEY, %I uuid) ON COMMIT DROP', item.column_name);
    EXECUTE format('ALTER TABLE preserve_child ADD %s',
      regexp_replace(fk.definition, 'REFERENCES (public\.)?' || item.parent_table || '\(id\)', 'REFERENCES pg_temp.preserve_parent(id)'));
    INSERT INTO preserve_parent VALUES (parent_id);
    EXECUTE format('INSERT INTO preserve_child (id, %I) VALUES ($1, $2)', item.column_name) USING child_id, parent_id;
    BEGIN
      DELETE FROM preserve_parent WHERE id = parent_id;
      RAISE EXCEPTION 'Deletion unexpectedly succeeded for %', item.constraint_name;
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    IF (SELECT count(*) FROM preserve_parent) <> 1 OR (SELECT count(*) FROM preserve_child) <> 1 THEN
      RAISE EXCEPTION 'History lost for %', item.constraint_name;
    END IF;
    DROP TABLE preserve_child;
    DROP TABLE preserve_parent;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attempt_question_results' AND column_name = 'simulado_id') THEN
    RAISE EXCEPTION 'Unexpected redundant attempt_question_results.simulado_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.attempt_question_results'::regclass
    AND conname = 'attempt_question_results_attempt_id_fkey' AND confrelid = 'public.attempts'::regclass) THEN
    RAISE EXCEPTION 'Missing attempt_question_results path through attempts';
  END IF;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.admin_simulado_attempt_counts(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute counts RPC';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_simulado_attempt_counts(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated needs gated counts RPC';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM * FROM public.admin_simulado_attempt_counts();
    RAISE EXCEPTION 'Unauthenticated counts unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  BEGIN
    PERFORM * FROM public.admin_simulado_attempt_counts();
    RAISE EXCEPTION 'Counts without capability unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
