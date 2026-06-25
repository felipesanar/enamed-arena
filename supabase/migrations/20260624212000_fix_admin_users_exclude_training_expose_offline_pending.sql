DROP FUNCTION IF EXISTS public.admin_list_users(text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT ''::text, p_segment text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, full_name text, email text, avatar_url text, segment text, specialty text, created_at timestamp with time zone, avg_score numeric, total_attempts bigint, total_count bigint, started_attempts bigint, training_attempts bigint, valid_attempts bigint, offline_pending_count bigint, in_progress_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('users.view');

  return query
  with valid_perf as (
    -- metricas de PROVA: so submitted dentro da janela (exclui treino)
    select
      h.user_id,
      round(avg(h.score_percentage), 2)::numeric as avg_score,
      count(*)::bigint                           as valid_attempts
    from user_performance_history h
    join attempts a on a.id = h.attempt_id
    where a.is_within_window = true
    group by h.user_id
  ),
  attempt_buckets as (
    -- volume de tentativa (started inclui treino + todos os status)
    select
      a.user_id,
      count(*)::bigint                                                              as started_attempts,
      count(*) filter (where a.status = 'submitted' and a.is_within_window = false)::bigint as training_attempts,
      count(*) filter (where a.status = 'offline_pending')::bigint                  as offline_pending_count,
      count(*) filter (where a.status = 'in_progress')::bigint                      as in_progress_count
    from attempts a
    group by a.user_id
  )
  select
    p.id                                          as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    op.specialty::text,
    p.created_at,
    coalesce(vp.avg_score, 0)                     as avg_score,
    coalesce(vp.valid_attempts, 0)::bigint        as total_attempts,
    count(*) over ()                              as total_count,
    coalesce(ab.started_attempts, 0)::bigint      as started_attempts,
    coalesce(ab.training_attempts, 0)::bigint     as training_attempts,
    coalesce(vp.valid_attempts, 0)::bigint        as valid_attempts,
    coalesce(ab.offline_pending_count, 0)::bigint as offline_pending_count,
    coalesce(ab.in_progress_count, 0)::bigint     as in_progress_count
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join valid_perf vp on vp.user_id = p.id
  left join attempt_buckets ab on ab.user_id = p.id
  where (
    p_search = ''
    or p.full_name ilike '%' || p_search || '%'
    or u.email ilike '%' || p_search || '%'
  )
  and (p_segment = 'all' or p.segment::text = p_segment)
  order by p.created_at desc
  limit p_limit offset p_offset;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated, service_role;
