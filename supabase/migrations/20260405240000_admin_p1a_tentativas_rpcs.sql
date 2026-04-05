-- =====================================================================
-- Admin P1-A: Tentativas RPCs
-- =====================================================================

-- ─── 1. admin_attempts_kpis ──────────────────────────────────────────
-- Returns 4 KPI counts. p_days = 0 means all time.
create or replace function admin_attempts_kpis(p_days int default 30)
returns table (
  total        bigint,
  in_progress  bigint,
  submitted    bigint,
  expired      bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := case when p_days > 0 then now() - (p_days || ' days')::interval else '-infinity'::timestamptz end;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where status = 'in_progress')::bigint,
    count(*) filter (where status = 'submitted')::bigint,
    count(*) filter (where status = 'expired')::bigint
  from attempts
  where created_at >= v_start;
end;
$$;

grant execute on function admin_attempts_kpis(int) to authenticated;

-- ─── 2. admin_list_attempts ──────────────────────────────────────────
create or replace function admin_list_attempts(
  p_search      text    default '',
  p_simulado_id uuid    default null,
  p_status      text    default 'all',
  p_days        int     default 30,
  p_limit       int     default 25,
  p_offset      int     default 0
)
returns table (
  attempt_id       uuid,
  user_id          uuid,
  full_name        text,
  email            text,
  avatar_url       text,
  simulado_id      uuid,
  sequence_number  int,
  simulado_title   text,
  created_at       timestamptz,
  status           text,
  score_percentage numeric,
  ranking_position bigint,
  total_count      bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := case when p_days > 0 then now() - (p_days || ' days')::interval else '-infinity'::timestamptz end;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with base as (
    select
      a.id                   as attempt_id,
      a.user_id,
      p.full_name,
      au.email,
      p.avatar_url,
      s.id                   as simulado_id,
      s.sequence_number,
      s.title                as simulado_title,
      a.created_at,
      a.status::text,
      uph.score_percentage,
      case
        when a.status = 'submitted' and uph.score_percentage is not null then
          (select count(*) + 1
           from user_performance_history uph2
           where uph2.simulado_id = s.id
             and uph2.score_percentage > uph.score_percentage)::bigint
        else null
      end                    as ranking_position
    from attempts a
    join profiles p          on p.id = a.user_id
    join auth.users au       on au.id = a.user_id
    join simulados s         on s.id = a.simulado_id
    left join user_performance_history uph on uph.attempt_id = a.id
    where
      a.created_at >= v_start
      and (p_status = 'all' or a.status::text = p_status)
      and (p_simulado_id is null or a.simulado_id = p_simulado_id)
      and (
        p_search = ''
        or p.full_name ilike '%' || p_search || '%'
        or au.email    ilike '%' || p_search || '%'
      )
  )
  select b.*, count(*) over ()::bigint as total_count
  from base b
  order by b.created_at desc
  limit p_limit offset p_offset;
end;
$$;

grant execute on function admin_list_attempts(text, uuid, text, int, int, int) to authenticated;

-- ─── 3. admin_cancel_attempt ─────────────────────────────────────────
-- Sets in_progress attempt to expired. Raises if not in_progress.
create or replace function admin_cancel_attempt(p_attempt_id uuid)
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

  update attempts
  set status      = 'expired',
      finished_at = now()
  where id = p_attempt_id
    and status = 'in_progress';

  if not found then
    raise exception 'attempt not found or not in_progress' using errcode = 'P0004';
  end if;
end;
$$;

grant execute on function admin_cancel_attempt(uuid) to authenticated;

-- ─── 4. admin_delete_attempt ─────────────────────────────────────────
-- Deletes attempt + all dependent rows. Allows user to retake the simulado.
create or replace function admin_delete_attempt(p_attempt_id uuid)
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

  delete from user_performance_history  where attempt_id = p_attempt_id;
  delete from attempt_question_results  where attempt_id = p_attempt_id;
  delete from answers                   where attempt_id = p_attempt_id;
  delete from attempts                  where id         = p_attempt_id;
end;
$$;

grant execute on function admin_delete_attempt(uuid) to authenticated;
