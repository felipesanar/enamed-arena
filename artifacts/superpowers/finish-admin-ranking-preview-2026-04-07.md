# Finish: admin ranking preview (2026-04-07)

## Entregue

- Migration `supabase/migrations/20260408120000_admin_ranking_preview_rpcs.sql`:
  - `admin_get_ranking_for_simulado(p_simulado_id, p_include_train)` — mesmo shape do ranking público; guard `user_roles.admin`.
  - `admin_list_simulados_for_ranking_preview()` — simulados publicados com tentativas finalizadas, sem `results_release_at`.
- Frontend: `fetchAdminRankingForSimulado`, `fetchAdminSimuladosForRankingPreview` em `src/services/rankingApi.ts`; tipos em `src/integrations/supabase/types.ts`.
- `useRankingAdminPreview`, `RankingView` compartilhado, `RankingPage` refatorada, rota `/admin/ranking-preview` + navegação admin.

## Verificação executada

- `npm run test -- --run` — 121 testes passando.
- `npm run build` — sucesso.

## Deploy / manual

- Aplicar migration no projeto Supabase (`supabase db push` ou SQL no dashboard).
- Smoke: login admin → `/admin/ranking-preview` → selecionar simulado, alternar “Incluir treino”.

## Review (severidade)

- **Minor:** ESLint warnings em `RankingView` (cleanup ref engagement) e hooks deps — padrão já existente no projeto.
