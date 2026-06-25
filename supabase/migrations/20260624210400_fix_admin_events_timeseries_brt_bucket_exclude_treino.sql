DROP FUNCTION IF EXISTS public.admin_events_timeseries(integer);

CREATE OR REPLACE FUNCTION public.admin_events_timeseries(p_days integer DEFAULT 7)
 RETURNS TABLE(day date, new_users bigint, exams_started bigint, exams_completed bigint, offline_pending bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tz        text := 'America/Sao_Paulo';
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
begin
  perform public.admin_require('dashboard.view');

  return query
  with days as (
    select generate_series(
      date_trunc('day', v_cur_start at time zone v_tz),
      date_trunc('day', now()      at time zone v_tz),
      '1 day'::interval
    )::date as d
  ),
  reg as (
    select date_trunc('day', created_at at time zone v_tz)::date as d, count(*) as cnt
    from profiles where created_at >= v_cur_start group by 1
  ),
  started as (
    select date_trunc('day', created_at at time zone v_tz)::date as d, count(*) as cnt
    from attempts where created_at >= v_cur_start group by 1
  ),
  completed as (
    select date_trunc('day', finished_at at time zone v_tz)::date as d, count(*) as cnt
    from attempts where finished_at >= v_cur_start and status = 'submitted' and is_within_window = true group by 1
  ),
  pending as (
    select date_trunc('day', created_at at time zone v_tz)::date as d, count(*) as cnt
    from attempts where created_at >= v_cur_start and status = 'offline_pending' and is_within_window = true group by 1
  )
  select
    days.d,
    coalesce(reg.cnt, 0)::bigint,
    coalesce(started.cnt, 0)::bigint,
    coalesce(completed.cnt, 0)::bigint,
    coalesce(pending.cnt, 0)::bigint
  from days
  left join reg       on reg.d = days.d
  left join started   on started.d = days.d
  left join completed on completed.d = days.d
  left join pending   on pending.d = days.d
  order by days.d;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_events_timeseries(integer) TO authenticated, service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_events_timeseries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_events_timeseries(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_events_timeseries(integer) TO authenticated, service_role;
