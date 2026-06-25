-- Home "Agora": enriquece admin_live_signals com contexto fiel (active_today +
-- last_activity_at) para que o "0 agora" (real quando está quieto) não pareça travado.
-- Online (15 min) = união de atividade real (eventos de telemetria + progresso salvo
-- de prova), excluindo admins; active_exams = provas reais em curso (in_progress, na
-- janela, prazo no futuro). Sem heartbeat/presença → confiança 'low' (honesto).
-- DROP+CREATE (muda row type) + re-grant (ACL limpo: authenticated/service_role).
DROP FUNCTION IF EXISTS public.admin_live_signals();
CREATE OR REPLACE FUNCTION public.admin_live_signals()
 RETURNS TABLE(
   online_last_15min bigint, active_exams bigint, open_tickets bigint,
   offline_pending_now bigint, online_confidence text, tickets_supported boolean,
   active_today bigint, last_activity_at timestamptz
 )
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  perform public.admin_require('dashboard.view');

  return query
  select
    (select count(distinct z.uid) from (
       select ae.user_id as uid from analytics_events ae
         where ae.created_at >= now() - interval '15 minutes' and ae.user_id is not null
       union
       select a.user_id as uid from attempts a
         where a.last_saved_at >= now() - interval '15 minutes'
     ) z where not exists (select 1 from user_roles ur where ur.user_id = z.uid))::bigint as online_last_15min,

    (select count(*) from attempts a
      where a.status = 'in_progress' and a.is_within_window = true
        and (a.effective_deadline is null or a.effective_deadline > now()))::bigint as active_exams,

    0::bigint as open_tickets,

    (select count(*) from attempts a
      where a.status = 'offline_pending' and a.is_within_window = true)::bigint as offline_pending_now,

    'low'::text as online_confidence,
    false::boolean as tickets_supported,

    (select count(distinct z.uid) from (
       select ae.user_id as uid from analytics_events ae
         where ae.created_at >= v_day_start and ae.user_id is not null
       union
       select a.user_id as uid from attempts a
         where a.last_saved_at >= v_day_start
     ) z where not exists (select 1 from user_roles ur where ur.user_id = z.uid))::bigint as active_today,

    greatest(
      (select max(ae.created_at) from analytics_events ae where ae.user_id is not null),
      (select max(a.last_saved_at) from attempts a)
    ) as last_activity_at;
end;
$function$;
REVOKE ALL ON FUNCTION public.admin_live_signals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_live_signals() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_live_signals() TO authenticated, service_role;
