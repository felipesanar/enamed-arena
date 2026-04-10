# Admin preview resultado — conclusão

## Implementação

- Rotas sob `AdminGuard`: `/admin/preview/simulados/:id/resultado`, `.../correcao`, `.../desempenho`.
- `ResultadoPage` e `CorrecaoPage`: prop `adminPreview`, gate via `canViewResultsOrAdminPreview`, breadcrumbs/nav admin.
- `DesempenhoSimuladoPanel` (`src/components/desempenho/DesempenhoSimuladoPanel.tsx`) extraído; `DesempenhoPage` e `AdminDesempenhoPreviewPage` reutilizam; links de correção no painel respeitam `resultNavVariant` (admin → `/admin/preview/.../correcao`).
- `AdminTopbar.getLabel`: labels para paths `preview/simulados`.

## Verificação

- `npm run test -- --run` — 127 testes OK.
- `npm run build` — OK.

## Review (severidade)

- **Minor:** em `CorrecaoPage`, simulado inexistente ainda usa `backHref` do fluxo aluno (`/simulados`); só afeta URL inválida.
