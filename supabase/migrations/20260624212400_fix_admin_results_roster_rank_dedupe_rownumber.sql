-- FIX: precede com DROP porque CREATE OR REPLACE não pode adicionar coluna (app_rank) ao RETURNS TABLE (erro 42P13).
DROP FUNCTION IF EXISTS public.admin_simulado_results_roster(uuid, text, text, text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_simulado_results_roster(p_simulado_id uuid, p_sort text DEFAULT 'score'::text, p_dir text DEFAULT 'desc'::text, p_scope text DEFAULT 'valid'::text, p_search text DEFAULT ''::text, p_segment text DEFAULT 'all'::text, p_institution text DEFAULT 'all'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(rank bigint, total_rows bigint, user_id uuid, attempt_id uuid, name text, email text, segment text, institution text, specialty text, score numeric, correct_count integer, total_count integer, duration_seconds integer, submitted_at timestamp with time zone, is_within_window boolean, app_rank bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dir text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
begin
  perform public.admin_require('results.view');

  return query
  with eligible as (
    select a.id as attempt_id, a.user_id, a.is_within_window, a.started_at, a.finished_at,
      a.total_correct, s.questions_count as total_count,
      coalesce(uph.score_percentage, a.score_percentage) as score
    from attempts a
    join simulados s on s.id = a.simulado_id
    left join user_performance_history uph on uph.attempt_id = a.id
    where a.simulado_id = p_simulado_id and a.status = 'submitted'
      and (p_scope = 'all'
        or (p_scope = 'valid'    and a.is_within_window)
        or (p_scope = 'training' and not a.is_within_window))
  ),
  best as (
    select distinct on (e.user_id) e.*
    from eligible e
    order by e.user_id, e.score desc nulls last, e.finished_at asc nulls last
  ),
  ranked as (
    select b.*, row_number() over (order by b.score desc nulls last, b.finished_at asc nulls last) as rnk
    from best b
  ),
  joined as (
    select r.rnk, r.user_id, r.attempt_id, p.full_name as name, au.email::text as email,
      p.segment::text as segment,
      coalesce(nullif(o.target_institutions[1], ''), '—') as institution,
      coalesce(nullif(o.specialty, ''), '—') as specialty,
      r.score, r.total_correct as correct_count, r.total_count,
      case when r.finished_at is not null and r.started_at is not null
        then extract(epoch from (r.finished_at - r.started_at))::int else null end as duration_seconds,
      r.finished_at as submitted_at, r.is_within_window
    from ranked r
    join profiles p on p.id = r.user_id
    join auth.users au on au.id = r.user_id
    left join onboarding_profiles o on o.user_id = r.user_id
    where (p_search = '' or p.full_name ilike '%' || p_search || '%' or au.email ilike '%' || p_search || '%')
      and (p_segment = 'all' or p.segment::text = p_segment)
      and (p_institution = 'all' or o.target_institutions[1] = p_institution)
  )
  select j.rnk as rank, count(*) over()::bigint as total_rows,
    j.user_id, j.attempt_id, j.name, j.email, j.segment, j.institution, j.specialty,
    j.score, j.correct_count, j.total_count, j.duration_seconds, j.submitted_at, j.is_within_window,
    case when p_scope = 'valid' then j.rnk else null end::bigint as app_rank
  from joined j
  order by
    case when p_sort = 'name'             and v_dir = 'asc'  then j.name end asc nulls last,
    case when p_sort = 'name'             and v_dir = 'desc' then j.name end desc nulls last,
    case when p_sort = 'email'            and v_dir = 'asc'  then j.email end asc nulls last,
    case when p_sort = 'email'            and v_dir = 'desc' then j.email end desc nulls last,
    case when p_sort = 'segment'          and v_dir = 'asc'  then j.segment end asc nulls last,
    case when p_sort = 'segment'          and v_dir = 'desc' then j.segment end desc nulls last,
    case when p_sort = 'institution'      and v_dir = 'asc'  then j.institution end asc nulls last,
    case when p_sort = 'institution'      and v_dir = 'desc' then j.institution end desc nulls last,
    case when p_sort = 'specialty'        and v_dir = 'asc'  then j.specialty end asc nulls last,
    case when p_sort = 'specialty'        and v_dir = 'desc' then j.specialty end desc nulls last,
    case when p_sort = 'score'            and v_dir = 'asc'  then j.score end asc nulls last,
    case when p_sort = 'score'            and v_dir = 'desc' then j.score end desc nulls last,
    case when p_sort = 'correct_count'    and v_dir = 'asc'  then j.correct_count end asc nulls last,
    case when p_sort = 'correct_count'    and v_dir = 'desc' then j.correct_count end desc nulls last,
    case when p_sort = 'duration_seconds' and v_dir = 'asc'  then j.duration_seconds end asc nulls last,
    case when p_sort = 'duration_seconds' and v_dir = 'desc' then j.duration_seconds end desc nulls last,
    case when p_sort = 'submitted_at'     and v_dir = 'asc'  then j.submitted_at end asc nulls last,
    case when p_sort = 'submitted_at'     and v_dir = 'desc' then j.submitted_at end desc nulls last,
    j.rnk asc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_simulado_results_roster(uuid, text, text, text, text, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_simulado_results_roster(uuid, text, text, text, text, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_simulado_results_roster(uuid, text, text, text, text, text, text, integer, integer) TO authenticated, service_role;
