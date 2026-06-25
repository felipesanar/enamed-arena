-- CORRIGIDO: CREATE OR REPLACE nao pode adicionar OUT params (42P13). Usa DROP + CREATE.
-- E re-concede grants explicitos + revoga PUBLIC/anon (CREATE novo auto-concede a PUBLIC).
DROP FUNCTION IF EXISTS public.admin_engagement_metrics(integer);

CREATE FUNCTION public.admin_engagement_metrics(p_days integer DEFAULT 30)
 RETURNS TABLE(started bigint, completed bigint, abandonment_rate numeric, abandonment_rate_prev numeric, avg_minutes numeric, avg_minutes_prev numeric, median_minutes numeric, avg_tab_exits numeric, avg_fullscreen_exits numeric, high_integrity_flag_pct numeric, started_valid bigint, offline_pending bigint, abandonment_rate_valid numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
  v_prev_start timestamptz := now() - (2 * p_days || ' days')::interval;
begin
  perform public.admin_require('intel.view');

  return query
  with cur as (
    select a.* from attempts a
    where a.created_at >= v_cur_start
      and not exists (select 1 from user_roles ur where ur.user_id = a.user_id)
  ),
  prev as (
    select a.* from attempts a
    where a.created_at >= v_prev_start and a.created_at < v_cur_start
      and not exists (select 1 from user_roles ur where ur.user_id = a.user_id)
  ),
  cur_agg as (
    select
      count(*)::bigint as started,
      count(*) filter (where is_within_window)::bigint as started_valid,
      count(*) filter (where is_within_window and status = 'submitted')::bigint as completed,
      count(*) filter (where is_within_window and status in ('in_progress','offline_pending'))::bigint as abandoned_valid,
      count(*) filter (where status = 'offline_pending')::bigint as offline_pending,
      round((avg(extract(epoch from (finished_at - started_at)) / 60.0) filter (where is_within_window and finished_at is not null))::numeric, 1) as avg_minutes,
      round((percentile_cont(0.5) within group (order by extract(epoch from (finished_at - started_at)) / 60.0)
            filter (where is_within_window and finished_at is not null))::numeric, 1) as median_minutes,
      round(avg(tab_exit_count) filter (where is_within_window), 1) as avg_tab_exits,
      round(avg(fullscreen_exit_count) filter (where is_within_window), 1) as avg_fullscreen_exits,
      count(*) filter (where is_within_window and tab_exit_count >= 3)::bigint as high_integrity_cnt
    from cur
  ),
  prev_agg as (
    select
      count(*) filter (where is_within_window)::bigint as started_valid,
      count(*) filter (where is_within_window and status in ('in_progress','offline_pending'))::bigint as abandoned_valid,
      round((avg(extract(epoch from (finished_at - started_at)) / 60.0) filter (where is_within_window and finished_at is not null))::numeric, 1) as avg_minutes
    from prev
  )
  select
    coalesce(c.started, 0) as started,
    coalesce(c.completed, 0) as completed,
    coalesce(round(100.0 * c.abandoned_valid / nullif(c.started_valid, 0), 1), 0) as abandonment_rate,
    coalesce(round(100.0 * pv.abandoned_valid / nullif(pv.started_valid, 0), 1), 0) as abandonment_rate_prev,
    coalesce(c.avg_minutes, 0) as avg_minutes,
    coalesce(pv.avg_minutes, 0) as avg_minutes_prev,
    coalesce(c.median_minutes, 0) as median_minutes,
    coalesce(c.avg_tab_exits, 0) as avg_tab_exits,
    coalesce(c.avg_fullscreen_exits, 0) as avg_fullscreen_exits,
    coalesce(round(100.0 * c.high_integrity_cnt / nullif(c.started_valid, 0), 1), 0) as high_integrity_flag_pct,
    coalesce(c.started_valid, 0) as started_valid,
    coalesce(c.offline_pending, 0) as offline_pending,
    coalesce(round(100.0 * c.abandoned_valid / nullif(c.started_valid, 0), 1), 0) as abandonment_rate_valid
  from cur_agg c cross join prev_agg pv;
end;
$function$;

-- Restaura o grant model original (paridade com a funcao viva) e fecha o auto-grant a PUBLIC/anon.
REVOKE EXECUTE ON FUNCTION public.admin_engagement_metrics(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_engagement_metrics(integer) TO authenticated, service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_engagement_metrics(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_engagement_metrics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_engagement_metrics(integer) TO authenticated, service_role;
