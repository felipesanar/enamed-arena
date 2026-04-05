
-- Fix admin_list_users: qualify user_roles.user_id with alias
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT ''::text,
  p_segment text DEFAULT 'all'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(user_id uuid, full_name text, email text, avatar_url text, segment text, specialty text, created_at timestamp with time zone, avg_score numeric, total_attempts bigint, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    p.id                                    as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    op.specialty::text,
    p.created_at,
    coalesce(ps.avg_score, 0)              as avg_score,
    coalesce(ps.total_attempts, 0)::bigint as total_attempts,
    count(*) over ()                        as total_count
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
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

-- Fix admin_get_user: qualify user_roles.user_id with alias
CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, avatar_url text, segment text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, specialty text, target_institutions text[], avg_score numeric, best_score numeric, last_score numeric, total_attempts bigint, last_finished_at timestamp with time zone, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    p.id                                           as user_id,
    p.full_name::text,
    u.email::text,
    p.avatar_url::text,
    p.segment::text,
    p.created_at,
    u.last_sign_in_at,
    op.specialty::text,
    op.target_institutions,
    coalesce(ps.avg_score, 0)                     as avg_score,
    coalesce(ps.best_score, 0)                    as best_score,
    coalesce(ps.last_score, 0)                    as last_score,
    coalesce(ps.total_attempts, 0)::bigint        as total_attempts,
    ps.last_finished_at,
    exists(
      select 1 from user_roles ur2
      where ur2.user_id = p.id and ur2.role = 'admin'
    )                                              as is_admin
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  left join user_performance_summary ps on ps.user_id = p.id
  where p.id = p_user_id;
end;
$function$;
