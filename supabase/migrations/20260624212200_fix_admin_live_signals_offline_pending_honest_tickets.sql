-- Migration: fix_admin_live_signals_offline_pending_honest_tickets
-- Dominio: live-signals. RPC: admin_live_signals.
-- ADITIVO: preserva online_last_15min/active_exams/open_tickets (nome+tipo+ordem);
-- adiciona offline_pending_now, online_confidence, tickets_supported no fim.
-- DROP necessario porque adicionar OUT params muda o tipo de retorno (42P13).

DROP FUNCTION IF EXISTS public.admin_live_signals();

CREATE OR REPLACE FUNCTION public.admin_live_signals()
 RETURNS TABLE(
   online_last_15min bigint,
   active_exams bigint,
   open_tickets bigint,
   offline_pending_now bigint,
   online_confidence text,
   tickets_supported boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('dashboard.view');

  return query
  select
    -- online_last_15min: proxy confiavel = uniao de atividade real
    -- (eventos de telemetria + progresso salvo de prova), excluindo contas internas/admin.
    -- Baixa confianca: nao ha sessao de auth persistida (profiles.last_sign_in_at inexistente).
    (select count(distinct z.uid)
       from (
         select ae.user_id as uid
           from analytics_events ae
          where ae.created_at >= now() - interval '15 minutes'
            and ae.user_id is not null
         union
         select a.user_id as uid
           from attempts a
          where a.last_saved_at >= now() - interval '15 minutes'
       ) z
      where not exists (
        select 1 from user_roles ur where ur.user_id = z.uid
      ))::bigint as online_last_15min,

    -- active_exams: SOMENTE provas reais em curso =
    -- in_progress + dentro da janela + prazo ainda no futuro.
    -- Exclui treino (is_within_window=false) e in_progress com prazo vencido (lixo).
    (select count(*)
       from attempts a
      where a.status = 'in_progress'
        and a.is_within_window = true
        and (a.effective_deadline is null or a.effective_deadline > now()))::bigint as active_exams,

    -- open_tickets: nao existe modulo de suporte; retorno honesto = 0 (ver tickets_supported).
    0::bigint as open_tickets,

    -- offline_pending_now (NOVO): provas reais aguardando submissao offline dentro da janela.
    (select count(*)
       from attempts a
      where a.status = 'offline_pending'
        and a.is_within_window = true)::bigint as offline_pending_now,

    -- online_confidence (NOVO): sinal de baixa confianca da fonte de 'online'.
    'low'::text as online_confidence,

    -- tickets_supported (NOVO): nao existe sistema de tickets.
    false::boolean as tickets_supported;
end;
$function$;

ALTER FUNCTION public.admin_live_signals() OWNER TO postgres;

-- Paridade com a definicao original: apenas authenticated + service_role (+ owner postgres).
REVOKE EXECUTE ON FUNCTION public.admin_live_signals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_live_signals() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_live_signals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_signals() TO service_role;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_live_signals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_live_signals() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_live_signals() TO authenticated, service_role;
