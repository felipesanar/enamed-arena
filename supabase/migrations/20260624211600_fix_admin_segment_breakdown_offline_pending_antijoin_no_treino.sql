DROP FUNCTION IF EXISTS public.admin_segment_breakdown();

CREATE OR REPLACE FUNCTION public.admin_segment_breakdown()
 RETURNS TABLE(segment text, users bigint, participants bigint, participation_rate numeric, avg_score numeric, avg_attempts numeric, concluded_participants bigint, pending_participants bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('intel.view');

  return query
  with admins as (
    select distinct user_id from user_roles
  ),
  participantes as (
    select distinct a.user_id
    from attempts a
    where a.status in ('in_progress','offline_pending','submitted')
      and a.is_within_window = true
  ),
  concluidos as (
    select distinct a.user_id
    from attempts a
    where a.status = 'submitted'
      and a.is_within_window = true
  ),
  pendentes as (
    select distinct a.user_id
    from attempts a
    where a.status = 'offline_pending'
      and a.is_within_window = true
  ),
  valid_exam as (
    select a.user_id,
           avg(a.score_percentage) as avg_s,
           count(*)               as n_valid
    from attempts a
    where a.status = 'submitted'
      and a.is_within_window = true
    group by a.user_id
  )
  select
    p.segment::text as segment,
    count(*)::bigint as users,
    count(*) filter (where pt.user_id is not null)::bigint as participants,
    round(100.0 * count(*) filter (where pt.user_id is not null) / nullif(count(*), 0), 1) as participation_rate,
    round(avg(ve.avg_s), 1) as avg_score,
    round(avg(coalesce(ve.n_valid, 0)), 1) as avg_attempts,
    count(*) filter (where cc.user_id is not null)::bigint as concluded_participants,
    count(*) filter (where pp.user_id is not null)::bigint as pending_participants
  from profiles p
  left join admins       ad on ad.user_id = p.id
  left join participantes pt on pt.user_id = p.id
  left join concluidos    cc on cc.user_id = p.id
  left join pendentes     pp on pp.user_id = p.id
  left join valid_exam    ve on ve.user_id = p.id
  where ad.user_id is null
  group by p.segment
  order by case p.segment::text when 'guest' then 1 when 'standard' then 2 when 'pro' then 3 else 4 end;
end;
$function$;

-- Restaura os grants que o DROP removeu (proacl vivo: authenticated=X, service_role=X).
GRANT EXECUTE ON FUNCTION public.admin_segment_breakdown() TO authenticated, service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_segment_breakdown() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_segment_breakdown() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_segment_breakdown() TO authenticated, service_role;
