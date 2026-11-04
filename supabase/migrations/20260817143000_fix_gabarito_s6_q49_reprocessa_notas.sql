-- Aplicada em PROD via MCP em 2026-08-17.
--
-- Simulado 6 (1e802d25-05c8-4849-93ef-33580e9a4908), Q49 (8d1739c2-2278-4d80-8cc5-c378ffdc7a59):
-- o gabarito estava na alternativa B, mas o comentário da própria questão diz
-- "Alternativa B: INCORRETA ... Alternativa C: CORRETA" (o limite pontilhado do domicílio
-- inclui Val, Sérgio, Marina, Weslei e Rui). Distribuição confirmava: 228 de 265 marcaram C
-- (6,8% de "acerto" oficial). Reportado por aluno no ticket #30458 em 17/08 10:26,
-- ~1h25 depois da liberação dos resultados (results_release_at = 17/08 09:01 BRT).
-- Achado originalmente na auditoria de 09/08, quando ainda tinha 0 respostas.
--
-- Mesma classe de erro dos gabaritos do Simulado 5 (o importador segue a letra do comentário /
-- a ordem das alternativas divergindo do texto).
--
-- Reprocessamento é feito à mão porque finalize_attempt_with_results não serve:
-- exige auth.uid() e faz early-return em attempt já `submitted`.
-- Ordem: attempt_question_results -> attempts -> user_performance_history ->
-- recalculate_user_performance(user) -> error_notebook. `ranking_simulado` é view, recalcula sozinha.

-- 1) Snapshot do estado atual (schema `backup` não é exposto no PostgREST).
create schema if not exists backup;

create table if not exists backup.gabarito_fix_s6_q49_20260817_attempts as
select a.id as attempt_id, a.user_id, a.status, a.is_within_window,
       a.total_correct, a.total_answered, a.score_percentage, now() as snapshot_at
from public.attempts a
where a.simulado_id = '1e802d25-05c8-4849-93ef-33580e9a4908';

create table if not exists backup.gabarito_fix_s6_q49_20260817_aqr as
select r.id, r.attempt_id, r.selected_option_id, r.correct_option_id,
       r.is_correct, r.was_answered, now() as snapshot_at
from public.attempt_question_results r
where r.question_id = '8d1739c2-2278-4d80-8cc5-c378ffdc7a59';

create table if not exists backup.gabarito_fix_s6_q49_20260817_uph as
select h.id, h.user_id, h.attempt_id, h.score_percentage, h.total_correct,
       h.total_answered, h.total_questions, now() as snapshot_at
from public.user_performance_history h
where h.simulado_id = '1e802d25-05c8-4849-93ef-33580e9a4908';

do $$
declare
  v_simulado  uuid := '1e802d25-05c8-4849-93ef-33580e9a4908';
  v_question  uuid := '8d1739c2-2278-4d80-8cc5-c378ffdc7a59';
  v_opt_c     uuid;
  v_total_q   integer;
  v_user      uuid;
begin
  -- Guardas: alternativa C existe e o nº de questões bate com o cadastro.
  select id into strict v_opt_c
    from public.question_options
   where question_id = v_question and label = 'C';

  select count(*) into v_total_q from public.questions where simulado_id = v_simulado;
  if v_total_q is null or v_total_q = 0
     or v_total_q <> (select questions_count from public.simulados where id = v_simulado) then
    raise exception 'nº de questões inconsistente para o simulado % (questions=%)', v_simulado, v_total_q;
  end if;

  -- 2) Gabarito: B deixa de ser correta, C passa a ser.
  update public.question_options
     set is_correct = (label = 'C')
   where question_id = v_question and label in ('B', 'C');

  -- 3) Resultado por questão das tentativas já finalizadas.
  update public.attempt_question_results r
     set correct_option_id = v_opt_c,
         is_correct = coalesce(r.selected_option_id = v_opt_c, false)
   where r.question_id = v_question;

  -- 4) Nota da tentativa, recomputada a partir dos resultados por questão.
  update public.attempts a
     set total_correct     = agg.n_correct,
         score_percentage  = round(agg.n_correct * 100.0 / v_total_q, 2)
    from (
      select r.attempt_id, count(*) filter (where r.is_correct) as n_correct
        from public.attempt_question_results r
       where r.attempt_id in (select id from public.attempts where simulado_id = v_simulado)
       group by r.attempt_id
    ) agg
   where a.id = agg.attempt_id
     and (a.total_correct is distinct from agg.n_correct);

  -- 5) Histórico de performance.
  update public.user_performance_history h
     set total_correct    = a.total_correct,
         score_percentage = a.score_percentage
    from public.attempts a
   where h.attempt_id = a.id
     and h.simulado_id = v_simulado
     and (h.total_correct is distinct from a.total_correct
          or h.score_percentage is distinct from a.score_percentage);

  -- 6) Agregados por usuário (média/melhor/última nota).
  for v_user in
    select distinct user_id from public.user_performance_history where simulado_id = v_simulado
  loop
    perform public.recalculate_user_performance(v_user);
  end loop;

  -- 7) Caderno de erros: soft-delete das entradas da Q49 que deixaram de ser erro.
  update public.error_notebook en
     set deleted_at = now()
   where en.question_id = v_question
     and en.deleted_at is null
     and exists (
       select 1
         from public.attempt_question_results r
         join public.attempts at on at.id = r.attempt_id
        where r.question_id = v_question
          and at.user_id = en.user_id
          and r.is_correct
     );
end $$;

comment on table backup.gabarito_fix_s6_q49_20260817_attempts is
  'Notas do Simulado 6 antes da correção do gabarito da Q49 (17/08/2026). Dropar quando a correção estiver confirmada.';
