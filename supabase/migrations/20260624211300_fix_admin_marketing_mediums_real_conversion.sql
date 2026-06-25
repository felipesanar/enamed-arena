DROP FUNCTION IF EXISTS public.admin_marketing_mediums(integer);

CREATE OR REPLACE FUNCTION public.admin_marketing_mediums(p_days integer DEFAULT 30)
 RETURNS TABLE(medium text, user_count bigint, conv_rate numeric, signup_conv_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
  v_total bigint;
begin
  perform public.admin_require('intel.view');

  select count(*) into v_total
  from profiles p
  where p.created_at >= v_start
    and not exists (select 1 from user_roles ur where ur.user_id = p.id);

  return query
  with user_first_med as (
    select
      p.id,
      coalesce(
        (select nullif(ae.payload->>'utm_medium', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_medium' is not null
         order by ae.created_at asc limit 1),
        '(nenhum)'
      ) as medium
    from profiles p
    where p.created_at >= v_start
      and not exists (select 1 from user_roles ur where ur.user_id = p.id)
  ),
  part as (
    select medium, count(*)::bigint as user_count
    from user_first_med
    group by medium
  ),
  visits_med as (
    select
      coalesce(nullif(payload->>'utm_medium', ''), '(nenhum)') as medium,
      count(distinct coalesce(user_id::text, payload->>'session_id')) as visits,
      count(distinct case when user_id is not null and exists (
              select 1 from profiles p where p.id = analytics_events.user_id and p.created_at >= v_start)
            then user_id end) as signups_cohort
    from analytics_events
    where event_name = 'landing_page_viewed' and created_at >= v_start
    group by 1
  )
  select
    pa.medium,
    pa.user_count,
    round(pa.user_count::numeric / nullif(v_total, 0) * 100, 1) as conv_rate,
    case when vm.visits > 0
         then least(100, greatest(0, round(vm.signups_cohort::numeric / vm.visits * 100, 1)))
         else null end as signup_conv_pct
  from part pa
  left join visits_med vm on vm.medium = pa.medium
  order by pa.user_count desc
  limit 8;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_marketing_mediums(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_mediums(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_mediums(integer) TO authenticated, service_role;
