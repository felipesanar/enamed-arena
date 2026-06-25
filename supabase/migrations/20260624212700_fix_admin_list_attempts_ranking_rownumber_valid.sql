CREATE OR REPLACE FUNCTION public.admin_list_attempts(p_search text DEFAULT ''::text, p_simulado_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'all'::text, p_days integer DEFAULT 30, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(attempt_id uuid, user_id uuid, full_name text, email text, avatar_url text, simulado_id uuid, sequence_number integer, simulado_title text, created_at timestamp with time zone, status text, score_percentage numeric, ranking_position bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := case when p_days > 0 then now() - (p_days || ' days')::interval else '-infinity'::timestamptz end;
begin
  perform public.admin_require('attempts.view');

  return query
  with relevant_sims as (
    select distinct a.simulado_id from attempts a where a.created_at >= v_start
  ),
  best as (
    select distinct on (a.simulado_id, a.user_id)
      a.simulado_id, a.user_id, a.id as attempt_id,
      coalesce(uph.score_percentage, a.score_percentage) as score, a.finished_at
    from attempts a
    join relevant_sims rs on rs.simulado_id = a.simulado_id
    left join user_performance_history uph on uph.attempt_id = a.id
    where a.status in ('submitted', 'expired')
      and a.score_percentage is not null
      and a.is_within_window = true
    order by a.simulado_id, a.user_id, coalesce(uph.score_percentage, a.score_percentage) desc nulls last, a.finished_at asc nulls last
  ),
  ranked as (
    select b.attempt_id,
      row_number() over (partition by b.simulado_id order by b.score desc nulls last, b.finished_at asc nulls last) as posicao
    from best b
  ),
  base as (
    select
      a.id                   as attempt_id,
      a.user_id,
      p.full_name,
      au.email::text         as email,
      p.avatar_url::text     as avatar_url,
      s.id                   as simulado_id,
      s.sequence_number,
      s.title                as simulado_title,
      a.created_at,
      a.status::text,
      uph.score_percentage,
      case
        when a.status = 'submitted' and a.is_within_window = true then r.posicao
        else null
      end                    as ranking_position
    from attempts a
    join profiles p          on p.id = a.user_id
    join auth.users au       on au.id = a.user_id
    join simulados s         on s.id = a.simulado_id
    left join user_performance_history uph on uph.attempt_id = a.id
    left join ranked r       on r.attempt_id = a.id
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
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_list_attempts(text, uuid, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_attempts(text, uuid, text, integer, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_attempts(text, uuid, text, integer, integer, integer) TO authenticated, service_role;
