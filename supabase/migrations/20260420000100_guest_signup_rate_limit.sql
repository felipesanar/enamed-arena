-- =====================================================================
-- Guest signup rate-limit table (2026-04-20)
-- =====================================================================
-- Backs the authorization gate added to create-guest-account edge function.
-- Tracks attempts per IP hash AND per email hash over a rolling window.
-- Only service_role touches this table (edge function uses service key).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.guest_signup_rate_limit (
  bucket_type text NOT NULL, -- 'ip' | 'email'
  bucket_key  text NOT NULL, -- sha256 hash of ip or email
  attempts    int  NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_type, bucket_key)
);

ALTER TABLE public.guest_signup_rate_limit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.guest_signup_rate_limit FROM authenticated, anon;

DROP POLICY IF EXISTS "Service role manages guest_signup_rate_limit" ON public.guest_signup_rate_limit;
CREATE POLICY "Service role manages guest_signup_rate_limit"
  ON public.guest_signup_rate_limit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper: atomically increment a bucket and return its current attempt count.
-- If the window has expired, it resets. Returns the post-increment attempts
-- value so the edge function can short-circuit without a second roundtrip.
CREATE OR REPLACE FUNCTION public.bump_guest_signup_bucket(
  p_bucket_type text,
  p_bucket_key  text,
  p_window_ms   int DEFAULT 3600000 -- 1h default
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_attempts int;
  v_window_start timestamptz;
  v_window_interval interval := make_interval(secs => p_window_ms / 1000);
BEGIN
  INSERT INTO public.guest_signup_rate_limit (bucket_type, bucket_key, attempts, window_start, last_event_at)
  VALUES (p_bucket_type, p_bucket_key, 1, v_now, v_now)
  ON CONFLICT (bucket_type, bucket_key) DO UPDATE
  SET
    attempts = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN 1
      ELSE guest_signup_rate_limit.attempts + 1
    END,
    window_start = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN v_now
      ELSE guest_signup_rate_limit.window_start
    END,
    last_event_at = v_now
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_guest_signup_bucket(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_guest_signup_bucket(text, text, int) TO service_role;
