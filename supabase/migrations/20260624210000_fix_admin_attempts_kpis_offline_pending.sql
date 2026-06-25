DROP FUNCTION IF EXISTS public.admin_attempts_kpis(integer);
CREATE OR REPLACE FUNCTION public.admin_attempts_kpis(p_days integer DEFAULT 30)
 RETURNS TABLE(
   total bigint,
   in_progress bigint,
   submitted bigint,
   expired bigint,
   offline_pending bigint,
   submitted_valid bigint,
   in_progress_valid bigint,
   offline_pending_valid bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := case when p_days > 0 then now() - (p_days || ' days')::interval else '-infinity'::timestamptz end;
begin
  perform public.admin_require('attempts.view');

  return query
  select
    count(*)::bigint,
    count(*) filter (where status = 'in_progress')::bigint,
    count(*) filter (where status = 'submitted')::bigint,
    count(*) filter (where status = 'expired')::bigint,
    count(*) filter (where status = 'offline_pending')::bigint,
    count(*) filter (where status = 'submitted' and is_within_window)::bigint,
    count(*) filter (where status = 'in_progress' and is_within_window)::bigint,
    count(*) filter (where status = 'offline_pending' and is_within_window)::bigint
  from attempts
  where created_at >= v_start;
end;
$function$;

grant execute on function public.admin_attempts_kpis(int) to authenticated;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_attempts_kpis(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_attempts_kpis(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_attempts_kpis(integer) TO authenticated, service_role;
