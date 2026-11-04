-- Fase 0: official exam dates independent from application deployments.
do $$
begin
  create type public.exam_edition_status as enum ('planned', 'preparing', 'active', 'closed', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.exam_editions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^\d{4}(\.[12])?$'),
  year smallint not null,
  term smallint check (term in (1, 2)),
  label text not null,
  status public.exam_edition_status not null default 'planned',
  exam_date date,
  exam_date_confirmed boolean not null default false,
  official_results_at date,
  format jsonb not null default '{"questions":100,"options":4,"duration_minutes":300,"scoring":"tri","proficient_min":60}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_editions_confirmed_date check (not exam_date_confirmed or exam_date is not null)
);

alter table public.exam_editions enable row level security;
revoke all on table public.exam_editions from public, anon, authenticated;
grant select on table public.exam_editions to anon, authenticated;
grant insert, update, delete on table public.exam_editions to authenticated;

drop policy if exists exam_editions_read on public.exam_editions;
create policy exam_editions_read on public.exam_editions for select to anon, authenticated using (true);
drop policy if exists exam_editions_insert on public.exam_editions;
create policy exam_editions_insert on public.exam_editions for insert to authenticated
  with check ((select auth.uid()) is not null and (select public.has_capability('content.manage')));
drop policy if exists exam_editions_update on public.exam_editions;
create policy exam_editions_update on public.exam_editions for update to authenticated
  using ((select auth.uid()) is not null and (select public.has_capability('content.manage')))
  with check ((select auth.uid()) is not null and (select public.has_capability('content.manage')));
drop policy if exists exam_editions_delete on public.exam_editions;
create policy exam_editions_delete on public.exam_editions for delete to authenticated
  using ((select auth.uid()) is not null and (select public.has_capability('content.manage')));

drop trigger if exists exam_editions_updated_at on public.exam_editions;
create trigger exam_editions_updated_at before update on public.exam_editions
  for each row execute function public.update_updated_at();

insert into public.exam_editions (code, year, term, label, status, exam_date, exam_date_confirmed, official_results_at)
values
  ('2026', 2026, null, 'ENAMED 2026', 'closed', '2026-09-13', true, '2026-12-04'),
  ('2027.1', 2027, 1, 'ENAMED 2027.1', 'planned', null, false, null),
  ('2027.2', 2027, 2, 'ENAMED 2027.2', 'planned', null, false, null)
on conflict (code) do nothing;

create or replace function public.get_exam_editions()
returns setof public.exam_editions
language sql stable security invoker
set search_path = public
as $$
  select * from public.exam_editions order by year, term nulls first, code;
$$;
revoke all on function public.get_exam_editions() from public, anon, authenticated;
grant execute on function public.get_exam_editions() to anon, authenticated;

-- Rollback (only before any later edition-dependent migrations):
-- drop function if exists public.get_exam_editions();
-- drop table if exists public.exam_editions;
-- drop type if exists public.exam_edition_status;
