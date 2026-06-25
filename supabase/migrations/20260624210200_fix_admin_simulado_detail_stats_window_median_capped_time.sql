DROP FUNCTION IF EXISTS public.admin_simulado_detail_stats(uuid);
CREATE OR REPLACE FUNCTION public.admin_simulado_detail_stats(p_simulado_id uuid)
 RETURNS TABLE(
   simulado_id uuid,
   sequence_number integer,
   title text,
   participants bigint,
   completion_rate numeric,
   avg_score numeric,
   abandonment_rate numeric,
   avg_time_minutes numeric,
   median_time_minutes numeric,
   p90_time_minutes numeric,
   started_total bigint,
   treino_count bigint,
   completed_count bigint,
   in_progress_count bigint,
   offline_pending_count bigint
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('content.manage');

  return query
  select
    s.id                                                as simulado_id,
    s.sequence_number,
    s.title::text,
    -- participants: usuarios distintos VALIDOS (era count(*) inflado por treino/retentativa)
    count(distinct a.user_id) filter (where a.is_within_window)::bigint as participants,
    -- completion = submetidas validas / tentativas validas
    coalesce(round(
      count(*) filter (where a.is_within_window and a.status = 'submitted')::numeric
      / nullif(count(*) filter (where a.is_within_window), 0) * 100, 1), 0) as completion_rate,
    coalesce(round((
      select avg(uph.score_percentage)
      from user_performance_history uph
      join attempts a2 on a2.id = uph.attempt_id
      where a2.simulado_id = p_simulado_id
        and a2.is_within_window
    )::numeric, 1), 0)                                  as avg_score,
    -- abandono UNIFICADO = (in_progress + offline_pending) na janela / tentativas validas
    coalesce(round(
      count(*) filter (where a.is_within_window and a.status in ('in_progress','offline_pending'))::numeric
      / nullif(count(*) filter (where a.is_within_window), 0) * 100, 1), 0) as abandonment_rate,
    -- avg_time CAPADO no deadline, so submetidas validas, exclui finalizacao pos-deadline
    coalesce(round(
      avg(
        extract(epoch from (least(a.finished_at, a.effective_deadline) - a.started_at)) / 60.0
      ) filter (
        where a.is_within_window
          and a.status = 'submitted'
          and a.finished_at is not null
          and a.finished_at <= a.effective_deadline
      )::numeric, 1), 0)                                as avg_time_minutes,
    -- mediana (mais representativa que a media) -- coluna aditiva
    coalesce(round(
      percentile_cont(0.5) within group (
        order by extract(epoch from (least(a.finished_at, a.effective_deadline) - a.started_at)) / 60.0
      ) filter (
        where a.is_within_window
          and a.status = 'submitted'
          and a.finished_at is not null
          and a.finished_at <= a.effective_deadline
      )::numeric, 1), 0)                                as median_time_minutes,
    coalesce(round(
      percentile_cont(0.9) within group (
        order by extract(epoch from (least(a.finished_at, a.effective_deadline) - a.started_at)) / 60.0
      ) filter (
        where a.is_within_window
          and a.status = 'submitted'
          and a.finished_at is not null
          and a.finished_at <= a.effective_deadline
      )::numeric, 1), 0)                                as p90_time_minutes,
    count(a.id)::bigint                                  as started_total,
    count(*) filter (where not a.is_within_window)::bigint as treino_count,
    count(*) filter (where a.is_within_window and a.status = 'submitted')::bigint as completed_count,
    count(*) filter (where a.is_within_window and a.status = 'in_progress')::bigint as in_progress_count,
    count(*) filter (where a.is_within_window and a.status = 'offline_pending')::bigint as offline_pending_count
  from simulados s
  left join attempts a on a.simulado_id = s.id
  where s.id = p_simulado_id
  group by s.id, s.sequence_number, s.title;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_simulado_detail_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_simulado_detail_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_simulado_detail_stats(uuid) TO authenticated, service_role;
