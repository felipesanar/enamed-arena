DROP FUNCTION IF EXISTS public.admin_get_user(uuid);
CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, avatar_url text, segment text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, specialty text, target_institutions text[], avg_score numeric, best_score numeric, last_score numeric, total_attempts bigint, last_finished_at timestamp with time zone, is_admin boolean, roles text[], started_attempts bigint, training_attempts bigint, valid_attempts bigint, offline_pending_count bigint, in_progress_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_avg_score   numeric := 0;
  v_best_score  numeric := 0;
  v_last_score  numeric := 0;
  v_valid_count bigint  := 0;
  v_last_finished_at timestamptz := null;
  v_started_attempts bigint := 0;
  v_training_attempts bigint := 0;
  v_offline_pending_count bigint := 0;
  v_in_progress_count bigint := 0;
begin
  perform public.admin_require('users.view');

  -- Metricas de PROVA: somente submitted dentro da janela (exclui treino)
  select
    coalesce(round(avg(h.score_percentage), 2), 0),
    coalesce(max(h.score_percentage), 0),
    count(*)
  into v_avg_score, v_best_score, v_valid_count
  from user_performance_history h
  join attempts a on a.id = h.attempt_id
  where h.user_id = p_user_id and a.is_within_window = true;

  -- Ultima nota / ultima conclusao: ultima PROVA VALIDA (treino nao conta)
  select h.score_percentage, h.finished_at
  into v_last_score, v_last_finished_at
  from user_performance_history h
  join attempts a on a.id = h.attempt_id
  where h.user_id = p_user_id and a.is_within_window = true
  order by h.finished_at desc
  limit 1;

  -- Buckets de volume de tentativa (started inclui treino + todos os status)
  select
    count(*),
    count(*) filter (where a.status = 'submitted' and a.is_within_window = false),
    count(*) filter (where a.status = 'offline_pending'),
    count(*) filter (where a.status = 'in_progress')
  into v_started_attempts, v_training_attempts, v_offline_pending_count, v_in_progress_count
  from attempts a
  where a.user_id = p_user_id;

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
    v_avg_score                                    as avg_score,
    v_best_score                                   as best_score,
    coalesce(v_last_score, 0)                      as last_score,
    v_valid_count::bigint                          as total_attempts,
    v_last_finished_at                             as last_finished_at,
    exists(
      select 1 from user_roles ur2
      where ur2.user_id = p.id and ur2.role = 'admin'
    )                                              as is_admin,
    (select coalesce(array_agg(ur.role::text), '{}') from user_roles ur where ur.user_id = p_user_id) as roles,
    v_started_attempts                             as started_attempts,
    v_training_attempts                            as training_attempts,
    v_valid_count::bigint                          as valid_attempts,
    v_offline_pending_count                        as offline_pending_count,
    v_in_progress_count                            as in_progress_count
  from profiles p
  join auth.users u on u.id = p.id
  left join onboarding_profiles op on op.user_id = p.id
  where p.id = p_user_id;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO authenticated, service_role;
