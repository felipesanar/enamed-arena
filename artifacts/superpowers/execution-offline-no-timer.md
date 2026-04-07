# Execução: offline sem cronômetro + ranking por envio na janela

## Alterações

- Removido `FloatingOfflineTimer` (`App.tsx`; arquivo do componente apagado).
- `useOfflineAttempt`: sem `remaining`/`isExpired`/intervalo 1s; mantém tentativa ativa, storage e `clearAttempt`.
- `AnswerSheetPage`: destruturação ajustada.
- `OfflineModeSimpleDialog`: toast pós-download sem mencionar cronômetro no canto da tela (alinhado ao produto).
- Migration `supabase/migrations/20260407120000_offline_ranking_by_submission_window.sql`: `is_within_window` = momento do envio (`now`) dentro de `[execution_window_start, execution_window_end]` (sem exigir duração oficial da prova no papel).

## Verificação

- `npx eslint` nos arquivos tocados: OK.
- `npm run test`: 121 testes passando.

## Deploy Supabase

Aplicar migration no projeto (`supabase db push` ou pipeline de migrations).

## Revisão

- **Major:** nenhum no código local; migration precisa ir para produção para a regra de ranking valer no ambiente real.
