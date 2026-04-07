# Finish: fluxo offline com janela de impressão

## Entregas

- `src/components/simulados/OfflineModeWizardDialog.tsx`: wizard (mode → consent → printing), `OFFLINE_PRINTING_WINDOW_SECONDS`, RPC/PDF só após impressão ou timeout, `AnimatePresence` + motion (respeita `prefersReducedMotion`), `AlertDialog` ao fechar durante impressão com tempo já consumido, barra de progresso da preparação, analytics.
- `src/pages/SimuladosPage.tsx`: `HeroCard` / `HeroCardActive` enxutos; `prefersReducedMotion` repassado; `hasActiveAttempt` com parênteses corretos.
- `src/components/FloatingOfflineTimer.tsx`: chip "Prova · …", popover "tempo da prova (após o PDF)", `aria-label` no trigger, comentários dos thresholds.

## Verificação

- `npm run lint` — exit 0 (avisos pré-existentes em worktrees).
- `npm run test` — 121 testes passando.
