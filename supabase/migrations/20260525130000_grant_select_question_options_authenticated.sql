-- =====================================================================
-- Concede SELECT em question_options para o role `authenticated`
-- =====================================================================
-- O projeto remoto estava com SELECT apenas para `anon` e `service_role`,
-- mas não para `authenticated`. Sem o grant a nível de tabela, qualquer
-- SELECT autenticado falha com 42501 (permission denied) antes mesmo da
-- RLS ser avaliada.
--
-- A RLS já filtra corretamente (só options de simulados published/test),
-- então conceder SELECT a authenticated não afrouxa segurança, apenas
-- destrava o caminho que a RLS já controla.
-- =====================================================================

GRANT SELECT ON public.question_options TO authenticated;
