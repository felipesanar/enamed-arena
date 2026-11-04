-- Aplicada em PROD via MCP em 2026-08-04.
--
-- Tira as tabelas de backup pontual do schema `public` (exposto no PostgREST).
-- Schema `backup` não é exposto na API: sai do alcance de anon/authenticated,
-- mas o snapshot continua consultável via SQL/service_role.
--
-- Convenção: snapshot de correção de dados nasce em `backup`, nunca em `public`.
create schema if not exists backup;
revoke all on schema backup from anon, authenticated;

alter table public.gabarito_fix_s5_20260729_backup set schema backup;
alter table public._questions_area_backup_20260522 set schema backup;

comment on schema backup is
  'Snapshots pontuais de correções de dados. Nunca exposto no PostgREST. Tabelas aqui podem ser dropadas depois de confirmada a correção.';
