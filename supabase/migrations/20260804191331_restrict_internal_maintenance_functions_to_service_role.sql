-- Aplicada em PROD via MCP em 2026-08-04.
--
-- Funções internas: não são chamadas pelo client (verificado em src/ e
-- supabase/functions/). São invocadas de dentro de RPCs SECURITY DEFINER
-- (finalize_attempt_with_results, save_onboarding_guarded), onde a checagem de
-- privilégio é feita contra o dono (postgres), ou pelo service_role.
-- Mesmo padrão de 20260420000100_guest_signup_rate_limit.sql.
--
-- NÃO inclui enqueue_attempt_reprocessing: essa é chamada pelo client
-- (src/services/simuladosApi.ts:550) e precisa continuar com `authenticated`.
revoke all on function public.is_any_simulado_window_open(timestamptz) from public, anon, authenticated;
revoke all on function public.recalculate_user_performance(uuid) from public, anon, authenticated;
revoke all on function public.process_attempt_reprocessing_queue(integer) from public, anon, authenticated;

grant execute on function public.is_any_simulado_window_open(timestamptz) to service_role;
grant execute on function public.recalculate_user_performance(uuid) to service_role;
grant execute on function public.process_attempt_reprocessing_queue(integer) to service_role;
