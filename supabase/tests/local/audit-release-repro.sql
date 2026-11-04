-- Expected failure on the unmodified captured tg_admin_audit().
-- Run only against a restored disposable LOCAL catalog; disconnect rolls back.
\ir guard.sql
BEGIN;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
INSERT INTO public.simulados(id, title, slug, sequence_number, status,
  questions_count, duration_minutes, execution_window_start,
  execution_window_end, results_release_at)
VALUES ('e3cb2435-b509-4500-bbf1-e166b551b640', 'Local audit repro',
  'local-audit-release-repro', 990001, 'published', 1, 60,
  now() - interval '1 hour', now() + interval '1 hour', now() + interval '2 hours');
-- RESET ROLE in T2 retains JWT claims; this is also a valid identified session.
SELECT set_config('request.jwt.claim.sub', 'e3cb2435-b509-4500-bbf1-e166b551b641', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e3cb2435-b509-4500-bbf1-e166b551b641","role":"authenticated"}', true);
UPDATE public.simulados SET results_release_at=now()
WHERE id='e3cb2435-b509-4500-bbf1-e166b551b640';
ROLLBACK;
