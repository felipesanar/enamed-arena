DROP FUNCTION IF EXISTS public.admin_analytics_time_to_convert(integer);

CREATE OR REPLACE FUNCTION public.admin_analytics_time_to_convert(p_days integer DEFAULT 30)
 RETURNS TABLE(
   landing_to_signup_min numeric,
   signup_to_onboarding_min numeric,
   onboarding_to_first_exam_days numeric,
   first_to_second_exam_days numeric,
   landing_to_signup_n bigint,
   landing_to_signup_insufficient boolean,
   first_to_second_exam_days_p90 numeric,
   first_to_second_exam_n bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
  v_min_sample constant int := 5;
  v_ls_n bigint;
  v_ls_median numeric;
  v_f2s_n bigint;
  v_f2s_p50 numeric;
  v_f2s_p90 numeric;
begin
  perform public.admin_require('intel.view');

  select count(*),
         percentile_cont(0.5) within group (order by extract(epoch from (p.created_at - ae.created_at)) / 60)
    into v_ls_n, v_ls_median
  from analytics_events ae
  join profiles p on p.id = ae.user_id
  where ae.event_name = 'landing_page_viewed'
    and ae.user_id is not null
    and ae.created_at >= v_start
    and p.created_at >= v_start
    and extract(epoch from (p.created_at - ae.created_at)) between 0 and 3600;

  select count(*),
         percentile_cont(0.5) within group (order by extract(epoch from (s.created_at - f.created_at)) / 86400),
         percentile_cont(0.9) within group (order by extract(epoch from (s.created_at - f.created_at)) / 86400)
    into v_f2s_n, v_f2s_p50, v_f2s_p90
  from (
    select user_id, created_at,
           row_number() over (partition by user_id order by created_at) as rn
    from attempts
    where status = 'submitted' and is_within_window = true
  ) f
  join (
    select user_id, created_at,
           row_number() over (partition by user_id order by created_at) as rn
    from attempts
    where status = 'submitted' and is_within_window = true
  ) s on s.user_id = f.user_id and f.rn = 1 and s.rn = 2
  where f.created_at >= v_start;

  return query
  select
    case when coalesce(v_ls_n,0) < v_min_sample then -1::numeric
         else round(v_ls_median::numeric, 1) end,
    coalesce(round((
      select percentile_cont(0.5) within group (
        order by extract(epoch from (op.completed_at - p.created_at)) / 60
      )
      from onboarding_profiles op
      join profiles p on p.id = op.user_id
      where op.completed_at >= v_start
        and op.completed_at is not null
        and op.completed_at > p.created_at
    )::numeric, 1), 0),
    coalesce(round((
      select percentile_cont(0.5) within group (
        order by extract(epoch from (a.created_at - op.completed_at)) / 86400
      )
      from (
        select user_id, min(created_at) as created_at
        from attempts
        where status = 'submitted' and is_within_window = true
        group by user_id
      ) a
      join onboarding_profiles op on op.user_id = a.user_id
      where op.completed_at is not null
        and a.created_at >= v_start
        and a.created_at > op.completed_at
    )::numeric, 1), 0),
    case when coalesce(v_f2s_n,0) = 0 then 0::numeric else round(v_f2s_p50, 1) end,
    coalesce(v_ls_n, 0)::bigint,
    (coalesce(v_ls_n,0) < v_min_sample),
    case when coalesce(v_f2s_n,0) = 0 then 0::numeric else round(v_f2s_p90, 1) end,
    coalesce(v_f2s_n, 0)::bigint;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_analytics_time_to_convert(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_time_to_convert(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_time_to_convert(integer) TO authenticated, service_role;
