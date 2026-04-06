CREATE OR REPLACE FUNCTION public.admin_list_attempts(
  p_search text DEFAULT ''::text,
  p_simulado_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT 'all'::text,
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  attempt_id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  simulado_id uuid,
  sequence_number integer,
  simulado_title text,
  created_at timestamp with time zone,
  status text,
  score_percentage numeric,
  ranking_position bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := case when p_days > 0 then now() - (p_days || ' days')::interval else '-infinity'::timestamptz end;
begin
  if not exists (
    select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with base as (
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
$function$;