DROP FUNCTION IF EXISTS public.admin_marketing_kpis(integer);

CREATE OR REPLACE FUNCTION public.admin_marketing_kpis(p_days integer DEFAULT 30)
 RETURNS TABLE(new_users bigint, new_users_prev bigint, landing_to_signup_pct numeric, active_campaigns bigint, organic_pct numeric, landing_to_signup_insufficient boolean, organic_low_confidence boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start          timestamptz := now() - (p_days || ' days')::interval;
  v_prev_start     timestamptz := now() - (p_days * 2 || ' days')::interval;
  v_landing_visits bigint;
  v_identified     bigint;
  v_cohort_signups bigint;
  v_insufficient   boolean;
begin
  perform public.admin_require('intel.view');

  select count(distinct coalesce(user_id::text, payload->>'session_id'))
    into v_landing_visits
  from analytics_events
  where event_name = 'landing_page_viewed' and created_at >= v_start;

  select count(distinct user_id) into v_identified
  from analytics_events
  where event_name = 'landing_page_viewed' and created_at >= v_start and user_id is not null;

  select count(distinct ae.user_id) into v_cohort_signups
  from analytics_events ae
  where ae.event_name = 'landing_page_viewed'
    and ae.created_at >= v_start
    and ae.user_id is not null
    and exists (select 1 from profiles p where p.id = ae.user_id and p.created_at >= v_start);

  v_insufficient := (v_identified < 30);

  return query
  select
    (select count(*)::bigint from profiles where created_at >= v_start),
    (select count(*)::bigint from profiles where created_at >= v_prev_start and created_at < v_start),
    case when v_insufficient then -1::numeric
         when v_landing_visits > 0
           then least(100, greatest(0, round(v_cohort_signups::numeric / v_landing_visits * 100, 1)))
         else -1::numeric end,
    (select count(distinct payload->>'utm_campaign')
     from analytics_events
     where created_at >= v_start
       and payload->>'utm_campaign' is not null
       and payload->>'utm_campaign' != '')::bigint,
    coalesce(round(
      (select count(*)::numeric from profiles p
       where p.created_at >= v_start
         and not exists (
           select 1 from analytics_events ae
           where ae.user_id = p.id
             and ae.created_at >= v_start
             and ae.payload->>'utm_source' is not null
             and ae.payload->>'utm_source' != ''
         ))
      / nullif((select count(*) from profiles where created_at >= v_start)::numeric, 0) * 100,
    1), 0),
    v_insufficient,
    (v_identified < 30);
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_marketing_kpis(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_kpis(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_kpis(integer) TO authenticated, service_role;
