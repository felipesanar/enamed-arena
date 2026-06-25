-- v2: corrige ERROR 42702 "column reference ambiguous" nas 3 RPCs de marketing.
-- Os aliases de coluna das CTEs (campaign/source/medium) colidiam com as colunas do
-- RETURNS TABLE (tratadas como variáveis PL/pgSQL). Fix: diretiva #variable_conflict use_column.
-- Mesma assinatura → CREATE OR REPLACE preserva grants; footer reafirma ACL limpo.

CREATE OR REPLACE FUNCTION public.admin_marketing_sources(p_days integer DEFAULT 30)
 RETURNS TABLE(source text, user_count bigint, conv_rate numeric, signup_conv_pct numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    select p.id,
      coalesce((select nullif(ae.payload->>'utm_source', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_source' is not null
         order by ae.created_at asc limit 1), 'organic') as source
    from profiles p
    where p.created_at >= v_start
      and not exists (select 1 from user_roles ur where ur.user_id = p.id)
  ),
  part as (select ufs.source, count(*)::bigint as user_count from user_first_src ufs group by ufs.source),
  visits_src as (
    select coalesce(nullif(payload->>'utm_source', ''), 'organic') as source,
      count(distinct coalesce(user_id::text, payload->>'session_id')) as visits,
      count(distinct case when user_id is not null and exists (
              select 1 from profiles p where p.id = analytics_events.user_id and p.created_at >= v_start)
            then user_id end) as signups_cohort
    from analytics_events
    where event_name = 'landing_page_viewed' and created_at >= v_start
    group by 1
  )
  select pa.source, pa.user_count,
    round(pa.user_count::numeric / nullif(v_total, 0) * 100, 1) as conv_rate,
    case when vs.visits > 0
         then least(100, greatest(0, round(vs.signups_cohort::numeric / vs.visits * 100, 1)))
         else null end as signup_conv_pct
  from part pa left join visits_src vs on vs.source = pa.source
  order by pa.user_count desc limit 8;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_marketing_sources(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_sources(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_sources(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_marketing_mediums(p_days integer DEFAULT 30)
 RETURNS TABLE(medium text, user_count bigint, conv_rate numeric, signup_conv_pct numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    select p.id,
      coalesce((select nullif(ae.payload->>'utm_medium', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_medium' is not null
         order by ae.created_at asc limit 1), '(nenhum)') as medium
    from profiles p
    where p.created_at >= v_start
      and not exists (select 1 from user_roles ur where ur.user_id = p.id)
  ),
  part as (select ufm.medium, count(*)::bigint as user_count from user_first_med ufm group by ufm.medium),
  visits_med as (
    select coalesce(nullif(payload->>'utm_medium', ''), '(nenhum)') as medium,
      count(distinct coalesce(user_id::text, payload->>'session_id')) as visits,
      count(distinct case when user_id is not null and exists (
              select 1 from profiles p where p.id = analytics_events.user_id and p.created_at >= v_start)
            then user_id end) as signups_cohort
    from analytics_events
    where event_name = 'landing_page_viewed' and created_at >= v_start
    group by 1
  )
  select pa.medium, pa.user_count,
    round(pa.user_count::numeric / nullif(v_total, 0) * 100, 1) as conv_rate,
    case when vm.visits > 0
         then least(100, greatest(0, round(vm.signups_cohort::numeric / vm.visits * 100, 1)))
         else null end as signup_conv_pct
  from part pa left join visits_med vm on vm.medium = pa.medium
  order by pa.user_count desc limit 8;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_marketing_mediums(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_mediums(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_mediums(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_marketing_campaigns(p_days integer DEFAULT 30)
 RETURNS TABLE(campaign text, source text, visits bigint, signups bigint, conv_rate numeric, first_exams bigint, started_exams bigint, insufficient_data boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
  v_identified bigint;
begin
  perform public.admin_require('intel.view');
  select count(distinct ae.user_id) into v_identified
  from analytics_events ae
  where ae.event_name = 'landing_page_viewed' and ae.created_at >= v_start and ae.user_id is not null;
  return query
  with landing as (
    select coalesce(nullif(payload->>'utm_campaign', ''), '(sem campanha)') as campaign,
      coalesce(nullif(payload->>'utm_source', ''), 'organic') as source,
      user_id, coalesce(user_id::text, payload->>'session_id') as visitor_key
    from analytics_events
    where event_name = 'landing_page_viewed' and created_at >= v_start
  ),
  camp_visits as (select l.campaign, l.source, count(distinct l.visitor_key) as visits from landing l group by 1,2),
  landing_users as (
    select distinct l.campaign, l.source, l.user_id from landing l
    where l.user_id is not null and not exists (select 1 from user_roles ur where ur.user_id = l.user_id)
  ),
  camp_signups as (
    select lu.campaign, lu.source,
      count(distinct case when p.created_at >= v_start then p.id end) as signups,
      count(distinct case when fe_valid.user_id is not null then p.id end) as first_exams,
      count(distinct case when fe_any.user_id is not null then p.id end) as started_exams
    from landing_users lu
    join profiles p on p.id = lu.user_id
    left join (select user_id from attempts where is_within_window = true group by user_id) fe_valid on fe_valid.user_id = lu.user_id
    left join (select user_id from attempts group by user_id) fe_any on fe_any.user_id = lu.user_id
    group by 1,2
  )
  select coalesce(cv.campaign, cs.campaign, '(sem campanha)') as campaign,
    coalesce(cv.source, cs.source, 'organic') as source,
    coalesce(cv.visits, 0)::bigint as visits,
    coalesce(cs.signups, 0)::bigint as signups,
    case when coalesce(cv.visits, 0) > 0
         then least(100, greatest(0, round(coalesce(cs.signups,0)::numeric / cv.visits * 100, 1)))
         else null end as conv_rate,
    coalesce(cs.first_exams, 0)::bigint as first_exams,
    coalesce(cs.started_exams, 0)::bigint as started_exams,
    (v_identified < 30) as insufficient_data
  from camp_visits cv
  full join camp_signups cs on cs.campaign = cv.campaign and cs.source = cv.source
  order by coalesce(cv.visits, 0) desc, coalesce(cs.signups, 0) desc limit 20;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_marketing_campaigns(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_marketing_campaigns(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_campaigns(integer) TO authenticated, service_role;
