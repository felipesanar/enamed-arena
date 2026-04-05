-- =====================================================================
-- Admin P1-A: Produto RPCs — Segmented Funnel & Friction Map
-- =====================================================================

-- ─── 1. admin_produto_segmented_funnel ───────────────────────────────
create or replace function admin_produto_segmented_funnel(p_days int default 30)
returns table (
  step_order      int,
  step_label      text,
  guest_count     bigint,
  guest_pct       numeric,
  standard_count  bigint,
  standard_pct    numeric,
  pro_count       bigint,
  pro_pct         numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start    timestamptz := now() - (p_days || ' days')::interval;
  v_g bigint; v_s bigint; v_p bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- base signup counts per segment
  select
    count(*) filter (where segment = 'guest'),
    count(*) filter (where segment = 'standard'),
    count(*) filter (where segment = 'pro')
  into v_g, v_s, v_p
  from profiles where created_at >= v_start;

  return query
  -- Step 1: Cadastrou
  select 1, 'Cadastrou', v_g, 100.0, v_s, 100.0, v_p, 100.0
  union all
  -- Step 2: Onboarding
  select 2, 'Onboarding',
    count(distinct op.user_id) filter (where pr.segment = 'guest'),
    round(count(distinct op.user_id) filter (where pr.segment = 'guest')::numeric / nullif(v_g,0)*100,1),
    count(distinct op.user_id) filter (where pr.segment = 'standard'),
    round(count(distinct op.user_id) filter (where pr.segment = 'standard')::numeric / nullif(v_s,0)*100,1),
    count(distinct op.user_id) filter (where pr.segment = 'pro'),
    round(count(distinct op.user_id) filter (where pr.segment = 'pro')::numeric / nullif(v_p,0)*100,1)
  from onboarding_profiles op
  join profiles pr on pr.id = op.user_id
  where pr.created_at >= v_start and op.completed_at is not null
  union all
  -- Step 3: 1ª prova
  select 3, '1ª prova',
    count(distinct a.user_id) filter (where pr.segment = 'guest'),
    round(count(distinct a.user_id) filter (where pr.segment = 'guest')::numeric / nullif(v_g,0)*100,1),
    count(distinct a.user_id) filter (where pr.segment = 'standard'),
    round(count(distinct a.user_id) filter (where pr.segment = 'standard')::numeric / nullif(v_s,0)*100,1),
    count(distinct a.user_id) filter (where pr.segment = 'pro'),
    round(count(distinct a.user_id) filter (where pr.segment = 'pro')::numeric / nullif(v_p,0)*100,1)
  from attempts a
  join profiles pr on pr.id = a.user_id
  where pr.created_at >= v_start
  union all
  -- Step 4: Retornou 2+
  select 4, 'Retornou (2+)',
    count(distinct a.user_id) filter (where pr.segment = 'guest'),
    round(count(distinct a.user_id) filter (where pr.segment = 'guest')::numeric / nullif(v_g,0)*100,1),
    count(distinct a.user_id) filter (where pr.segment = 'standard'),
    round(count(distinct a.user_id) filter (where pr.segment = 'standard')::numeric / nullif(v_s,0)*100,1),
    count(distinct a.user_id) filter (where pr.segment = 'pro'),
    round(count(distinct a.user_id) filter (where pr.segment = 'pro')::numeric / nullif(v_p,0)*100,1)
  from attempts a
  join profiles pr on pr.id = a.user_id
  where pr.created_at >= v_start
    and (select count(*) from attempts a2 where a2.user_id = a.user_id) >= 2
  order by 1;
end;
$$;

grant execute on function admin_produto_segmented_funnel(int) to authenticated;

-- ─── 2. admin_produto_friction ────────────────────────────────────────
-- Returns 6 pre-defined friction metrics.
create or replace function admin_produto_friction(p_days int default 30, p_segment text default 'all')
returns table (
  key          text,
  title        text,
  event_name   text,
  metric_value numeric,
  metric_unit  text,
  severity     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start     timestamptz := now() - (p_days || ' days')::interval;
  v_active    bigint;   -- users with at least 1 attempt in period
  v_submitted bigint;
  v_pro_active bigint;
  -- friction metrics
  m_post_churn     numeric;
  m_onb_dropout    numeric;
  m_onb_to_exam    numeric;
  m_exam_completion numeric;
  m_notebook       numeric;
  m_results_view   numeric;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- Active users in period (with segment filter)
  select count(distinct a.user_id) into v_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and (p_segment = 'all' or pr.segment = p_segment);

  select count(distinct a.user_id) into v_submitted
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and a.status = 'submitted'
    and (p_segment = 'all' or pr.segment = p_segment);

  select count(distinct a.user_id) into v_pro_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start and pr.segment = 'pro';

  -- 1. Post-exam churn: users with exactly 1 attempt / total active
  select round(
    count(distinct user_id)::numeric / nullif(v_active, 0) * 100, 1
  ) into m_post_churn
  from (
    select a.user_id from attempts a
    join profiles pr on pr.id = a.user_id
    where a.created_at >= v_start
      and (p_segment = 'all' or pr.segment = p_segment)
    group by a.user_id having count(*) = 1
  ) sub;

  -- 2. Onboarding dropout: % of signups who didn't complete onboarding
  select round(
    (1 - count(distinct op.user_id)::numeric / nullif(
      (select count(*) from profiles pr where pr.created_at >= v_start
       and (p_segment = 'all' or pr.segment = p_segment)), 0
    )) * 100, 1
  ) into m_onb_dropout
  from onboarding_profiles op
  join profiles pr on pr.id = op.user_id
  where pr.created_at >= v_start
    and op.completed_at is not null
    and (p_segment = 'all' or pr.segment = p_segment);

  -- 3. Median days onboarding → first exam
  select round(coalesce(percentile_cont(0.5) within group (
    order by extract(epoch from (a.created_at - op.completed_at)) / 86400
  ), 0)::numeric, 1) into m_onb_to_exam
  from (
    select user_id, min(created_at) as created_at from attempts group by user_id
  ) a
  join onboarding_profiles op on op.user_id = a.user_id
  join profiles pr on pr.id = a.user_id
  where op.completed_at is not null
    and a.created_at >= v_start
    and a.created_at > op.completed_at
    and (p_segment = 'all' or pr.segment = p_segment);

  -- 4. Exam completion: % started that were submitted
  select round(coalesce(
    count(*) filter (where status = 'submitted')::numeric / nullif(count(*), 0) * 100, 0
  ), 1) into m_exam_completion
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and (p_segment = 'all' or pr.segment = p_segment);

  -- 5. Caderno de erros adoption (PRO only)
  select round(coalesce(
    (select count(distinct ae.user_id)::numeric
     from analytics_events ae
     join profiles pr on pr.id = ae.user_id
     where ae.event_name = 'caderno_erros_viewed'
       and ae.created_at >= v_start
       and pr.segment = 'pro') / nullif(v_pro_active, 0) * 100, 0
  ), 1) into m_notebook;

  -- 6. Results engagement: % of submitted that viewed resultado
  select round(coalesce(
    (select count(distinct ae.user_id)::numeric
     from analytics_events ae
     join profiles pr on pr.id = ae.user_id
     where ae.event_name = 'resultado_viewed'
       and ae.created_at >= v_start
       and (p_segment = 'all' or pr.segment = p_segment))
    / nullif(v_submitted, 0) * 100, 0
  ), 1) into m_results_view;

  return query values
    ('post_exam_churn',  'Abandono pós-1ª prova',    'exam_submitted → (nenhum)', m_post_churn,  'percent',
     case when m_post_churn > 50 then 'critical' when m_post_churn > 30 then 'warning' else 'healthy' end),
    ('onb_dropout',      'Dropout no onboarding',     'signup → onboarding',       m_onb_dropout, 'percent',
     case when m_onb_dropout > 30 then 'critical' when m_onb_dropout > 20 then 'warning' else 'healthy' end),
    ('onb_to_exam',      'Delay onboarding → prova',  'onboarding_completed → exam_started', m_onb_to_exam, 'days',
     case when m_onb_to_exam > 5 then 'critical' when m_onb_to_exam > 2 then 'warning' else 'healthy' end),
    ('exam_completion',  'Conclusão da prova',        'exam_started → exam_submitted', m_exam_completion, 'percent',
     case when m_exam_completion >= 75 then 'healthy' when m_exam_completion >= 50 then 'warning' else 'critical' end),
    ('notebook',         'Caderno de Erros (PRO)',     'caderno_erros_viewed',       m_notebook,    'percent',
     case when m_notebook >= 50 then 'healthy' when m_notebook >= 25 then 'warning' else 'critical' end),
    ('results_view',     'Engajamento com resultado', 'resultado_viewed',            m_results_view,'percent',
     case when m_results_view >= 60 then 'healthy' when m_results_view >= 40 then 'warning' else 'critical' end);
end;
$$;

grant execute on function admin_produto_friction(int, text) to authenticated;

-- ─── 3. admin_produto_feature_adoption ───────────────────────────────
create or replace function admin_produto_feature_adoption(p_days int default 30, p_segment text default 'all')
returns table (
  feature        text,
  event_name     text,
  adoption_pct   numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  timestamptz := now() - (p_days || ' days')::interval;
  v_active bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  select count(distinct a.user_id) into v_active
  from attempts a
  join profiles pr on pr.id = a.user_id
  where a.created_at >= v_start
    and (p_segment = 'all' or pr.segment = p_segment);

  return query
  with features(f, ev) as (
    values
      ('Ver desempenho',   'desempenho_viewed'),
      ('Ver ranking',      'ranking_viewed'),
      ('Ver gabarito',     'correction_viewed'),
      ('Caderno de Erros', 'caderno_erros_viewed'),
      ('Comparativo',      'comparativo_viewed'),
      ('Ver resultado',    'resultado_viewed')
  )
  select
    f.f,
    f.ev,
    round(coalesce(
      (select count(distinct ae.user_id)::numeric
       from analytics_events ae
       join profiles pr on pr.id = ae.user_id
       where ae.event_name = f.ev
         and ae.created_at >= v_start
         and (p_segment = 'all' or pr.segment = p_segment))
      / nullif(v_active, 0) * 100, 0
    ), 1)
  from features f
  order by 3 desc;
end;
$$;

grant execute on function admin_produto_feature_adoption(int, text) to authenticated;

-- ─── 4. admin_produto_top_events ─────────────────────────────────────
create or replace function admin_produto_top_events(p_days int default 30, p_limit int default 10)
returns table (
  event_name text,
  cnt        bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select ae.event_name, count(*)::bigint as cnt
  from analytics_events ae
  where ae.created_at >= v_start
  group by ae.event_name
  order by cnt desc
  limit p_limit;
end;
$$;

grant execute on function admin_produto_top_events(int, int) to authenticated;
