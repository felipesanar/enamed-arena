-- Aplicada em PROD via MCP em 2026-08-04.
--
-- Fecha os WARN `anon_security_definer_function_executable` (eram 31).
-- Regra do projeto: sem acesso anônimo. As RPCs SECURITY DEFINER dependem de
-- auth.uid() e só fazem sentido com sessão; anon não deve poder invocá-las.
--
-- Precisa revogar de PUBLIC também: o ACL tem `=X/postgres` (grant a PUBLIC),
-- então revogar só de `anon` não tira o privilégio. `authenticated` e
-- `service_role` têm grant explícito e continuam intactos.
--
-- Exceções mantidas para anon (verificadas):
--   log_analytics_event / log_analytics_events → telemetria dispara antes do
--     login (src/main.tsx manda apikey anon quando não há access_token).
--   has_role → avaliada dentro de policy de RLS; o role que consulta precisa
--     de EXECUTE.
--
-- Funções de trigger perdem anon E authenticated: o privilégio de EXECUTE é
-- checado na criação da trigger (contra o dono da tabela), não a cada disparo.
do $$
declare
  f record;
  n_trigger int := 0;
  n_anon int := 0;
begin
  for f in
    select p.oid, p.oid::regprocedure::text as sig, p.prorettype = 'pg_catalog.trigger'::regtype as is_trigger
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosecdef
      and p.proname not in ('log_analytics_event', 'log_analytics_events', 'has_role')
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    if f.is_trigger then
      execute format('revoke all on function %s from public, anon, authenticated', f.sig);
      n_trigger := n_trigger + 1;
    else
      execute format('revoke all on function %s from public, anon', f.sig);
      n_anon := n_anon + 1;
    end if;
  end loop;

  raise notice 'triggers hardened: %, rpcs revogadas de anon: %', n_trigger, n_anon;
end $$;
