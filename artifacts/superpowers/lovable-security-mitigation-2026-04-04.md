# Lovable Security Mitigation - 2026-04-04

## Escopo executado

- Remediação do vazamento potencial de gabarito em `question_options`.
- Fortalecimento da policy de INSERT em `attempt_processing_queue`.
- Hardening de `sso_rate_limit` com hash e sem e-mail em claro.
- Redução de PII em logs da edge function `sso-magic-link`.
- Sincronização de documentação de RLS e auditoria.

## Arquivos alterados

- `supabase/migrations/20260404203000_security_hardening_lovable_alerts.sql`
- `supabase/functions/sso-magic-link/index.ts`
- `src/services/simuladosApi.ts`
- `src/hooks/useExamResult.ts`
- `src/pages/CorrecaoPage.tsx`
- `docs/SUPABASE_RLS.md`
- `AUDITORIA_PROJETO.md`
- `docs/security/LEAKED_PASSWORD_PROTECTION.md`

## Review pass (severidade)

- **Blocker:** nenhum identificado.
- **Major:** opção "Leaked password protection" não pode ser habilitada por migration; depende de ação no Supabase Dashboard.
- **Minor:** build continua falhando por dependência ausente `jszip` em `src/admin/utils/xlsxImageExtractor.ts` (pré-existente, fora do escopo desta mitigação).
- **Nit:** execução de `npm run lint` retorna erros legados em múltiplos arquivos não alterados.

## Verificação executada

- `npm run test -- src/lib/resultHelpers.test.ts` -> **passou** (5/5).
- `npm run build` -> **falhou** por problema pré-existente (`jszip` não resolvido no módulo admin).
- `npm run lint` -> **falhou** por problemas legados fora do escopo nos arquivos alterados nesta tarefa.

## Pendência operacional (Dashboard)

- Confirmar e habilitar `Leaked password protection` em Supabase Auth.
- Checklist documentado em `docs/security/LEAKED_PASSWORD_PROTECTION.md`.
