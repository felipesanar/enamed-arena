## Goal
Elevar a interface da área administrativa (`src/admin`) a um padrão visual e de interação claramente premium: hierarquia tipográfica refinada, gráficos e dados com acabamento de produto, microinterações discretas, tema claro/escuro consistente e substituição de elementos amadores (ex.: emojis) por ícones e padrões do design system — sem sacrificar a organização, o layout e o desempenho já considerados bons.

## Constraints
- Stack atual: React 18, Vite, Tailwind, shadcn/ui, Recharts (ex.: `AdminTrendChart`), possivelmente Framer Motion no restante do app; reutilizar tokens e componentes existentes quando fizer sentido.
- Manter acessibilidade (contraste, foco, leitores de tela) e não degradar performance (bundle, re-renders, animações pesadas).
- Escopo grande: várias páginas (`AdminDashboard`, analytics, marketing, produto, usuários, simulados, etc.) e componentes compartilhados (`AdminStatCard`, `AdminFunnelChart`, `AdminDataTable`, shell com `AdminRail` / `AdminFlyout` / `AdminTopbar`).
- Testes existentes em `src/admin/__tests__` não devem quebrar sem atualização intencional de contratos visuais (selectors estáveis).
- Alinhar ou contrastar conscientemente com a experiência premium do app principal (marca wine, tipografia Plus Jakarta), evitando “outro produto” sem critério.

## Known context
- Shell em `AdminApp.tsx`: `bg-background`, rail + flyout + topbar + `Outlet`; `AdminPeriodProvider` no topo.
- Cards e charts usam padrão utilitário (`bg-card`, `border-border`, `rounded-lg`) — funcional porém visualmente genérico; `AdminStatCard` usa setas Unicode para delta (▲▼), não ícones Lucide.
- Gráficos: Recharts em `AdminTrendChart`; funil e outros componentes dedicados em `src/admin/components/ui/`.
- Navegação no flyout já usa ícones Lucide (`AdminFlyout.tsx`); pode haver emojis ou texto cru em páginas específicas ou cópias.
- Documentação de fases admin em `docs/superpowers/specs/` e planos relacionados — útil para não conflitar com decisões de produto já registradas.

## Risks
- Dark mode: Recharts e cores hardcoded não seguem `hsl(var(--...))` — risco de gráficos ilegíveis ou com contraste inválido.
- Animações excessivas ou em listas grandes podem causar jank ou problemas de `prefers-reduced-motion`.
- Refino visual amplo sem sistema (tokens admin ou variantes) gera inconsistência entre páginas live e stubs.
- Regressões em testes que dependem de texto ou roles alterados.

## Options (2–4)

### Opção A — “Admin design layer” sobre o design system global
- **Summary:** Introduzir tokens/variantes específicas admin (densidade, superfícies, chart palette) e um `ThemeProvider` / classe escopo `admin` alinhada ao `next-themes` (ou equivalente já usado no app), garantindo dark mode end-to-end.
- **Pros:** Consistência com o produto principal; uma única fonte de verdade para cores; menos manutenção duplicada.
- **Cons:** Exige mapear todos os gráficos e estados ao tema; conflitos se o app principal não expõe tema na rota admin.
- **Complexity / risk:** Média–alta; risco médio (integração tema + Recharts).

### Opção B — Kit de componentes admin reutilizáveis (primitives)
- **Summary:** Criar camada `Admin*` estilizada: `AdminPanel`, `AdminMetricTile`, `AdminChartCard` com loading skeleton premium, tooltips padronizados, ícones Lucide, motion via Framer só em hover/focus e transições CSS leves.
- **Pros:** Refino concentrado; migração página a página; testes podem mirar componentes estáveis.
- **Cons:** Esforço inicial de extração; risco de abstração prematura se o kit não for usado em toda a árvore.
- **Complexity / risk:** Média; risco baixo–médio.

### Opção C — Passagem incremental por jornada (dashboard → analytics → restante)
- **Summary:** Priorizar telas de maior impacto e tráfego interno; stubs e páginas secundárias depois; checklist de qualidade por página.
- **Pros:** Valor visível cedo; reduz big-bang; alinha com capacidade de QA.
- **Cons:** Período de UI “mista”; pode desmotivar se o critério de “feito” não for claro.
- **Complexity / risk:** Baixa–média por entrega; risco baixo de regressão se bem isolado.

### Opção D — Troca ou camada sobre a lib de charts
- **Summary:** Manter Recharts mas centralizar `AdminChartTheme` (cores, grid, tooltip, font) derivado de CSS variables; opcionalmente avaliar Tremor/shadcn charts apenas se reduzir código custom.
- **Pros:** Gráficos coerentes com dark mode; menos duplicação de estilo por gráfico.
- **Cons:** Curva de refatoração em todos os usos; possível aumento de bundle se adicionar lib.
- **Complexity / risk:** Média; risco médio.

## Recommendation
Combinar **A + B + C + D de forma enxuta:** (1) garantir **tema claro/escuro** na shell admin e um **theme mapper para Recharts** (Opção A/D); (2) extrair um **pequeno kit** de superfícies e métricas premium (Opção B); (3) **rolar por fases** começando pelo dashboard e páginas analytics/marketing/produto já live (Opção C). Isso maximiza coerência, dark mode utilizável e refino visual sem um rewrite completo de uma só vez.

## Acceptance criteria
- [ ] Tema escuro (e claro) aplicável em toda a árvore admin, com persistência/preferência alinhada ao app (ou documentada se isolada).
- [ ] Gráficos Recharts legíveis em ambos os temas (eixos, grid, tooltip, legendas) sem cores fixas que quebrem contraste.
- [ ] Substituir padrões visuais frágeis (ex.: setas Unicode em deltas) por ícones/componentes consistentes; eliminar emojis como ícone primário de navegação ou KPI onde existirem.
- [ ] Microinterações discretas (hover, focus, skeletons) em cards e tabelas chave, respeitando `prefers-reduced-motion`.
- [ ] Nenhuma regressão crítica em `npm run test` / `npm run lint` para os testes admin existentes (ajustes de snapshot/selector apenas quando necessário e documentados).
- [ ] Documento curto em `artifacts/superpowers/` ou referência a spec listando tokens/padrões admin adotados (para manutenção futura).
