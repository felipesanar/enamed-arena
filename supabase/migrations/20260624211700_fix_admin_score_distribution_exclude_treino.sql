CREATE OR REPLACE FUNCTION public.admin_score_distribution(p_simulado_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(bucket_label text, bucket_min integer, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('intel.view');

  return query
  select
    format('%s–%s', g.bucket_min, g.bucket_min + 10) as bucket_label,
    g.bucket_min,
    count(h.user_id)::bigint as count
  from generate_series(0, 90, 10) as g(bucket_min)
  left join (
    select h.user_id, h.score_percentage, h.simulado_id
    from user_performance_history h
    join attempts a on a.id = h.attempt_id
    where a.is_within_window
  ) h
    on least(floor(h.score_percentage / 10)::int * 10, 90) = g.bucket_min
    and (p_simulado_id is null or h.simulado_id = p_simulado_id)
  group by g.bucket_min
  order by g.bucket_min;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_score_distribution(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_score_distribution(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_score_distribution(uuid) TO authenticated, service_role;
