-- =====================================================================
-- Admin Analytics RPCs — Dashboard Executivo
-- Todas as funções são SECURITY DEFINER com verificação de role admin.
-- =====================================================================

-- ─── 1. admin_dashboard_kpis ─────────────────────────────────────────
create or replace function admin_dashboard_kpis(p_days int default 7)
returns table (
  total_users         bigint,
  new_users           bigint,
  new_users_prev      bigint,
  exams_started       bigint,
  exams_started_prev  bigint,
  completion_rate     numeric,
  completion_rate_prev numeric,
  avg_score           numeric,
  avg_score_prev      numeric,
  activation_rate     numeric,
  activation_rate_prev numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now         timestamptz := now();
  v_cur_start   timestamptz := v_now - (p_days || ' days')::interval;
  v_prev_start  timestamptz := v_now - (p_days * 2 || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    -- total_users
    (select count(*)::bigint from profiles),

    -- new_users (período atual)
    (select count(*)::bigint from profiles
     where created_at >= v_cur_start),

    -- new_users_prev
    (select count(*)::bigint from profiles
     where created_at >= v_prev_start and created_at < v_cur_start),

    -- exams_started (período atual)
    (select count(*)::bigint from attempts
     where created_at >= v_cur_start),

    -- exams_started_prev
    (select count(*)::bigint from attempts
     where created_at >= v_prev_start and created_at < v_cur_start),

    -- completion_rate atual: status submitted ou expired / total no período
    coalesce(
      round(
        (select count(*) filter (where status in ('submitted', 'expired'))::numeric
               / nullif(count(*), 0) * 100
         from attempts where created_at >= v_cur_start),
      1), 0),

    -- completion_rate_prev
    coalesce(
      round(
        (select count(*) filter (where status in ('submitted', 'expired'))::numeric
               / nullif(count(*), 0) * 100
         from attempts where created_at >= v_prev_start and created_at < v_cur_start),
      1), 0),

    -- avg_score atual (de user_performance_history, que só tem finalizados)
    coalesce(
      round((select avg(score_percentage)
             from user_performance_history
             where finished_at >= v_cur_start)::numeric, 1),
      0),

    -- avg_score_prev
    coalesce(
      round((select avg(score_percentage)
             from user_performance_history
             where finished_at >= v_prev_start and finished_at < v_cur_start)::numeric, 1),
      0),

    -- activation_rate: usuários que criaram ≥1 attempt / new_users do período
    coalesce(
      round(
        (select count(distinct a.user_id)::numeric
               / nullif(
                   (select count(*) from profiles where created_at >= v_cur_start), 0
                 ) * 100
         from attempts a
         join profiles p on p.id = a.user_id
         where p.created_at >= v_cur_start),
      1), 0),

    -- activation_rate_prev
    coalesce(
      round(
        (select count(distinct a.user_id)::numeric
               / nullif(
                   (select count(*) from profiles
                    where created_at >= v_prev_start and created_at < v_cur_start), 0
                 ) * 100
         from attempts a
         join profiles p on p.id = a.user_id
         where p.created_at >= v_prev_start and p.created_at < v_cur_start),
      1), 0);
end;
$$;

grant execute on function admin_dashboard_kpis(int) to authenticated;

-- ─── 2. admin_events_timeseries ───────────────────────────────────────
create or replace function admin_events_timeseries(p_days int default 7)
returns table (
  day             date,
  new_users       bigint,
  exams_started   bigint,
  exams_completed bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with days as (
    select generate_series(
      date_trunc('day', v_cur_start),
      date_trunc('day', now()),
      '1 day'::interval
    )::date as d
  ),
  reg as (
    select date_trunc('day', created_at)::date as d, count(*) as cnt
    from profiles where created_at >= v_cur_start
    group by 1
  ),
  started as (
    select date_trunc('day', created_at)::date as d, count(*) as cnt
    from attempts where created_at >= v_cur_start
    group by 1
  ),
  completed as (
    select date_trunc('day', finished_at)::date as d, count(*) as cnt
    from attempts
    where finished_at >= v_cur_start
      and status in ('submitted', 'expired')
    group by 1
  )
  select
    days.d,
    coalesce(reg.cnt, 0)::bigint,
    coalesce(started.cnt, 0)::bigint,
    coalesce(completed.cnt, 0)::bigint
  from days
  left join reg       on reg.d = days.d
  left join started   on started.d = days.d
  left join completed on completed.d = days.d
  order by days.d;
end;
$$;

grant execute on function admin_events_timeseries(int) to authenticated;

-- ─── 3. admin_funnel_stats ────────────────────────────────────────────
-- Funil de coorte: universo = usuários registrados no período.
create or replace function admin_funnel_stats(p_days int default 7)
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
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
  v_step1 bigint;
  v_step2 bigint;
  v_step3 bigint;
  v_step4 bigint;
  v_step5 bigint;
  v_step6 bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- 1. Cadastro no período
  select count(*) into v_step1 from profiles where created_at >= v_cur_start;

  -- 2. Onboarding concluído (do coorte)
  select count(distinct op.user_id) into v_step2
  from onboarding_profiles op
  join profiles p on p.id = op.user_id
  where p.created_at >= v_cur_start
    and op.completed_at is not null;

  -- 3. Simulado visto (evento simulado_detail_viewed do coorte)
  select count(distinct ae.user_id) into v_step3
  from analytics_events ae
  join profiles p on p.id = ae.user_id
  where p.created_at >= v_cur_start
    and ae.event_name = 'simulado_detail_viewed'
    and ae.user_id is not null;

  -- 4. Simulado iniciado (attempt do coorte)
  select count(distinct a.user_id) into v_step4
  from attempts a
  join profiles p on p.id = a.user_id
  where p.created_at >= v_cur_start;

  -- 5. Simulado concluído (do coorte)
  select count(distinct a.user_id) into v_step5
  from attempts a
  join profiles p on p.id = a.user_id
  where p.created_at >= v_cur_start
    and a.status in ('submitted', 'expired');

  -- 6. Resultado visto (do coorte)
  select count(distinct ae.user_id) into v_step6
  from analytics_events ae
  join profiles p on p.id = ae.user_id
  where p.created_at >= v_cur_start
    and ae.event_name = 'resultado_viewed'
    and ae.user_id is not null;

  return query values
    (1, 'Cadastro',         v_step1, 100.0),
    (2, 'Onboarding',       v_step2, round(v_step2::numeric / nullif(v_step1,0) * 100, 1)),
    (3, 'Simulado visto',   v_step3, round(v_step3::numeric / nullif(v_step2,0) * 100, 1)),
    (4, 'Iniciou prova',    v_step4, round(v_step4::numeric / nullif(v_step3,0) * 100, 1)),
    (5, 'Concluiu',         v_step5, round(v_step5::numeric / nullif(v_step4,0) * 100, 1)),
    (6, 'Viu resultado',    v_step6, round(v_step6::numeric / nullif(v_step5,0) * 100, 1));
end;
$$;

grant execute on function admin_funnel_stats(int) to authenticated;

-- ─── 4. admin_simulado_engagement ─────────────────────────────────────
create or replace function admin_simulado_engagement(p_limit int default 10)
returns table (
  simulado_id      uuid,
  sequence_number  int,
  title            text,
  participants     bigint,
  completion_rate  numeric,
  avg_score        numeric,
  abandonment_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    s.id,
    s.sequence_number,
    s.title,
    count(distinct a.user_id)::bigint as participants,
    coalesce(round(
      count(*) filter (where a.status in ('submitted', 'expired'))::numeric
      / nullif(count(*), 0) * 100, 1), 0) as completion_rate,
    coalesce(round(avg(uph.score_percentage)::numeric, 1), 0) as avg_score,
    coalesce(round(
      count(*) filter (where a.status not in ('submitted', 'expired', 'in_progress'))::numeric
      / nullif(count(*), 0) * 100, 1), 0) as abandonment_rate
  from simulados s
  left join attempts a on a.simulado_id = s.id
  left join user_performance_history uph on uph.attempt_id = a.id
  group by s.id, s.sequence_number, s.title, s.execution_window_start
  order by s.execution_window_start desc
  limit p_limit;
end;
$$;

grant execute on function admin_simulado_engagement(int) to authenticated;

-- ─── 5. admin_live_signals ────────────────────────────────────────────
-- "online" = distinct user_id com evento nos últimos 15 minutos.
-- Aproximação documentada — não há presença WebSocket.
create or replace function admin_live_signals()
returns table (
  online_last_15min  bigint,
  active_exams       bigint,
  open_tickets       bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    (select count(distinct user_id)
     from analytics_events
     where created_at >= now() - interval '15 minutes'
       and user_id is not null)::bigint,

    (select count(*)
     from attempts
     where status = 'in_progress')::bigint,

    -- open_tickets: hardcoded 0 até módulo de suporte ser implementado
    0::bigint;
end;
$$;

grant execute on function admin_live_signals() to authenticated;
