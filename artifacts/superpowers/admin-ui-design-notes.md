# Central Admin — notas de UI (pós-plano premium)

## Tema

- `next-themes` com `ThemeProvider` em `src/App.tsx`: `attribute="class"`, `defaultTheme="light"`, `storageKey="ea-ui-theme"`, `enableSystem`.
- Toggle só na `AdminTopbar` (Sol/Lua). Preferência persiste no `localStorage` gerenciado pelo `next-themes`.
- `<html suppressHydrationWarning>` em `index.html` para evitar avisos se houver SSR/hidratação futura.

## Gráficos (Recharts)

- `src/admin/lib/adminChartTheme.ts` — cores de grid, eixos, tooltip e legenda via `hsl(var(--…))`.
- `src/admin/hooks/useAdminChartTheme.ts` — `useSyncExternalStore` na classe `dark` do `<html>`; expõe `chartKey` para remount estável dos gráficos ao alternar tema.
- `adminChartSeriesColors` — séries com `primary`, `success`, `info`, etc.

## Superfícies

- `AdminPanel` — borda suave, sombra leve, `rounded-xl`, `flush` para tabelas/cabeçalhos full-bleed.
- Componentes `embedded` onde aplicável (`AdminTrendChart`, `AdminFunnelChart`, `AdminDataTable`, `AdminLivePanel`) para evitar “cartão duplo” dentro de `AdminPanel`.

## Acessibilidade e motion

- Botões com `type="button"`, `focus-visible:ring-*` nos filtros/pills e navegação.
- `motion-safe:` / `motion-reduce:` em transições e no ping do painel “Ao vivo”.

## Ícones

- Lucide em deltas (`AdminStatCard`), funil (`ChevronRight`, `AlertTriangle`), marketing (`Info`), login admin (`Shield`), analytics de simulado (`BarChart3`).

## Follow-up sugerido

- Aplicar `AdminPanel` / pills com foco nas páginas admin restantes (Tentativas, Usuários, detalhe, formulários, upload) no mesmo ritmo do dashboard/analytics/marketing/produto.
- Toggle de tema na área aluno (`ConfiguracoesPage` ou shell premium), se desejado fora do admin.
