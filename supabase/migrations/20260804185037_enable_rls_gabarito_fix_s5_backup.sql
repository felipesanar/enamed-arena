-- Aplicada em PROD via MCP em 2026-08-04. Arquivo aqui para manter paridade
-- repo × banco (ver docs/AUDITORIA_DRIFT_MIGRATIONS_2026-06-05.md).
--
-- Security Advisor acusava ERROR `rls_disabled_in_public` nesta tabela de
-- backup pontual do fix de gabarito do S5 (Q35/Q46, 29/07/2026): criada sem
-- RLS, ficava legível via PostgREST.
alter table public.gabarito_fix_s5_20260729_backup enable row level security;
revoke all on table public.gabarito_fix_s5_20260729_backup from anon, authenticated;
comment on table public.gabarito_fix_s5_20260729_backup is
  'Backup pontual do fix de gabarito do Simulado 5 (Q35/Q46) aplicado em 2026-07-29. RLS habilitada sem policies: nenhum acesso via PostgREST. Pode ser dropada após confirmação de que notas/ranking/caderno estão corretos.';
