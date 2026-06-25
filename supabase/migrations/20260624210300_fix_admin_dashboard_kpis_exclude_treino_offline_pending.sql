DROP FUNCTION IF EXISTS public.admin_dashboard_kpis(integer);

CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis(p_days integer DEFAULT 7)
 RETURNS TABLE(total_users bigint, new_users bigint, new_users_prev bigint, exams_started bigint, exams_started_prev bigint, completion_rate numeric, completion_rate_prev numeric, avg_score numeric, avg_score_prev numeric, activation_rate numeric, activation_rate_prev numeric, abandonment_rate numeric, abandonment_rate_prev numeric, offline_pending bigint, completion_valid_denom bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now         timestamptz := now();
  v_cur_start   timestamptz := v_now - (p_days || ' days')::interval;
  v_prev_start  timestamptz := v_now - (p_days * 2 || ' days')::interval;
begin
  perform public.admin_require('dashboard.view');

  return query
  select
    (select count(*)::bigint from profiles),
    (select count(*)::bigint from profiles where created_at >= v_cur_start),
    (select count(*)::bigint from profiles where created_at >= v_prev_start and created_at < v_cur_start),
    (select count(*)::bigint from attempts where created_at >= v_cur_start),
    (select count(*)::bigint from attempts where created_at >= v_prev_start and created_at < v_cur_start),
    coalesce(round((select count(*) filter (where status = 'submitted')::numeric / nullif(count(*) filter (where status in ('submitted','offline_pending','in_progress')), 0) * 100 from attempts where created_at >= v_cur_start and is_within_window = true),1),0),
    coalesce(round((select count(*) filter (where status = 'submitted')::numeric / nullif(count(*) filter (where status in ('submitted','offline_pending','in_progress')), 0) * 100 from attempts where created_at >= v_prev_start and created_at < v_cur_start and is_within_window = true),1),0),
    coalesce(round((select avg(score_percentage) from attempts where finished_at >= v_cur_start and status = 'submitted' and is_within_window = true)::numeric,1),0),
    coalesce(round((select avg(score_percentage) from attempts where finished_at >= v_prev_start and finished_at < v_cur_start and status = 'submitted' and is_within_window = true)::numeric,1),0),
    coalesce(round((select count(distinct a.user_id)::numeric / nullif((select count(*) from profiles where created_at >= v_cur_start), 0) * 100 from attempts a join profiles p on p.id = a.user_id where p.created_at >= v_cur_start),1),0),
    coalesce(round((select count(distinct a.user_id)::numeric / nullif((select count(*) from profiles where created_at >= v_prev_start and created_at < v_cur_start), 0) * 100 from attempts a join profiles p on p.id = a.user_id where p.created_at >= v_prev_start and p.created_at < v_cur_start),1),0),
    coalesce(round((select count(*) filter (where status in ('offline_pending','in_progress'))::numeric / nullif(count(*) filter (where status in ('submitted','offline_pending','in_progress')), 0) * 100 from attempts where created_at >= v_cur_start and is_within_window = true),1),0),
    coalesce(round((select count(*) filter (where status in ('offline_pending','in_progress'))::numeric / nullif(count(*) filter (where status in ('submitted','offline_pending','in_progress')), 0) * 100 from attempts where created_at >= v_prev_start and created_at < v_cur_start and is_within_window = true),1),0),
    (select count(*)::bigint from attempts where created_at >= v_cur_start and is_within_window = true and status = 'offline_pending'),
    (select count(*)::bigint from attempts where created_at >= v_cur_start and is_within_window = true and status in ('submitted','offline_pending','in_progress'));
end;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_kpis(integer) TO authenticated, service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_dashboard_kpis(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_kpis(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_kpis(integer) TO authenticated, service_role;
