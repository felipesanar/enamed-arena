-- ---------------------------------------------------------------------
-- Fix: admin_get_user_attempts referenced a non-existent column
--      (user_performance_history.is_within_window). The ranking subquery
--      raised "column uph2.is_within_window does not exist" at runtime,
--      so the ENTIRE rpc errored and the admin user-detail "Histórico de
--      tentativas" always rendered "Nenhuma tentativa encontrada", even
--      though the performance KPIs (from user_performance_summary) showed
--      attempts existed.
--
--      is_within_window lives on `attempts`, not on user_performance_history.
--      Ranking is now computed against in-window submitted attempts of the
--      same simulado, mirroring admin_simulado_results_roster:
--        score = coalesce(uph.score_percentage, attempts.score_percentage)
--      Training attempts (is_within_window = false) get a NULL ranking
--      (a ranking position is meaningless outside the ranked cohort).
--
-- Also returns is_within_window so the UI can flag training attempts.
-- (Return type changes — drop first, then re-grant.)
-- ---------------------------------------------------------------------

drop function if exists public.admin_get_user_attempts(uuid, int);

create or replace function public.admin_get_user_attempts(
  p_user_id uuid,
  p_limit   int default 10
)
returns table (
  attempt_id       uuid,
  simulado_id      uuid,
  sequence_number  int,
  simulado_title   text,
  created_at       timestamptz,
  status           text,
  score_percentage numeric,
  ranking_position bigint,
  is_within_window boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_require('users.view');

  return query
  select
    a.id                                   as attempt_id,
    a.simulado_id,
    s.sequence_number,
    s.title::text                          as simulado_title,
    a.created_at,
    a.status::text,
    uph.score_percentage,
    case
      when a.is_within_window then (
        select count(*) + 1
        from attempts a2
        left join user_performance_history uph2 on uph2.attempt_id = a2.id
        where a2.simulado_id = a.simulado_id
          and a2.status = 'submitted'
          and a2.is_within_window = true
          and coalesce(uph2.score_percentage, a2.score_percentage)
                > coalesce(uph.score_percentage, a.score_percentage, -1)
      )::bigint
      else null
    end                                    as ranking_position,
    a.is_within_window
  from attempts a
  join simulados s on s.id = a.simulado_id
  left join user_performance_history uph on uph.attempt_id = a.id
  where a.user_id = p_user_id
  order by a.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_get_user_attempts(uuid, int) from public, anon;
grant execute on function public.admin_get_user_attempts(uuid, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- New: admin_get_attempt_questions — per-question breakdown of a single
--      attempt, for the admin user-detail drill-down. Reads
--      attempt_question_results (the finalized per-question record) and
--      resolves the selected/correct option labels + the AI error reason.
-- ---------------------------------------------------------------------

create or replace function public.admin_get_attempt_questions(
  p_attempt_id uuid
)
returns table (
  question_id         uuid,
  question_number     int,
  area                text,
  theme               text,
  difficulty          text,
  question_text       text,
  was_answered        boolean,
  is_correct          boolean,
  selected_label      text,
  selected_text       text,
  correct_label       text,
  correct_text        text,
  ai_suggested_reason text,
  confidence          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_require('users.view');

  return query
  select
    q.id                       as question_id,
    q.question_number,
    q.area,
    q.theme,
    q.difficulty,
    q.text                     as question_text,
    aqr.was_answered,
    aqr.is_correct,
    sel.label                  as selected_label,
    sel.text                   as selected_text,
    cor.label                  as correct_label,
    cor.text                   as correct_text,
    aqr.ai_suggested_reason,
    ans.confidence
  from attempt_question_results aqr
  join questions q                on q.id  = aqr.question_id
  left join question_options sel  on sel.id = aqr.selected_option_id
  left join question_options cor  on cor.id = aqr.correct_option_id
  left join answers ans           on ans.attempt_id = aqr.attempt_id
                                 and ans.question_id = aqr.question_id
  where aqr.attempt_id = p_attempt_id
  order by q.question_number;
end;
$$;

revoke all on function public.admin_get_attempt_questions(uuid) from public, anon;
grant execute on function public.admin_get_attempt_questions(uuid) to authenticated, service_role;
