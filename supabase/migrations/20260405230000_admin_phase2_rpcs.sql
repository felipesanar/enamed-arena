-- =====================================================================
-- Admin Phase 2 RPCs — Usuários + Simulados Analítica
-- Todas as funções são SECURITY DEFINER com verificação de role admin.
-- =====================================================================

-- ─── 1. admin_list_users ──────────────────────────────────────────────
create or replace function admin_list_users(
  p_search  text    default '',
  p_segment text    default 'all',
  p_limit   int     default 25,
  p_offset  int     default 0
)
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  avatar_url     text,
  segment        text,
  specialty      text,
  created_at     timestamptz,
  avg_score      numeric,
  total_attempts bigint,
  total_count    bigint
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
    p.id                                    as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    op.specialty::text,
    p.created_at,
    coalesce(ps.avg_score, 0)              as avg_score,
    coalesce(ps.total_attempts, 0)::bigint as total_attempts,
    count(*) over ()                        as total_count
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
  where (
    p_search = ''
    or p.full_name ilike '%' || p_search || '%'
    or u.email ilike '%' || p_search || '%'
  )
  and (p_segment = 'all' or p.segment::text = p_segment)
  order by p.created_at desc
  limit p_limit offset p_offset;
end;
$$;

grant execute on function admin_list_users(text, text, int, int) to authenticated;

-- ─── 2. admin_get_user ────────────────────────────────────────────────
create or replace function admin_get_user(p_user_id uuid)
returns table (
  user_id           uuid,
  full_name         text,
  email             text,
  avatar_url        text,
  segment           text,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  specialty         text,
  target_institutions text[],
  avg_score         numeric,
  best_score        numeric,
  last_score        numeric,
  total_attempts    bigint,
  last_finished_at  timestamptz,
  is_admin          boolean
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
    p.id                                           as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    p.created_at,
    u.last_sign_in_at,
    op.specialty::text,
    op.target_institutions,
    coalesce(ps.avg_score, 0)                     as avg_score,
    coalesce(ps.best_score, 0)                    as best_score,
    coalesce(ps.last_score, 0)                    as last_score,
    coalesce(ps.total_attempts, 0)::bigint        as total_attempts,
    ps.last_finished_at,
    exists(
      select 1 from user_roles ur2
      where ur2.user_id = p.id and ur2.role = 'admin'
    )                                              as is_admin
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
  where p.id = p_user_id;
end;
$$;

grant execute on function admin_get_user(uuid) to authenticated;

-- ─── 3. admin_get_user_attempts ───────────────────────────────────────
create or replace function admin_get_user_attempts(
  p_user_id uuid,
  p_limit   int default 10
)
returns table (
  attempt_id       uuid,
  simulado_id      uuid,
  sequence_number  int,
  simulado_title   text,
  created_at       timestamptz,
  status           text,
  score_percentage numeric,
  ranking_position bigint
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
    a.id                                   as attempt_id,
    a.simulado_id,
    s.sequence_number,
    s.title::text                          as simulado_title,
    a.created_at,
    a.status::text,
    uph.score_percentage,
    coalesce(
      (
        select count(*) + 1
        from user_performance_history uph2
        where uph2.simulado_id = a.simulado_id
          and uph2.is_within_window = true
          and uph2.score_percentage > coalesce(uph.score_percentage, -1)
      ),
      0
    )::bigint                              as ranking_position
  from attempts a
  join simulados s on s.id = a.simulado_id
  left join user_performance_history uph on uph.attempt_id = a.id
  where a.user_id = p_user_id
  order by a.created_at desc
  limit p_limit;
end;
$$;

grant execute on function admin_get_user_attempts(uuid, int) to authenticated;

-- ─── 4. admin_simulado_detail_stats ──────────────────────────────────
create or replace function admin_simulado_detail_stats(p_simulado_id uuid)
returns table (
  simulado_id      uuid,
  sequence_number  int,
  title            text,
  participants     bigint,
  completion_rate  numeric,
  avg_score        numeric,
  abandonment_rate numeric,
  avg_time_minutes numeric
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
    s.id                                                as simulado_id,
    s.sequence_number,
    s.title::text,
    count(*)::bigint                                    as participants,
    coalesce(round(
      count(*) filter (where a.status in ('submitted', 'expired'))::numeric
      / nullif(count(*), 0) * 100, 1), 0)              as completion_rate,
    coalesce(round((
      select avg(uph.score_percentage)
      from user_performance_history uph
      join attempts a2 on a2.id = uph.attempt_id
      where a2.simulado_id = p_simulado_id
    )::numeric, 1), 0)                                  as avg_score,
    coalesce(round(
      count(*) filter (where a.status = 'in_progress')::numeric
      / nullif(count(*), 0) * 100, 1), 0)              as abandonment_rate,
    coalesce(round(
      avg(
        extract(epoch from (a.finished_at - a.started_at)) / 60.0
      ) filter (
        where a.status in ('submitted', 'expired')
          and a.finished_at is not null
      )::numeric, 1), 0)                                as avg_time_minutes
  from simulados s
  left join attempts a on a.simulado_id = s.id
  where s.id = p_simulado_id
  group by s.id, s.sequence_number, s.title;
end;
$$;

grant execute on function admin_simulado_detail_stats(uuid) to authenticated;

-- ─── 5. admin_simulado_question_stats ────────────────────────────────
create or replace function admin_simulado_question_stats(p_simulado_id uuid)
returns table (
  question_number          int,
  text                     text,
  correct_rate             numeric,
  discrimination_index     numeric,
  most_common_wrong_label  text,
  most_common_wrong_pct    numeric
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
  with scored_attempts as (
    select a.id as attempt_id, uph.score_percentage
    from attempts a
    join user_performance_history uph on uph.attempt_id = a.id
    where a.simulado_id = p_simulado_id
      and a.status in ('submitted', 'expired')
  ),
  percentiles as (
    select
      percentile_cont(0.73) within group (order by score_percentage) as p73,
      percentile_cont(0.27) within group (order by score_percentage) as p27
    from scored_attempts
  ),
  question_stats as (
    select
      aqr.question_id,
      round(avg(case when aqr.is_correct then 1.0 else 0.0 end) * 100, 1) as correct_rate,
      round(
        (
          avg(case when sa.score_percentage >= pe.p73 and aqr.is_correct then 1.0
                   when sa.score_percentage >= pe.p73 then 0.0
                   else null end)
          -
          avg(case when sa.score_percentage <= pe.p27 and aqr.is_correct then 1.0
                   when sa.score_percentage <= pe.p27 then 0.0
                   else null end)
        ) * 100, 1
      ) as discrimination_index
    from attempt_question_results aqr
    join scored_attempts sa on sa.attempt_id = aqr.attempt_id
    cross join percentiles pe
    where aqr.was_answered = true
    group by aqr.question_id
  ),
  wrong_answers as (
    select distinct on (aqr.question_id)
      aqr.question_id,
      qo.label::text as most_common_wrong_label,
      round(
        count(*)::numeric
        / nullif(
            (select count(*) from attempt_question_results aqr2
             where aqr2.question_id = aqr.question_id and aqr2.was_answered = true),
            0
          ) * 100, 1
      ) as most_common_wrong_pct
    from attempt_question_results aqr
    join question_options qo on qo.id = aqr.selected_option_id
    join scored_attempts sa on sa.attempt_id = aqr.attempt_id
    where aqr.is_correct = false
      and aqr.was_answered = true
      and qo.is_correct = false
    group by aqr.question_id, qo.label
    order by aqr.question_id, count(*) desc
  )
  select
    q.question_number,
    q.text::text,
    coalesce(qs.correct_rate, 0)            as correct_rate,
    coalesce(qs.discrimination_index, 0)    as discrimination_index,
    wa.most_common_wrong_label,
    wa.most_common_wrong_pct
  from questions q
  join question_stats qs on qs.question_id = q.id
  left join wrong_answers wa on wa.question_id = q.id
  where q.simulado_id = p_simulado_id
  order by qs.correct_rate asc;
end;
$$;

grant execute on function admin_simulado_question_stats(uuid) to authenticated;

-- ─── 6. admin_set_user_segment ────────────────────────────────────────
create or replace function admin_set_user_segment(
  p_user_id uuid,
  p_segment text
)
returns void
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

  update profiles
  set segment = p_segment::user_segment
  where id = p_user_id;
end;
$$;

grant execute on function admin_set_user_segment(uuid, text) to authenticated;

-- ─── 7. admin_set_user_role ──────────────────────────────────────────
create or replace function admin_set_user_role(
  p_user_id uuid,
  p_role    text,
  p_grant   boolean
)
returns void
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

  if p_grant then
    insert into user_roles (user_id, role)
    values (p_user_id, p_role)
    on conflict do nothing;
  else
    delete from user_roles
    where user_id = p_user_id and role = p_role;
  end if;
end;
$$;

grant execute on function admin_set_user_role(uuid, text, boolean) to authenticated;

-- ─── 8. admin_reset_user_onboarding ──────────────────────────────────
create or replace function admin_reset_user_onboarding(p_user_id uuid)
returns void
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

  delete from onboarding_profiles where user_id = p_user_id;
end;
$$;

grant execute on function admin_reset_user_onboarding(uuid) to authenticated;
