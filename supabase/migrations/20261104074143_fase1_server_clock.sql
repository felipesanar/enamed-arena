begin;
create or replace function public.get_server_time()
returns timestamptz
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select current_timestamp; $$;

revoke all on function public.get_server_time() from public, anon;
grant execute on function public.get_server_time() to authenticated;
commit;

-- Rollback (only after rolling back clients that call this RPC):
-- begin;
-- drop function if exists public.get_server_time();
-- commit;
