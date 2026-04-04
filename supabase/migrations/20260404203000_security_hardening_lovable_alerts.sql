-- Security hardening for Lovable findings:
-- 1) Prevent authenticated users from reading question_options.is_correct
-- 2) Enforce attempt ownership on attempt_processing_queue INSERT
-- 3) Harden sso_rate_limit access and remove raw email storage

BEGIN;

-- Ensure hashing helpers are available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- question_options: keep options readable but hide answer key column.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON TABLE public.question_options FROM authenticated;
GRANT SELECT (id, question_id, label, text, created_at) ON TABLE public.question_options TO authenticated;

-- Keep readable options scoped to published simulados only.
DROP POLICY IF EXISTS "Anyone can read options" ON public.question_options;
CREATE POLICY "Authenticated can read options from published simulados"
  ON public.question_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.questions q
      JOIN public.simulados s ON s.id = q.simulado_id
      WHERE q.id = question_options.question_id
        AND s.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- attempt_processing_queue: require ownership of the target attempt_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can enqueue own attempts" ON public.attempt_processing_queue;
CREATE POLICY "Users can enqueue own attempts"
  ON public.attempt_processing_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.attempts a
      WHERE a.id = attempt_processing_queue.attempt_id
        AND a.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- sso_rate_limit: explicit policy + hashed identifier only (no raw email).
-- ---------------------------------------------------------------------------
ALTER TABLE public.sso_rate_limit
  ADD COLUMN IF NOT EXISTS email_hash text;

UPDATE public.sso_rate_limit
SET email_hash = encode(digest(lower(trim(email)), 'sha256'), 'hex')
WHERE email_hash IS NULL;

ALTER TABLE public.sso_rate_limit
  ALTER COLUMN email_hash SET NOT NULL;

ALTER TABLE public.sso_rate_limit
  DROP CONSTRAINT IF EXISTS sso_rate_limit_pkey;

ALTER TABLE public.sso_rate_limit
  ADD CONSTRAINT sso_rate_limit_pkey PRIMARY KEY (email_hash);

ALTER TABLE public.sso_rate_limit
  DROP COLUMN IF EXISTS email;

REVOKE ALL ON TABLE public.sso_rate_limit FROM authenticated;
REVOKE ALL ON TABLE public.sso_rate_limit FROM anon;

DROP POLICY IF EXISTS "Service role manages sso_rate_limit" ON public.sso_rate_limit;
CREATE POLICY "Service role manages sso_rate_limit"
  ON public.sso_rate_limit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
