DROP FUNCTION IF EXISTS public.admin_analytics_funnel(integer);

CREATE OR REPLACE FUNCTION public.admin_analytics_funnel(p_days integer DEFAULT 30)
 RETURNS TABLE(step_order integer, step_label text, user_count bigint, conversion_from_prev numeric, insufficient_data boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tel_start   constant timestamptz := timestamptz '2026-06-17 00:00:00+00';
  v_req_start   timestamptz := now() - (p_days || ' days')::interval;
  v_min_base    constant bigint := 30;
  v_step1 bigint; v_step2 bigint; v_step3 bigint; v_step4 bigint; v_step5 bigint; v_step6 bigint;
begin
  perform public.admin_require('intel.view');

  select count(distinct coalesce(ae.user_id::text, ae.payload->>'session_id'))
  into v_step1
  from analytics_events ae
  where ae.event_name = 'landing_page_viewed'
    and ae.created_at >= greatest(v_req_start, v_tel_start);

  select count(*) into v_step2
  from profiles p
  where p.created_at >= v_req_start
    and p.id not in (select ur.user_id from user_roles ur);

  select count(distinct op.user_id) into v_step3
  from onboarding_profiles op
  where op.completed_at is not null
    and op.user_id in (
      select p.id from profiles p
      where p.created_at >= v_req_start
        and p.id not in (select ur.user_id from user_roles ur)
    );

  select count(distinct a.user_id) into v_step4
  from attempts a
  where a.user_id in (
    select distinct op.user_id from onboarding_profiles op
    where op.completed_at is not null
      and op.user_id in (
        select p.id from profiles p
        where p.created_at >= v_req_start
          and p.id not in (select ur.user_id from user_roles ur)
      )
  );

  select count(distinct a.user_id) into v_step5
  from attempts a
  where a.status = 'submitted'
    and a.is_within_window = true
    and a.user_id in (
      select distinct a2.user_id from attempts a2
      where a2.user_id in (
        select distinct op.user_id from onboarding_profiles op
        where op.completed_at is not null
          and op.user_id in (
            select p.id from profiles p
            where p.created_at >= v_req_start
              and p.id not in (select ur.user_id from user_roles ur)
          )
      )
    );

  select count(*) into v_step6
  from (
    select a.user_id
    from attempts a
    where a.status = 'submitted'
      and a.is_within_window = true
      and a.user_id in (
        select distinct a3.user_id from attempts a3
        where a3.status = 'submitted' and a3.is_within_window = true
          and a3.user_id in (
            select distinct op.user_id from onboarding_profiles op
            where op.completed_at is not null
              and op.user_id in (
                select p.id from profiles p
                where p.created_at >= v_req_start
                  and p.id not in (select ur.user_id from user_roles ur)
              )
          )
      )
    group by a.user_id
    having count(*) >= 2
  ) ret;

  return query
  select t.step_order, t.step_label, t.user_count, t.conversion_from_prev, t.insufficient_data
  from (
    values
      (1, 'Visitou landing',         v_step1, 100.0::numeric, false),
      (2, 'Cadastrou-se',            v_step2, NULL::numeric,  true),
      (3, 'Concluiu onboarding',     v_step3, least(100, round(v_step3::numeric / nullif(v_step2,0) * 100, 1)), (v_step2 < v_min_base)),
      (4, 'Iniciou prova',           v_step4, least(100, round(v_step4::numeric / nullif(v_step3,0) * 100, 1)), (v_step3 < v_min_base)),
      (5, 'Submeteu prova válida',   v_step5, least(100, round(v_step5::numeric / nullif(v_step4,0) * 100, 1)), (v_step4 < v_min_base)),
      (6, 'Retornou (2+ provas)',    v_step6, least(100, round(v_step6::numeric / nullif(v_step5,0) * 100, 1)), (v_step5 < v_min_base))
  ) as t(step_order, step_label, user_count, conversion_from_prev, insufficient_data)
  order by t.step_order;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_analytics_funnel(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel(integer) TO authenticated, service_role;
