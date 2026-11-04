-- Static finding, NOT yet reproduced in the server during this job.
-- Run ONLY in a new empty enamed_test_* database through the pinned endpoint.
-- Expected failure: duplicate trigger update_user_performance_summary_updated_at
-- in 20260326170737 after 20260326143000. ON_ERROR_STOP must not be disabled.
\set ON_ERROR_STOP on
\ir guard.sql
\ir preflight.sql
BEGIN;
\ir bootstrap.sql
\ir ../../migrations/20260314011304_f5e3f953-d055-4ac4-b3c0-69c83545001d.sql
\ir ../../migrations/20260314011315_ff0e1b23-8ddc-4b88-8556-a987b26d4dbe.sql
\ir ../../migrations/20260314025358_2829182c-599f-4686-87f6-ed1d594eb8ea.sql
\ir ../../migrations/20260314025523_e583c9f0-963b-4c14-8622-0ca37e69c343.sql
\ir ../../migrations/20260314025955_720dcb18-5b84-4ef5-89c7-3b13155c6cbb.sql
\ir ../../migrations/20260314031214_d3842f30-8070-4f3c-9a02-7fed6c58b99a.sql
\ir ../../migrations/20260320132352_e2a30d2d-18a4-45b7-905b-c29eb553a46b.sql
\ir ../../migrations/20260326143000_server_side_exam_finalization_and_performance.sql
\ir ../../migrations/20260326152000_attempt_results_and_reprocessing_queue.sql
\ir ../../migrations/20260326162000_enforce_windows_and_onboarding_rules.sql
\ir ../../migrations/20260326170737_195942cb-4eaa-4693-8eb4-4f86564529ff.sql
ROLLBACK;
