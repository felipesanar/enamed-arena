DROP FUNCTION IF EXISTS public.admin_produto_friction(integer, text);

CREATE OR REPLACE FUNCTION public.admin_produto_friction(p_days integer DEFAULT 30, p_segment text DEFAULT 'all'::text)
 RETURNS TABLE(
   key text, title text, event_name text,
   metric_value numeric, metric_unit text, severity text,
   numerator bigint, denominator bigint, insufficient_data boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start       timestamptz := now() - (p_days || ' days')::interval;
  v_tel_lo      timestamptz;
  v_tel_hi      timestamptz;
  v_min_sample  constant int := 5;
  v_active      bigint;
  v_pro_active  bigint;
  v_churn_cohort bigint;
  v_churn_num    bigint;
  m_post_churn   numeric;
  v_signups      bigint;
  v_onb_done     bigint;
  m_onb_dropout  numeric;
  m_onb_to_exam  numeric;
  v_started_valid   bigint;
  v_completed_valid bigint;
  m_exam_completion numeric;
  v_nb_num  bigint;
  m_notebook numeric;
  v_rv_denom bigint;
  v_rv_num   bigint;
  m_results_view numeric;
  v_rv_insufficient boolean;
begin
  perform public.admin_require('intel.view');

  select min(created_at), max(created_at) into v_tel_lo, v_tel_hi from analytics_events;

  select count(distinct a.user_id) into v_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and (p_segment = 'all' or pr.segment::text = p_segment);

  select count(distinct a.user_id) into v_pro_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start and pr.segment::text = 'pro';

  with fv as (
    select a.user_id, count(*) as n
    from attempts a
    join profiles pr on pr.id = a.user_id
    where a.status = 'submitted' and a.is_within_window = true
      and a.created_at >= v_start
      and (p_segment = 'all' or pr.segment::text = p_segment)
    group by a.user_id
  )
  select count(*) filter (where n = 1), count(*) into v_churn_num, v_churn_cohort from fv;
  m_post_churn := greatest(0, least(100,
    round(coalesce(v_churn_num::numeric / nullif(v_churn_cohort, 0) * 100, 0), 1)));

  select count(*) into v_signups
  from profiles pr
  where pr.created_at >= v_start
    and (p_segment = 'all' or pr.segment::text = p_segment);

  select count(distinct op.user_id) into v_onb_done
  from onboarding_profiles op
  join profiles pr on pr.id = op.user_id
  where pr.created_at >= v_start
    and op.completed_at is not null
    and (p_segment = 'all' or pr.segment::text = p_segment);

  m_onb_dropout := greatest(0, least(100,
    round((1 - coalesce(v_onb_done::numeric / nullif(v_signups, 0), 0)) * 100, 1)));

  select round(coalesce(percentile_cont(0.5) within group (
    order by extract(epoch from (a.created_at - op.completed_at)) / 86400
  ), 0)::numeric, 1) into m_onb_to_exam
  from (
    select user_id, min(created_at) as created_at
    from attempts where status = 'submitted' and is_within_window = true
    group by user_id
  ) a
  join onboarding_profiles op on op.user_id = a.user_id
  join profiles pr on pr.id = a.user_id
  where op.completed_at is not null
    and a.created_at >= v_start
    and a.created_at > op.completed_at
    and (p_segment = 'all' or pr.segment::text = p_segment);

  select count(*) filter (where a.status = 'submitted'), count(*)
    into v_completed_valid, v_started_valid
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and a.is_within_window = true
    and (p_segment = 'all' or pr.segment::text = p_segment);
  m_exam_completion := greatest(0, least(100,
    round(coalesce(v_completed_valid::numeric / nullif(v_started_valid, 0) * 100, 0), 1)));

  select count(distinct ae.user_id) into v_nb_num
  from analytics_events ae
  join profiles pr on pr.id = ae.user_id
  where ae.event_name = 'caderno_erros_viewed'
    and ae.created_at >= v_start
    and pr.segment::text = 'pro';
  m_notebook := greatest(0, least(100,
    round(coalesce(v_nb_num::numeric / nullif(v_pro_active, 0) * 100, 0), 1)));

  select count(distinct a.user_id) into v_rv_denom
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.status = 'submitted' and a.is_within_window = true
    and v_tel_lo is not null
    and a.created_at between v_tel_lo and v_tel_hi
    and (p_segment = 'all' or pr.segment::text = p_segment);

  select count(distinct ae.user_id) into v_rv_num
  from analytics_events ae
  join profiles pr on pr.id = ae.user_id
  where ae.event_name = 'resultado_viewed'
    and ae.user_id is not null
    and ae.created_at >= v_start
    and (p_segment = 'all' or pr.segment::text = p_segment)
    and exists (
      select 1 from attempts a
      where a.user_id = ae.user_id
        and a.status = 'submitted' and a.is_within_window = true
        and a.created_at between v_tel_lo and v_tel_hi
    );

  v_rv_insufficient := coalesce(v_rv_denom, 0) < v_min_sample;
  m_results_view := case when v_rv_insufficient then -1::numeric
    else greatest(0, least(100, round(coalesce(v_rv_num::numeric / nullif(v_rv_denom,0) * 100, 0), 1))) end;

  return query
  select * from (values
    ('post_exam_churn',  'Abandono pós-1ª prova',     'prova válida → nenhuma 2ª', m_post_churn,  'percent',
     case when m_post_churn > 50 then 'critical' when m_post_churn > 30 then 'warning' else 'healthy' end,
     v_churn_num, v_churn_cohort, (coalesce(v_churn_cohort,0) < v_min_sample)),
    ('onb_dropout',      'Dropout no onboarding',      'signup → onboarding',        m_onb_dropout, 'percent',
     case when m_onb_dropout > 30 then 'critical' when m_onb_dropout > 20 then 'warning' else 'healthy' end,
     (v_signups - v_onb_done), v_signups, (coalesce(v_signups,0) < v_min_sample)),
    ('onb_to_exam',      'Delay onboarding → prova',   'onboarding_completed → prova válida', m_onb_to_exam, 'days',
     case when m_onb_to_exam > 5 then 'critical' when m_onb_to_exam > 2 then 'warning' else 'healthy' end,
     null::bigint, null::bigint, false),
    ('exam_completion',  'Conclusão da prova',         'prova iniciada → submetida (sem treino)', m_exam_completion, 'percent',
     case when m_exam_completion >= 75 then 'healthy' when m_exam_completion >= 50 then 'warning' else 'critical' end,
     v_completed_valid, v_started_valid, (coalesce(v_started_valid,0) < v_min_sample)),
    ('notebook',         'Caderno de Erros (PRO)',     'caderno_erros_viewed',        m_notebook,    'percent',
     case when m_notebook >= 50 then 'healthy' when m_notebook >= 25 then 'warning' else 'critical' end,
     v_nb_num, v_pro_active, (coalesce(v_pro_active,0) < v_min_sample)),
    ('results_view',     'Engajamento com resultado',  'resultado_viewed',            m_results_view,'percent',
     case when v_rv_insufficient then 'warning'
          when m_results_view >= 60 then 'healthy' when m_results_view >= 40 then 'warning' else 'critical' end,
     v_rv_num, v_rv_denom, v_rv_insufficient)
  ) as t(key, title, event_name, metric_value, metric_unit, severity, numerator, denominator, insufficient_data);
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_produto_friction(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_produto_friction(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_produto_friction(integer, text) TO authenticated, service_role;
