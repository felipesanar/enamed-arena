-- =====================================================================
-- Admin P1-A: Marketing RPCs — UTM & Acquisition Analysis
-- =====================================================================

-- ─── 1. admin_marketing_kpis ─────────────────────────────────────────
create or replace function admin_marketing_kpis(p_days int default 30)
returns table (
  new_users            bigint,
  new_users_prev       bigint,
  landing_to_signup_pct numeric,
  active_campaigns     bigint,
  organic_pct          numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start      timestamptz := now() - (p_days || ' days')::interval;
  v_prev_start timestamptz := now() - (p_days * 2 || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    (select count(*)::bigint from profiles where created_at >= v_start),
    (select count(*)::bigint from profiles where created_at >= v_prev_start and created_at < v_start),
    -- landing → signup conv
    coalesce(round(
      (select count(distinct p.id)::numeric from profiles p where p.created_at >= v_start)
      / nullif(
          (select count(distinct coalesce(user_id::text, payload->>'session_id'))
           from analytics_events
           where event_name = 'landing_page_viewed' and created_at >= v_start), 0
        ) * 100, 1), 0),
    -- active campaigns (distinct utm_campaign values in period)
    (select count(distinct payload->>'utm_campaign')
     from analytics_events
     where created_at >= v_start
       and payload->>'utm_campaign' is not null
       and payload->>'utm_campaign' != '')::bigint,
    -- organic pct (signups with no utm_source)
    coalesce(round(
      (select count(*)::numeric from profiles p
       where p.created_at >= v_start
         and not exists (
           select 1 from analytics_events ae
           where ae.user_id = p.id
             and ae.created_at >= v_start
             and ae.payload->>'utm_source' is not null
             and ae.payload->>'utm_source' != ''
         ))
      / nullif((select count(*) from profiles where created_at >= v_start)::numeric, 0) * 100,
    1), 0);
end;
$$;

grant execute on function admin_marketing_kpis(int) to authenticated;

-- ─── 2. admin_marketing_sources ──────────────────────────────────────
create or replace function admin_marketing_sources(p_days int default 30)
returns table (
  source     text,
  user_count bigint,
  conv_rate  numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start    timestamptz := now() - (p_days || ' days')::interval;
  v_total    bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  select count(*) into v_total from profiles where created_at >= v_start;

  return query
  with user_first_src as (
    select
      p.id,
      coalesce(
        (select nullif(ae.payload->>'utm_source', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_source' is not null
         order by ae.created_at asc limit 1),
        'organic'
      ) as source
    from profiles p
    where p.created_at >= v_start
  )
  select
    source,
    count(*)::bigint,
    round(count(*)::numeric / nullif(v_total, 0) * 100, 1)
  from user_first_src
  group by source
  order by 2 desc
  limit 8;
end;
$$;

grant execute on function admin_marketing_sources(int) to authenticated;

-- ─── 3. admin_marketing_mediums ──────────────────────────────────────
create or replace function admin_marketing_mediums(p_days int default 30)
returns table (
  medium     text,
  user_count bigint,
  conv_rate  numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
  v_total bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  select count(*) into v_total from profiles where created_at >= v_start;

  return query
  with user_first_med as (
    select
      p.id,
      coalesce(
        (select nullif(ae.payload->>'utm_medium', '')
         from analytics_events ae
         where ae.user_id = p.id and ae.payload->>'utm_medium' is not null
         order by ae.created_at asc limit 1),
        '(nenhum)'
      ) as medium
    from profiles p
    where p.created_at >= v_start
  )
  select
    medium,
    count(*)::bigint,
    round(count(*)::numeric / nullif(v_total, 0) * 100, 1)
  from user_first_med
  group by medium
  order by 2 desc
  limit 8;
end;
$$;

grant execute on function admin_marketing_mediums(int) to authenticated;

-- ─── 4. admin_marketing_campaigns ────────────────────────────────────
create or replace function admin_marketing_campaigns(p_days int default 30)
returns table (
  campaign    text,
  source      text,
  visits      bigint,
  signups     bigint,
  conv_rate   numeric,
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
  with camp_visits as (
    select
      coalesce(nullif(payload->>'utm_campaign', ''), '(sem campanha)') as campaign,
      coalesce(nullif(payload->>'utm_source', ''),   'organic')        as source,
      count(distinct coalesce(user_id::text, payload->>'session_id'))  as visits
    from analytics_events
    where event_name = 'landing_page_viewed'
      and created_at >= v_start
    group by 1, 2
  ),
  camp_signups as (
    select
      coalesce(
        (select nullif(ae.payload->>'utm_campaign', '')
         from analytics_events ae where ae.user_id = p.id
         and ae.payload->>'utm_campaign' is not null
         order by ae.created_at asc limit 1),
        '(sem campanha)'
      ) as campaign,
      count(*) as signups,
      count(distinct a.user_id) as first_exams
    from profiles p
    left join (
      select user_id, min(created_at) as created_at from attempts group by user_id
    ) a on a.user_id = p.id and a.created_at >= v_start
    where p.created_at >= v_start
    group by 1
  )
  select
    coalesce(cv.campaign, cs.campaign, '(sem campanha)') as campaign,
    coalesce(cv.source, 'organic')                        as source,
    coalesce(cv.visits, 0)::bigint,
    coalesce(cs.signups, 0)::bigint,
    coalesce(round(cs.signups::numeric / nullif(cv.visits, 0) * 100, 1), 0),
    coalesce(cs.first_exams, 0)::bigint
  from camp_visits cv
  full join camp_signups cs on cs.campaign = cv.campaign
  order by coalesce(cs.signups, 0) desc
  limit 20;
end;
$$;

grant execute on function admin_marketing_campaigns(int) to authenticated;
