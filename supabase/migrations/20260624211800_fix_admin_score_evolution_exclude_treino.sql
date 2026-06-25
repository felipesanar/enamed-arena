CREATE OR REPLACE FUNCTION public.admin_score_evolution()
 RETURNS TABLE(simulado_id uuid, sequence_number integer, title text, participants bigint, avg_score numeric, median_score numeric, cutoff_proxy numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('intel.view');

  return query
  select
    s.id as simulado_id,
    s.sequence_number,
    s.title,
    count(distinct h.user_id)::bigint as participants,
    round(avg(h.score_percentage), 1) as avg_score,
    round((percentile_cont(0.5) within group (order by h.score_percentage))::numeric, 1) as median_score,
    round((avg(h.score_percentage) - 0.5 * coalesce(stddev_pop(h.score_percentage)::numeric, 0))::numeric, 1) as cutoff_proxy
  from user_performance_history h
  join attempts a on a.id = h.attempt_id
  join simulados s on s.id = h.simulado_id
  where a.is_within_window
  group by s.id, s.sequence_number, s.title
  order by s.sequence_number;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_score_evolution() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_score_evolution() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_score_evolution() TO authenticated, service_role;
