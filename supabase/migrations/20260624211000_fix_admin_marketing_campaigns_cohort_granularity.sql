DROP FUNCTION IF EXISTS public.admin_marketing_campaigns(integer);

CREATE OR REPLACE FUNCTION public.admin_marketing_campaigns(p_days integer DEFAULT 30)
 RETURNS TABLE(campaign text, source text, visits bigint, signups bigint, conv_rate numeric, first_exams bigint, started_exams bigint, insufficient_data boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
  v_identified bigint;
begin
  perform public.admin_require('intel.view');

  select count(distinct ae.user_id) into v_identified
  from analytics_events ae
  where ae.event_name = 'landing_page_viewed'
    and ae.created_at >= v_start
    and ae.user_id is not null;

  return query
  with landing as (
    select
      coalesce(nullif(payload->>'utm_campaign', ''), '(sem campanha)') as campaign,
      coalesce(nullif(payload->>'utm_source', ''),   'organic')        as source,
      user_id,
      coalesce(user_id::text, payload->>'session_id')                  as visitor_key
    from analytics_events
    where event_name = 'landing_page_viewed'
      and created_at >= v_start
  ),
  camp_visits as (
    select campaign, source, count(distinct visitor_key) as visits
    from landing
    group by 1, 2
  ),
  landing_users as (
    select distinct campaign, source, user_id
    from landing
    where user_id is not null
      and not exists (select 1 from user_roles ur where ur.user_id = landing.user_id)
  ),
  camp_signups as (
    select
      lu.campaign,
      lu.source,
      count(distinct case when p.created_at >= v_start then p.id end)                      as signups,
      count(distinct case when fe_valid.user_id is not null then p.id end)                 as first_exams,
      count(distinct case when fe_any.user_id   is not null then p.id end)                 as started_exams
    from landing_users lu
    join profiles p on p.id = lu.user_id
    left join (select user_id from attempts where is_within_window = true group by user_id) fe_valid
      on fe_valid.user_id = lu.user_id
    left join (select user_id from attempts group by user_id) fe_any
      on fe_any.user_id = lu.user_id
    group by 1, 2
  )
  select
    coalesce(cv.campaign, cs.campaign, '(sem campanha)')              as campaign,
    coalesce(cv.source,   cs.source,   'organic')                     as source,
    coalesce(cv.visits, 0)::bigint                                    as visits,
    coalesce(cs.signups, 0)::bigint                                   as signups,
    case when coalesce(cv.visits, 0) > 0
         then least(100, greatest(0, round(coalesce(cs.signups,0)::numeric / cv.visits * 100, 1)))
         else null end                                               as conv_rate,
    coalesce(cs.first_exams, 0)::bigint                               as first_exams,
    coalesce(cs.started_exams, 0)::bigint                             as started_exams,
    (v_identified < 30)                                              as insufficient_data
  from camp_visits cv
  full join camp_signups cs on cs.campaign = cv.campaign and cs.source = cv.source
  order by coalesce(cv.visits, 0) desc, coalesce(cs.signups, 0) desc
  limit 20;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_marketing_campaigns(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_campaigns(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_campaigns(integer) TO authenticated, service_role;
