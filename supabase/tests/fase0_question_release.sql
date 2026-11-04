-- Disposable local database only, after migrations; run with ON_ERROR_STOP.
-- No extensions. All schema changes, users, claims and fixtures roll back.
BEGIN;

DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.questions', 'explanation', 'SELECT')
    OR has_column_privilege('authenticated', 'public.questions', 'explanation_image_url', 'SELECT')
    OR has_column_privilege('authenticated', 'public.question_options', 'is_correct', 'SELECT')
    OR has_column_privilege('anon', 'public.questions', 'explanation', 'SELECT')
    OR has_column_privilege('anon', 'public.question_options', 'is_correct', 'SELECT') THEN
    RAISE EXCEPTION 'Restricted column SELECT leaked';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.questions', 'text', 'SELECT')
    OR NOT has_column_privilege('authenticated', 'public.question_options', 'text', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.questions', 'SELECT') THEN
    RAISE EXCEPTION 'Public/server reads broken';
  END IF;
  IF has_function_privilege('anon', 'public.get_question_explanations(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.get_question_explanations(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Wrong correction RPC ACL';
  END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('81000000-0000-0000-0000-000000000001', 'fase0-release-owner@example.invalid'),
  ('81000000-0000-0000-0000-000000000002', 'fase0-release-other@example.invalid'),
  ('81000000-0000-0000-0000-000000000003', 'fase0-release-admin@example.invalid');
INSERT INTO public.user_roles (user_id, role)
VALUES ('81000000-0000-0000-0000-000000000003', 'content_editor');
INSERT INTO public.role_capabilities (role, capability) VALUES ('content_editor', 'content.manage')
ON CONFLICT DO NOTHING;

-- Exercise fail-closed NULL gates even on installations with NOT NULL dates.
ALTER TABLE public.simulados ALTER COLUMN results_release_at DROP NOT NULL;
ALTER TABLE public.simulados ALTER COLUMN execution_window_start DROP NOT NULL;
INSERT INTO public.simulados (id, title, slug, sequence_number, status,
  execution_window_start, execution_window_end, results_release_at) VALUES
  ('82000000-0000-0000-0000-000000000001', 'Released', 'fase0-release-1', 9101, 'published', now()-interval '2 days', now()-interval '1 day', now()-interval '1 hour'),
  ('82000000-0000-0000-0000-000000000002', 'Not released', 'fase0-release-2', 9102, 'published', now()-interval '1 day', now()+interval '1 day', now()+interval '2 days'),
  ('82000000-0000-0000-0000-000000000003', 'Upcoming', 'fase0-release-3', 9103, 'published', now()+interval '1 day', now()+interval '2 days', now()+interval '3 days'),
  ('82000000-0000-0000-0000-000000000004', 'Null release', 'fase0-release-4', 9104, 'published', now()-interval '1 day', now()+interval '1 day', NULL),
  ('82000000-0000-0000-0000-000000000005', 'Null start', 'fase0-release-5', 9105, 'published', NULL, now()+interval '1 day', now()-interval '1 hour'),
  ('82000000-0000-0000-0000-000000000006', 'Draft', 'fase0-release-6', 9106, 'draft', now()-interval '2 days', now()-interval '1 day', now()-interval '1 hour');
INSERT INTO public.questions (id, simulado_id, question_number, text, area, theme, explanation, explanation_image_url)
SELECT ('83000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('82000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  1, 'Fixture question', 'CM', 'Fixture', 'Released comment', 'https://x.supabase.co/comment.png'
FROM generate_series(1, 6) n;
INSERT INTO public.question_options (id, question_id, label, text, is_correct)
SELECT ('84000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('83000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'A', 'Answer', true
FROM generate_series(1, 6) n;
INSERT INTO public.attempts (simulado_id, user_id, status, effective_deadline, finished_at)
SELECT ('82000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  '81000000-0000-0000-0000-000000000001', 'submitted', now()-interval '1 hour', now()-interval '1 hour'
FROM generate_series(1, 6) n;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(id) INTO n FROM public.questions
    WHERE simulado_id IN ('82000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000006');
  IF n <> 0 THEN RAISE EXCEPTION 'Upcoming/null-start/draft question leaked'; END IF;
  SELECT count(id) INTO n FROM public.question_options
    WHERE question_id IN ('83000000-0000-0000-0000-000000000003', '83000000-0000-0000-0000-000000000005', '83000000-0000-0000-0000-000000000006');
  IF n <> 0 THEN RAISE EXCEPTION 'Upcoming/null-start/draft option leaked'; END IF;
  SELECT count(id) INTO n FROM public.questions WHERE simulado_id = '82000000-0000-0000-0000-000000000002';
  IF n <> 1 THEN RAISE EXCEPTION 'Started exam not readable'; END IF;
  BEGIN
    PERFORM explanation FROM public.questions;
    RAISE EXCEPTION 'Direct explanation read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM explanation_image_url FROM public.questions;
    RAISE EXCEPTION 'Direct explanation image read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM is_correct FROM public.question_options;
    RAISE EXCEPTION 'Direct answer key read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM public.get_question_explanations('82000000-0000-0000-0000-000000000001')
    WHERE explanation = 'Released comment' AND correct_option_id = '84000000-0000-0000-0000-000000000001'
      AND explanation_image_url = 'https://x.supabase.co/comment.png') <> 1 THEN
    RAISE EXCEPTION 'Released correction missing';
  END IF;
  FOR n IN 2..6 LOOP
    IF EXISTS (SELECT 1 FROM public.get_question_explanations(
      ('82000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid)) THEN
      RAISE EXCEPTION 'Unreleased correction leaked: %', n;
    END IF;
  END LOOP;
END $$;

-- A different user cannot use the owner's submitted attempt.
SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.get_question_explanations('82000000-0000-0000-0000-000000000001')) THEN
    RAISE EXCEPTION 'Another user attempt authorized correction';
  END IF;
END $$;

-- An in-progress attempt is not a finalized attempt, even after release.
RESET ROLE;
INSERT INTO public.attempts (simulado_id, user_id, status, effective_deadline)
VALUES ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'in_progress', now()+interval '1 hour');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.get_question_explanations('82000000-0000-0000-0000-000000000001')) THEN
    RAISE EXCEPTION 'In-progress attempt authorized correction';
  END IF;
END $$;

-- Admin bypasses temporal gates via capability, never by REST column grants.
SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
DO $$
BEGIN
  IF NOT public.has_capability('content.manage') THEN RAISE EXCEPTION 'Invalid admin fixture'; END IF;
  IF (SELECT count(id) FROM public.questions WHERE simulado_id = '82000000-0000-0000-0000-000000000006') <> 1 THEN
    RAISE EXCEPTION 'Admin draft read broken';
  END IF;
  IF (SELECT count(*) FROM public.get_question_explanations('82000000-0000-0000-0000-000000000003')) <> 1 THEN
    RAISE EXCEPTION 'Admin correction bypass broken';
  END IF;
  IF (SELECT count(*) FROM public.admin_get_simulado_questions('82000000-0000-0000-0000-000000000006')
      WHERE explanation = 'Released comment' AND (options->0->>'is_correct')::boolean) <> 1 THEN
    RAISE EXCEPTION 'Admin export RPC broken';
  END IF;
  BEGIN
    PERFORM is_correct FROM public.question_options;
    RAISE EXCEPTION 'Admin REST still has restricted column access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Missing auth.uid() is rejected even if the connection can execute the RPC.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.get_question_explanations('82000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Missing UID accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.get_question_explanations('82000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Anon execute accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
