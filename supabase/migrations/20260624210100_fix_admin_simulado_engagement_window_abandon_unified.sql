DROP FUNCTION IF EXISTS public.admin_simulado_engagement(integer);
CREATE OR REPLACE FUNCTION public.admin_simulado_engagement(p_limit integer DEFAULT 10)
 RETURNS TABLE(
   simulado_id uuid,
   sequence_number integer,
   title text,
   participants bigint,
   completion_rate numeric,
   avg_score numeric,
   abandonment_rate numeric,
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
  perform public.admin_require('dashboard.view');

  return query
  select
    s.id,
    s.sequence_number,
    s.title,
    -- participants: usuarios distintos VALIDOS (dentro da janela) = mesma definicao da detail
    count(distinct a.user_id) filter (where a.is_within_window)::bigint as participants,
    -- completion = submetidas validas / tentativas validas (treino fora)
    coalesce(round(
      count(*) filter (where a.is_within_window and a.status = 'submitted')::numeric
      / nullif(count(*) filter (where a.is_within_window), 0) * 100, 1), 0) as completion_rate,
    -- avg_score so de tentativas validas (uph nao tem offline_pending; join ja restringe a submitted)
    coalesce(round(avg(uph.score_percentage) filter (where a.is_within_window)::numeric, 1), 0) as avg_score,
    -- abandono UNIFICADO = (in_progress + offline_pending) dentro da janela / tentativas validas
    coalesce(round(
      count(*) filter (where a.is_within_window and a.status in ('in_progress','offline_pending'))::numeric
      / nullif(count(*) filter (where a.is_within_window), 0) * 100, 1), 0) as abandonment_rate,
    -- started_total = volume de tentativas (INCLUI treino) -- coluna aditiva
    count(a.id)::bigint as started_total,
    count(*) filter (where not a.is_within_window)::bigint as treino_count,
    count(*) filter (where a.is_within_window and a.status = 'submitted')::bigint as completed_count,
    count(*) filter (where a.is_within_window and a.status = 'in_progress')::bigint as in_progress_count,
    count(*) filter (where a.is_within_window and a.status = 'offline_pending')::bigint as offline_pending_count
  from simulados s
  left join attempts a on a.simulado_id = s.id
  left join user_performance_history uph on uph.attempt_id = a.id
  group by s.id, s.sequence_number, s.title, s.execution_window_start
  order by s.execution_window_start desc
  limit p_limit;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_simulado_engagement(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_simulado_engagement(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_simulado_engagement(integer) TO authenticated, service_role;
