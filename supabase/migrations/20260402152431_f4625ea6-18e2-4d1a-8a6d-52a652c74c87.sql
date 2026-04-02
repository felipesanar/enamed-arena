CREATE TABLE public.sso_rate_limit (
  email text PRIMARY KEY,
  attempts int DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

ALTER TABLE public.sso_rate_limit ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service role can access