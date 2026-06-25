DROP FUNCTION IF EXISTS public.admin_marketing_sources(integer);

CREATE OR REPLACE FUNCTION public.admin_marketing_sources(p_days integer DEFAULT 30)
 RETURNS TABLE(source text, user_count bigint, conv_rate numeric, signup_conv_pct numeric)
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
  with user_first_src as (
    select
      p.id,
      coalesce(
        (select nullif(ae.payload->>'utm_source', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_source' is not null
         order by ae.created_at asc limit 1),
        'organic'
      ) as source
    from profiles p
    where p.created_at >= v_start
      and not exists (select 1 from user_roles ur where ur.user_id = p.id)
  ),
  part as (
    select source, count(*)::bigint as user_count
    from user_first_src
    group by source
  ),
  visits_src as (
    select
      coalesce(nullif(payload->>'utm_source', ''), 'organic') as source,
      count(distinct coalesce(user_id::text, payload->>'session_id')) as visits,
      count(distinct case when user_id is not null and exists (
              select 1 from profiles p where p.id = analytics_events.user_id and p.created_at >= v_start)
            then user_id end) as signups_cohort
    from analytics_events
    where event_name = 'landing_page_viewed' and created_at >= v_start
    group by 1
  )
  select
    pa.source,
    pa.user_count,
    round(pa.user_count::numeric / nullif(v_total, 0) * 100, 1) as conv_rate,
    case when vs.visits > 0
         then least(100, greatest(0, round(vs.signups_cohort::numeric / vs.visits * 100, 1)))
         else null end as signup_conv_pct
  from part pa
  left join visits_src vs on vs.source = pa.source
  order by pa.user_count desc
  limit 8;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_marketing_sources(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_sources(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_sources(integer) TO authenticated, service_role;
