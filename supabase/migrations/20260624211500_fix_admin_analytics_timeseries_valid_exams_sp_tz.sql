DROP FUNCTION IF EXISTS public.admin_analytics_timeseries(integer);

CREATE OR REPLACE FUNCTION public.admin_analytics_timeseries(p_days integer DEFAULT 56)
 RETURNS TABLE(week_start date, new_users bigint, first_exams bigint, started_attempts bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
begin
  perform public.admin_require('intel.view');

  return query
  with weeks as (
    select generate_series(
      date_trunc('week', (v_start at time zone 'America/Sao_Paulo')),
      date_trunc('week', (now()   at time zone 'America/Sao_Paulo')),
      '1 week'::interval
    )::date as w
  ),
  reg as (
    select date_trunc('week', (created_at at time zone 'America/Sao_Paulo'))::date as w, count(*) as cnt
    from profiles
    where created_at >= v_start
    group by 1
  ),
  first_att as (
    select date_trunc('week', (min_created at time zone 'America/Sao_Paulo'))::date as w, count(*) as cnt
    from (
      select user_id, min(created_at) as min_created
      from attempts
      where status = 'submitted'
        and is_within_window = true
        and created_at >= v_start
      group by user_id
    ) sub
    group by 1
  ),
  started as (
    select date_trunc('week', (created_at at time zone 'America/Sao_Paulo'))::date as w, count(*) as cnt
    from attempts
    where created_at >= v_start
    group by 1
  )
  select
    weeks.w,
    coalesce(reg.cnt, 0)::bigint,
    coalesce(first_att.cnt, 0)::bigint,
    coalesce(started.cnt, 0)::bigint
  from weeks
  left join reg       on reg.w = weeks.w
  left join first_att on first_att.w = weeks.w
  left join started   on started.w = weeks.w
  order by weeks.w;
end;
$function$;

-- Restaura os grants que o DROP removeu (proacl vivo: authenticated=X, service_role=X).
-- Sem isto a paginá Analytics quebra com 'permission denied for function'.
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(integer) TO authenticated, service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(integer) TO authenticated, service_role;
