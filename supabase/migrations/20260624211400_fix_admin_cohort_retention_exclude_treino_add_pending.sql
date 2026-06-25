DROP FUNCTION IF EXISTS public.admin_cohort_retention(integer);
CREATE OR REPLACE FUNCTION public.admin_cohort_retention(p_months integer DEFAULT 6)
 RETURNS TABLE(cohort_month date, cohort_size bigint, did_onboarding bigint, did_1_plus bigint, did_2_plus bigint, did_3_plus bigint, avg_score numeric, did_offline_pending bigint, started_any bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.admin_require('intel.view');

  return query
  with cohorts as (
    select p.id as user_id,
           date_trunc('month', p.created_at at time zone 'America/Sao_Paulo')::date as cm
    from profiles p
    left join user_roles ur on ur.user_id = p.id
    where ur.user_id is null  -- exclui contas internas/admin
      and p.created_at >= (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - ((p_months - 1) || ' months')::interval)
  ),
  ob as (
    select distinct o.user_id
    from onboarding_profiles o
    where o.status = 'completed' or o.completed_at is not null
  ),
  -- VÁLIDO: prova entregue dentro da janela. Exclui treino (is_within_window=false)
  -- e NUNCA usa 'expired' (bucket morto) como concluído.
  attempt_counts as (
    select a.user_id, count(distinct a.simulado_id) as n_sims
    from attempts a
    where a.status = 'submitted'
      and a.is_within_window = true
    group by a.user_id
  ),
  -- offline_pending DENTRO da janela = prova entregue offline aguardando processamento (status real, visível).
  offline_pend as (
    select distinct a.user_id
    from attempts a
    where a.status = 'offline_pending'
      and a.is_within_window = true
  ),
  -- STARTED: volume de tentativa. INCLUI treino por decisão de produto (iniciados != prova válida).
  started as (
    select distinct a.user_id
    from attempts a
  ),
  -- SCORE: média por usuário a partir de provas VÁLIDAS (exclui treino). uph não cobre offline_pending
  -- e misturava treino; usamos attempts.score_percentage de submitted dentro da janela.
  scores as (
    select a.user_id, avg(a.score_percentage) as avg_sc
    from attempts a
    where a.status = 'submitted'
      and a.is_within_window = true
      and a.score_percentage is not null
    group by a.user_id
  )
  select
    c.cm as cohort_month,
    count(distinct c.user_id) as cohort_size,
    count(distinct c.user_id) filter (where ob.user_id is not null) as did_onboarding,
    count(distinct c.user_id) filter (where ac.n_sims >= 1) as did_1_plus,
    count(distinct c.user_id) filter (where ac.n_sims >= 2) as did_2_plus,
    count(distinct c.user_id) filter (where ac.n_sims >= 3) as did_3_plus,
    round(avg(sc.avg_sc), 1) as avg_score,
    count(distinct c.user_id) filter (where op.user_id is not null) as did_offline_pending,
    count(distinct c.user_id) filter (where st.user_id is not null) as started_any
  from cohorts c
  left join ob on ob.user_id = c.user_id
  left join attempt_counts ac on ac.user_id = c.user_id
  left join offline_pend op on op.user_id = c.user_id
  left join started st on st.user_id = c.user_id
  left join scores sc on sc.user_id = c.user_id
  group by c.cm
  order by c.cm desc;
end;
$function$;
-- [grant-hygiene] ACL limpo: só authenticated + service_role
REVOKE ALL ON FUNCTION public.admin_cohort_retention(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cohort_retention(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_cohort_retention(integer) TO authenticated, service_role;
