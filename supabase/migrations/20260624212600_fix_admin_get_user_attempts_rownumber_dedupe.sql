CREATE OR REPLACE FUNCTION public.admin_get_user_attempts(p_user_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(attempt_id uuid, simulado_id uuid, sequence_number integer, simulado_title text, created_at timestamp with time zone, status text, score_percentage numeric, ranking_position bigint, is_within_window boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('users.view');

  return query
  with user_sims as (
    select distinct a.simulado_id
    from attempts a
    where a.user_id = p_user_id
  ),
  -- best valid attempt per user per simulado (app dedupe), only for sims this user touched
  best as (
    select distinct on (a.simulado_id, a.user_id)
      a.simulado_id, a.user_id, a.id as attempt_id,
      coalesce(uph.score_percentage, a.score_percentage) as score, a.finished_at
    from attempts a
    join user_sims us on us.simulado_id = a.simulado_id
    left join user_performance_history uph on uph.attempt_id = a.id
    where a.status in ('submitted', 'expired')
      and a.score_percentage is not null
      and a.is_within_window = true
    order by a.simulado_id, a.user_id, coalesce(uph.score_percentage, a.score_percentage) desc nulls last, a.finished_at asc nulls last
  ),
  ranked as (
    select b.simulado_id, b.attempt_id,
      row_number() over (partition by b.simulado_id order by b.score desc nulls last, b.finished_at asc nulls last) as posicao
    from best b
  )
  select
    a.id                                   as attempt_id,
    a.simulado_id,
    s.sequence_number,
    s.title::text                          as simulado_title,
    a.created_at,
    a.status::text,
    uph.score_percentage,
    case when a.is_within_window then r.posicao else null end as ranking_position,
    a.is_within_window
  from attempts a
  join simulados s on s.id = a.simulado_id
  left join user_performance_history uph on uph.attempt_id = a.id
  left join ranked r on r.attempt_id = a.id
  where a.user_id = p_user_id
  order by a.created_at desc
  limit p_limit;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_get_user_attempts(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_user_attempts(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_attempts(uuid, integer) TO authenticated, service_role;
