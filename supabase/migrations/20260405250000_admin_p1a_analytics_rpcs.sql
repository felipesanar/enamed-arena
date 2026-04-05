-- =====================================================================
-- Admin P1-A: Analytics RPCs — Jornada do Usuário
-- =====================================================================

-- ─── 1. admin_analytics_funnel ───────────────────────────────────────
-- 6-step user journey funnel. Steps are independent counts (not cohort).
create or replace function admin_analytics_funnel(p_days int default 30)
returns table (
  step_order           int,
  step_label           text,
  user_count           bigint,
  conversion_from_prev numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  timestamptz := now() - (p_days || ' days')::interval;
  v_step1  bigint;
  v_step2  bigint;
  v_step3  bigint;
  v_step4  bigint;
  v_step5  bigint;
  v_step6  bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- 1. Visited landing page (includes anonymous via session_id)
  select count(distinct coalesce(user_id::text, payload->>'session_id'))
  into v_step1
  from analytics_events
  where event_name = 'landing_page_viewed'
    and created_at >= v_start;

  -- 2. Signed up
  select count(*) into v_step2
  from profiles
  where created_at >= v_start;

  -- 3. Completed onboarding
  select count(distinct op.user_id) into v_step3
  from onboarding_profiles op
  where op.completed_at >= v_start
    and op.completed_at is not null;

  -- 4. Started first exam (distinct users with at least 1 attempt in period)
  select count(distinct user_id) into v_step4
  from attempts
  where created_at >= v_start;

  -- 5. Submitted at least one exam in period
  select count(distinct user_id) into v_step5
  from attempts
  where status = 'submitted'
    and created_at >= v_start;

  -- 6. Returned (users with 2+ attempts, counting all time for those active in period)
  select count(distinct a.user_id) into v_step6
  from attempts a
  where a.created_at >= v_start
    and (select count(*) from attempts a2 where a2.user_id = a.user_id) >= 2;

  return query values
    (1, 'Visitou landing',       v_step1, 100.0),
    (2, 'Cadastrou-se',          v_step2, round(v_step2::numeric / nullif(v_step1, 0) * 100, 1)),
    (3, 'Concluiu onboarding',   v_step3, round(v_step3::numeric / nullif(v_step2, 0) * 100, 1)),
    (4, 'Iniciou prova',         v_step4, round(v_step4::numeric / nullif(v_step3, 0) * 100, 1)),
    (5, 'Submeteu prova',        v_step5, round(v_step5::numeric / nullif(v_step4, 0) * 100, 1)),
    (6, 'Retornou (2+ provas)',  v_step6, round(v_step6::numeric / nullif(v_step5, 0) * 100, 1));
end;
$$;

grant execute on function admin_analytics_funnel(int) to authenticated;

-- ─── 2. admin_analytics_timeseries ───────────────────────────────────
-- Weekly buckets: new_users and users who started their first exam.
create or replace function admin_analytics_timeseries(p_days int default 56)
returns table (
  week_start  date,
  new_users   bigint,
  first_exams bigint
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
  with weeks as (
    select generate_series(
      date_trunc('week', v_start),
      date_trunc('week', now()),
      '1 week'::interval
    )::date as w
  ),
  reg as (
    select date_trunc('week', created_at)::date as w, count(*) as cnt
    from profiles where created_at >= v_start
    group by 1
  ),
  first_att as (
    select date_trunc('week', min_created)::date as w, count(*) as cnt
    from (
      select user_id, min(created_at) as min_created
      from attempts
      where created_at >= v_start
      group by user_id
    ) sub
    group by 1
  )
  select
    weeks.w,
    coalesce(reg.cnt, 0)::bigint,
    coalesce(first_att.cnt, 0)::bigint
  from weeks
  left join reg       on reg.w = weeks.w
  left join first_att on first_att.w = weeks.w
  order by weeks.w;
end;
$$;

grant execute on function admin_analytics_timeseries(int) to authenticated;

-- ─── 3. admin_analytics_sources ──────────────────────────────────────
-- UTM source breakdown for users who signed up in the period.
create or replace function admin_analytics_sources(p_days int default 30)
returns table (
  utm_source      text,
  user_count      bigint,
  signup_conv_pct numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start    timestamptz := now() - (p_days || ' days')::interval;
  v_landings bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- total landing events in period (denominator for conv)
  select count(distinct coalesce(user_id::text, payload->>'session_id'))
  into v_landings
  from analytics_events
  where event_name = 'landing_page_viewed' and created_at >= v_start;

  return query
  with user_source as (
    -- first utm_source seen per user who signed up in period
    select
      p.id as user_id,
      coalesce(
        (select nullif(ae.payload->>'utm_source', '')
         from analytics_events ae
         where ae.user_id = p.id
           and ae.payload->>'utm_source' is not null
         order by ae.created_at asc
         limit 1),
        'organic'
      ) as source
    from profiles p
    where p.created_at >= v_start
  )
  select
    source                   as utm_source,
    count(*)::bigint         as user_count,
    round(count(*)::numeric / nullif(v_landings, 0) * 100, 1) as signup_conv_pct
  from user_source
  group by source
  order by user_count desc
  limit 8;
end;
$$;

grant execute on function admin_analytics_sources(int) to authenticated;

-- ─── 4. admin_analytics_time_to_convert ──────────────────────────────
-- Median time for key conversion steps.
create or replace function admin_analytics_time_to_convert(p_days int default 30)
returns table (
  landing_to_signup_min        numeric,
  signup_to_onboarding_min     numeric,
  onboarding_to_first_exam_days numeric,
  first_to_second_exam_days    numeric
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
  select
    -- landing → signup (minutes)
    coalesce(round((
      select percentile_cont(0.5) within group (
        order by extract(epoch from (p.created_at - ae.created_at)) / 60
      )
      from analytics_events ae
      join profiles p on p.id = ae.user_id
      where ae.event_name = 'landing_page_viewed'
        and p.created_at >= v_start
        and extract(epoch from (p.created_at - ae.created_at)) between 0 and 3600
    )::numeric, 1), 0),

    -- signup → onboarding (minutes)
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

    -- onboarding → first exam (days)
    coalesce(round((
      select percentile_cont(0.5) within group (
        order by extract(epoch from (a.created_at - op.completed_at)) / 86400
      )
      from (
        select user_id, min(created_at) as created_at
        from attempts group by user_id
      ) a
      join onboarding_profiles op on op.user_id = a.user_id
      where op.completed_at is not null
        and a.created_at >= v_start
        and a.created_at > op.completed_at
    )::numeric, 1), 0),

    -- first exam → second exam (days)
    coalesce(round((
      select percentile_cont(0.5) within group (
        order by extract(epoch from (second.created_at - first.created_at)) / 86400
      )
      from (
        select user_id, min(created_at) as created_at from attempts group by user_id
      ) first
      join (
        select user_id,
               (array_agg(created_at order by created_at))[2] as created_at
        from attempts group by user_id having count(*) >= 2
      ) second on second.user_id = first.user_id
      where second.created_at >= v_start
    )::numeric, 1), 0);
end;
$$;

grant execute on function admin_analytics_time_to_convert(int) to authenticated;
