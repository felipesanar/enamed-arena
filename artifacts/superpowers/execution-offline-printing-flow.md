# Execução: fluxo offline com janela de impressão

## Feito

- Constante `OFFLINE_PRINTING_WINDOW_SECONDS` em `src/lib/offline-printing.ts`.
- `SimuladosPage` (`HeroCardActive`): wizard `mode` → `consent` → `printing`; RPC/PDF só após 30 min ou "Já imprimi"; auto-start ao zerar; fechar modal reseta estado.
- Analytics: `offline_printing_consent_viewed`, `offline_printing_started`, `offline_printing_completed_early`, `offline_printing_expired`.
- `FloatingOfflineTimer`: copy "Tempo restante da **prova**".
- Teste `analytics.test.ts` atualizado.

## Verificação

- `npx eslint` nos arquivos alterados: OK.
- `npm run test`: 121 testes passando (execução completa do repo).

## Revisão (breve)

- **Nit**: `formatPrintingMmSs` poderia ficar ao lado de `formatDeadlineTicker` por organização.
