-- v2: funis honestos. Removidos os passos baseados em EVENTO (telemetria só desde 2026-06-17),
-- que misturavam universos (8 dias de eventos vs attempts all-time) e produziam funil
-- não-monotônico + conversão real de 1574% mascarada como "100" pelo least(100,...).
-- Resultado: coorte confiável estritamente aninhada (subconjunto por user_id) → monotônica,
-- conversões reais em [0,100]. Métricas de evento (landing/detail/resultado) ficam no Marketing.
-- Mesma assinatura → CREATE OR REPLACE preserva grants; footer reafirma ACL limpo.

CREATE OR REPLACE FUNCTION public.admin_analytics_funnel(p_days integer DEFAULT 30)
 RETURNS TABLE(step_order integer, step_label text, user_count bigint, conversion_from_prev numeric, insufficient_data boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_req_start timestamptz := now() - (p_days || ' days')::interval;
  v_min_base  constant bigint := 30;
  v_s1 bigint; v_s2 bigint; v_s3 bigint; v_s4 bigint; v_s5 bigint;
begin
  perform public.admin_require('intel.view');

  select count(*) into v_s1
  from profiles p
  where p.created_at >= v_req_start and p.id not in (select ur.user_id from user_roles ur);

  select count(distinct op.user_id) into v_s2
  from onboarding_profiles op
  where op.completed_at is not null
    and op.user_id in (select p.id from profiles p where p.created_at >= v_req_start and p.id not in (select ur.user_id from user_roles ur));

  select count(distinct a.user_id) into v_s3
  from attempts a
  where a.user_id in (
    select distinct op.user_id from onboarding_profiles op
    where op.completed_at is not null
      and op.user_id in (select p.id from profiles p where p.created_at >= v_req_start and p.id not in (select ur.user_id from user_roles ur)));

  select count(distinct a.user_id) into v_s4
  from attempts a
  where a.status = 'submitted' and a.is_within_window = true
    and a.user_id in (
      select distinct a2.user_id from attempts a2
      where a2.user_id in (
        select distinct op.user_id from onboarding_profiles op
        where op.completed_at is not null
          and op.user_id in (select p.id from profiles p where p.created_at >= v_req_start and p.id not in (select ur.user_id from user_roles ur))));

  select count(*) into v_s5
  from (
    select a.user_id from attempts a
    where a.status = 'submitted' and a.is_within_window = true
      and a.user_id in (
        select distinct op.user_id from onboarding_profiles op
        where op.completed_at is not null
          and op.user_id in (select p.id from profiles p where p.created_at >= v_req_start and p.id not in (select ur.user_id from user_roles ur)))
    group by a.user_id having count(*) >= 2
  ) ret;

  return query
  select t.step_order, t.step_label, t.user_count, t.conversion_from_prev, t.insufficient_data
  from (values
    (1, 'Cadastrou-se',          v_s1, 100.0::numeric, (v_s1 < v_min_base)),
    (2, 'Concluiu onboarding',   v_s2, least(100, round(v_s2::numeric / nullif(v_s1,0) * 100, 1)), (v_s1 < v_min_base)),
    (3, 'Iniciou prova',         v_s3, least(100, round(v_s3::numeric / nullif(v_s2,0) * 100, 1)), (v_s2 < v_min_base)),
    (4, 'Submeteu prova válida', v_s4, least(100, round(v_s4::numeric / nullif(v_s3,0) * 100, 1)), (v_s3 < v_min_base)),
    (5, 'Retornou (2+ provas)',  v_s5, least(100, round(v_s5::numeric / nullif(v_s4,0) * 100, 1)), (v_s4 < v_min_base))
  ) as t(step_order, step_label, user_count, conversion_from_prev, insufficient_data)
  order by t.step_order;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_funnel(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_funnel(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_funnel_stats(p_days integer DEFAULT 7)
 RETURNS TABLE(step_order integer, step_label text, user_count bigint, conversion_from_prev numeric, insufficient_data boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
  v_min_base  constant bigint := 30;
  v_s1 bigint; v_s2 bigint; v_s3 bigint; v_s4 bigint;
begin
  perform public.admin_require('dashboard.view');

  select count(*) into v_s1
  from profiles p
  where p.created_at >= v_cur_start and p.id not in (select ur.user_id from user_roles ur);

  select count(distinct op.user_id) into v_s2
  from onboarding_profiles op
  where op.completed_at is not null
    and op.user_id in (select p.id from profiles p where p.created_at >= v_cur_start and p.id not in (select ur.user_id from user_roles ur));

  select count(distinct a.user_id) into v_s3
  from attempts a
  where a.user_id in (
    select distinct op.user_id from onboarding_profiles op
    where op.completed_at is not null
      and op.user_id in (select p.id from profiles p where p.created_at >= v_cur_start and p.id not in (select ur.user_id from user_roles ur)));

  select count(distinct a.user_id) into v_s4
  from attempts a
  where a.status = 'submitted' and a.is_within_window = true
    and a.user_id in (
      select distinct a2.user_id from attempts a2
      where a2.user_id in (
        select distinct op.user_id from onboarding_profiles op
        where op.completed_at is not null
          and op.user_id in (select p.id from profiles p where p.created_at >= v_cur_start and p.id not in (select ur.user_id from user_roles ur))));

  return query
  select t.step_order, t.step_label, t.user_count, t.conversion_from_prev, t.insufficient_data
  from (values
    (1, 'Cadastro',               v_s1, 100.0::numeric, (v_s1 < v_min_base)),
    (2, 'Onboarding',             v_s2, least(100, round(v_s2::numeric / nullif(v_s1,0) * 100, 1)), (v_s1 < v_min_base)),
    (3, 'Iniciou prova',          v_s3, least(100, round(v_s3::numeric / nullif(v_s2,0) * 100, 1)), (v_s2 < v_min_base)),
    (4, 'Concluiu prova válida',  v_s4, least(100, round(v_s4::numeric / nullif(v_s3,0) * 100, 1)), (v_s3 < v_min_base))
  ) as t(step_order, step_label, user_count, conversion_from_prev, insufficient_data)
  order by t.step_order;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_funnel_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_funnel_stats(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_stats(integer) TO authenticated, service_role;
