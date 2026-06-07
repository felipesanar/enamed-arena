-- =====================================================================
-- Admin Produto: Caderno de Erros Funnel / Health RPC (plano 08 §3.6)
-- Aggregates the `caderno_*` analytics events so the team can measure
-- the cutover: activation, review engagement, mastery, capture, loop.
-- =====================================================================

-- ─── admin_caderno_funnel ─────────────────────────────────────────────
-- Returns one row per metric (ordered) with:
--   total_events  = COUNT(*) of the event in the period
--   unique_users  = COUNT(DISTINCT user_id) for the event
-- plus a synthetic "conversion" row (triagem viewed → batch added).
-- Honors the same date window + segment filter the page already exposes.
create or replace function admin_caderno_funnel(p_days int default 30, p_segment text default 'all')
returns table (
  metric_order  int,
  metric_key    text,
  metric_label  text,
  event_name    text,
  total_events  bigint,
  unique_users  bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := now() - (p_days || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with metrics(ord, k, lbl, ev) as (
    values
      (1,  'triage_viewed',     'Triagem vista (ativação)',   'caderno_triage_viewed'),
      (2,  'triage_batch_added','Lote adicionado',            'caderno_triage_batch_added'),
      (3,  'recall_self_graded','Recall auto-avaliado',       'caderno_recall_self_graded'),
      (4,  'entry_mastered',    'Entradas dominadas',         'caderno_entry_mastered'),
      (5,  'favorite_added',    'Favoritos criados',          'caderno_favorite_added'),
      (6,  'note_created',      'Notas criadas',              'caderno_note_created'),
      (7,  'flashcard_created', 'Flashcards criados',         'caderno_flashcard_created'),
      (8,  'reminder_sent',     'Lembretes enviados',         'caderno_reminder_sent'),
      (9,  'reminder_opened',   'Lembretes abertos',          'caderno_reminder_opened')
  )
  select
    m.ord,
    m.k,
    m.lbl,
    m.ev,
    coalesce((
      select count(*)::bigint
      from analytics_events ae
      join profiles pr on pr.id = ae.user_id
      where ae.event_name = m.ev
        and ae.created_at >= v_start
        and (p_segment = 'all' or pr.segment = p_segment)
    ), 0),
    coalesce((
      select count(distinct ae.user_id)::bigint
      from analytics_events ae
      join profiles pr on pr.id = ae.user_id
      where ae.event_name = m.ev
        and ae.created_at >= v_start
        and (p_segment = 'all' or pr.segment = p_segment)
    ), 0)
  from metrics m
  order by m.ord;
end;
$$;

grant execute on function admin_caderno_funnel(int, text) to authenticated;
