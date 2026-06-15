# Admin Inteligência (Fase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hub de inteligência cross-dados (`/admin/inteligencia`, "Panorama") + alertas reais no sino, ancorados nas tabelas populadas (profiles, attempts, user_performance_history, attempt_question_results, questions), gated por `intel.view`.

**Architecture:** Banco primeiro (RPCs `SECURITY DEFINER` + `admin_require('intel.view')`, aplicadas via MCP, registradas em `supabase/migrations-log.md`), depois tipos/serviço/hooks, componentes de viz, página hub, sino. Cada task termina verde + commit.

**Tech:** React 18 + Vite + TS (relaxado), Tailwind 3.4 (tokens `--admin-*`), shadcn/Radix, Recharts 2.15.4, TanStack Query 5, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-admin-inteligencia-design.md` (fonte da verdade para shapes/semântica — leia as seções referenciadas).

**Branch:** `feat/admin-inteligencia` (worktree `.claude/worktrees/admin-inteligencia`, base main com a Fundação).

**Regras gerais (executor):**
- Trabalhe SOMENTE no worktree; `Set-Location` (PowerShell) nele antes de qualquer comando.
- DDL via MCP `apply_migration` (nunca `execute_sql`). Toda RPC: `STABLE SECURITY DEFINER SET search_path TO 'public'`, guard `perform public.admin_require('intel.view')` no início (plpgsql), depois `revoke execute on function ... from anon, public; grant execute ... to authenticated, service_role;`. Proteja divisões com `nullif`. Degrade para vazio, nunca lance por falta de dados.
- Após migrations de função, regenerar `src/integrations/supabase/types.ts` via MCP `generate_typescript_types` (substituir arquivo inteiro) e rodar build.
- Logging `@/lib/logger`; toasts `@/hooks/use-toast`; alias `@/`.
- Apêndice em `supabase/migrations-log.md` a cada migration.
- Co-author trailer nos commits: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Flakiness pré-existente em testes de páginas do aluno sob carga: rode isolado para confirmar; não conserte.

---

## Task I1: Migration — RPCs de métricas de inteligência

Aplicar via MCP `apply_migration` (pode agrupar em 1-2 migrations, ex. `admin_intel_metrics`). Todas com guard `intel.view`, grants/revokes. Filtro padrão de "attempt válido para análise": `status in ('submitted','expired')` e (quando indicado) `is_within_window = true`. Use `user_performance_history` para notas finais; `attempt_question_results` joinado a `questions` para área/tema.

Funções e RETURNS exatos (ver spec §1.1–1.7 para semântica completa):

- [ ] **Step 1:** `admin_cohort_retention(p_months int default 6)` →
  `TABLE(cohort_month date, cohort_size bigint, did_onboarding bigint, did_1_plus bigint, did_2_plus bigint, did_3_plus bigint, avg_score numeric)`.
  Coorte = `date_trunc('month', profiles.created_at)`. `did_N_plus` = nº de usuários da coorte com ≥N distinct `simulado_id` em attempts finalizados. `avg_score` = média de `user_performance_history.score_percentage` dos usuários da coorte. Últimas `p_months` coortes, ordenado `cohort_month desc`.

- [ ] **Step 2:** `admin_performance_by_area(p_simulado_id uuid default null, p_segment text default 'all')` →
  `TABLE(area text, total_responses bigint, correct_responses bigint, correct_rate numeric, n_users bigint, n_questions bigint)`.
  De `attempt_question_results aqr join attempts a on a.id=aqr.attempt_id join questions q on q.id=aqr.question_id join profiles p on p.id=a.user_id`, com `a.status in ('submitted','expired') and a.is_within_window and aqr.was_answered`, filtrando `q.simulado_id = p_simulado_id` quando não-nulo e `p.segment = p_segment` quando ≠ 'all'. `correct_rate = round(100.0*correct/nullif(total,0),1)`. Ordenar `correct_rate asc nulls last`.

- [ ] **Step 3:** `admin_performance_by_theme(p_simulado_id uuid default null, p_area text default null, p_limit int default 12)` →
  `TABLE(theme text, area text, correct_rate numeric, total_responses bigint)`. Mesma base, agrupado por theme/area, filtro opcional de área, top `p_limit` piores (`correct_rate asc`).

- [ ] **Step 4:** `admin_score_distribution(p_simulado_id uuid default null)` →
  `TABLE(bucket_label text, bucket_min int, count bigint)`. Faixas de 10 em `user_performance_history.score_percentage` (0–10 … 90–100; 100 cai no último bucket). `generate_series(0,90,10)` left-joined para incluir buckets vazios. Ordenar `bucket_min`.

- [ ] **Step 5:** `admin_score_evolution()` →
  `TABLE(simulado_id uuid, sequence_number int, title text, participants bigint, avg_score numeric, median_score numeric, cutoff_proxy numeric)`.
  De `user_performance_history h join simulados s on s.id=h.simulado_id`. `participants = count(distinct h.user_id)`, `avg_score = round(avg,1)`, `median_score = round(percentile_cont(0.5) within group (order by score_percentage),1)`, `cutoff_proxy = round(avg - 0.5*stddev_pop,1)`. Ordenar `sequence_number`.

- [ ] **Step 6:** `admin_engagement_metrics(p_days int default 30)` →
  `TABLE(started bigint, completed bigint, abandonment_rate numeric, abandonment_rate_prev numeric, avg_minutes numeric, avg_minutes_prev numeric, median_minutes numeric, avg_tab_exits numeric, avg_fullscreen_exits numeric, high_integrity_flag_pct numeric)`.
  Janela atual = `created_at >= now() - (p_days||' days')::interval`; prev = janela anterior de mesmo tamanho. `completed` = status='submitted'. `abandonment_rate = 100*(started - completed)/nullif(started,0)`. `avg_minutes` = `avg(extract(epoch from finished_at-started_at)/60)` sobre finalizados. `high_integrity_flag_pct = 100*count(*) filter (where tab_exit_count>=3)/nullif(started,0)`. Tudo `round(...,1)`.

- [ ] **Step 7:** `admin_segment_breakdown()` →
  `TABLE(segment text, users bigint, participants bigint, participation_rate numeric, avg_score numeric, avg_attempts numeric)`.
  De `profiles` left-join attempts agregados por user. `participants` = usuários com ≥1 attempt finalizado. `participation_rate = 100*participants/nullif(users,0)`. `avg_score` de `user_performance_summary.avg_score` (ou média de history). `avg_attempts = avg(total_attempts)`. Ordenar por ordem guest/standard/pro.

- [ ] **Step 8:** Smoke de cada função via `execute_sql` (chamar e conferir formato/linhas com dados reais: área mais fraca aparece, evolução tem ~7 linhas, coortes ≤6). Registrar resultados no relatório.

- [ ] **Step 9:** Verificar guard e grants: nenhuma das 7 executável por anon (`has_function_privilege('anon',oid,'execute')` = false); todas contêm `admin_require('intel.view')`.

- [ ] **Step 10:** Apêndice em `migrations-log.md` + commit `feat(admin-db): RPCs de metricas de inteligencia (cohort, area, tema, distribuicao, evolucao, engajamento, segmentos)`.

## Task I2: Migration — motor de insights + regen de tipos

- [ ] **Step 1:** `admin_intel_insights()` → `TABLE(id text, severity text, category text, title text, detail text, metric_value numeric, metric_unit text, route text)` (ver spec §1.8). plpgsql; computa internamente chamando/replicando as métricas da I1; cada regra só insere linha (via `return query`/array) se disparar. Thresholds fixos da spec. Ordenar critical→warning→info. NUNCA lança por falta de dados (envolver cada regra em bloco tolerante; se uma subconsulta vier vazia, pular a regra). Guard `intel.view` + grants.
  Regras: weakest_area (<60 warning / <50 critical), participation_drop (>15%), high_abandonment (>25 warning / >40 critical), integrity_spike (>20%), low_cohort_activation (<40% na coorte mais recente com ≥30d), score_decline (último < anterior −5pts). `route` = deep-link (`/admin/inteligencia#areas` etc).

- [ ] **Step 2:** Smoke: `select * from admin_intel_insights();` retorna linhas plausíveis com os dados reais (provável weakest_area). Confirmar que não lança mesmo se filtrando cenário vazio (ex.: simulado sem respostas).

- [ ] **Step 3:** Regenerar `src/integrations/supabase/types.ts` (MCP) — substituir arquivo. `npm run build` verde.

- [ ] **Step 4:** Apêndice no log + commit `feat(admin-db): admin_intel_insights (motor de alertas/insights por regras) + regen types`.

## Task I3: Tipos, serviço e hooks

**Files:** `src/admin/types.ts` (append), `src/admin/services/adminApi.ts` (append métodos), `src/admin/hooks/useAdminInteligencia.ts` (novo).

- [ ] **Step 1:** Em `types.ts`, adicionar interfaces espelhando os RETURNS: `CohortRetentionRow`, `AreaPerformanceRow`, `ThemePerformanceRow`, `ScoreBucket`, `ScoreEvolutionRow`, `EngagementMetrics`, `SegmentBreakdownRow`, `IntelInsight` (campos exatamente como os RETURNS da I1/I2; numéricos como `number`, datas como `string`).

- [ ] **Step 2:** Em `adminApi.ts`, importar os tipos e adicionar métodos (padrão dos vizinhos — `supabase.rpc('<fn>', {args}); if (error) throw error; return (data ?? []) as T[]` ou objeto único):
  `getCohortRetention(months=6)`, `getPerformanceByArea(simuladoId|null, segment='all')`, `getPerformanceByTheme(simuladoId|null, area|null, limit=12)`, `getScoreDistribution(simuladoId|null)`, `getScoreEvolution()`, `getEngagementMetrics(days)`, `getSegmentBreakdown()`, `getIntelInsights()`.

- [ ] **Step 3:** `useAdminInteligencia.ts`: um hook por método; queryKey `['admin','intel',<nome>, ...args]`; staleTime 5min (300_000), exceto `useAdminIntelInsights` 2min (120_000). Padrão dos hooks existentes (ver `useAdminProduto.ts`).

- [ ] **Step 4:** `npx tsc --noEmit` limpo; `npm run build` verde. Commit `feat(admin): tipos, servico e hooks de inteligencia`.

## Task I4: Componentes de visualização (+ testes TDD onde indicado)

**Files:** `src/admin/components/ui/AdminTrendChart.tsx` (extensão), `AdminBarList.tsx`, `AdminCohortMatrix.tsx`, `AdminInsightCard.tsx` (novos), testes em `src/admin/__tests__/`.

- [ ] **Step 1 (extensão AdminTrendChart):** adicionar prop `type?: 'bar'|'line'|'area'` (default 'bar') e `lines?`/`areas?: {key,color,label}[]` análogos a `bars`. Para 'line' renderizar `LineChart`+`Line`; 'area' `AreaChart`+`Area`. Manter assinatura/comportamento bar intactos (retrocompat — consumidores atuais não passam `type`). Tema via `useAdminChartTheme`.

- [ ] **Step 2 (AdminBarList — TDD):** teste primeiro (`AdminBarList.test.tsx`): dado `items=[{label,value}]` e `thresholds` (ex. {good:70,warn:60}), renderiza uma barra por item, largura proporcional, e classe de cor por faixa (≥good=success, ≥warn=warning, else=destructive). Ver FAIL. Implementar `AdminBarList.tsx`: props `{ items: {label:string; value:number; sublabel?:string}[]; max?:number; goodAt?:number; warnAt?:number; valueSuffix?:string; isLoading?:boolean }`. Barras horizontais (`bg-admin-*` por faixa), valor à direita, label à esquerda truncado. PASS.

- [ ] **Step 3 (AdminInsightCard — TDD):** teste (`AdminInsightCard.test.tsx`): severidade 'critical'→borda/realce destructive, 'warning'→warning, 'info'→info; renderiza title/detail; clique chama `onNavigate(route)`. FAIL→implementar `AdminInsightCard.tsx` (props = `IntelInsight` + `onNavigate?`), ícone por `category` (lucide), borda-esquerda colorida, layout compacto. PASS.

- [ ] **Step 4 (AdminCohortMatrix — TDD leve):** teste (`AdminCohortMatrix.test.tsx`): dado `rows: CohortRetentionRow[]`, renderiza uma linha por coorte com células ≥1/≥2/≥3 e o tamanho; célula com maior valor tem maior intensidade. FAIL→implementar `AdminCohortMatrix.tsx`: `<table>` semântica (aria), colunas [Coorte, Tamanho, Onboarding, ≥1, ≥2, ≥3, Média], cada célula de marco tinge `bg-admin-accent` com opacity = valor/cohort_size, texto em `%`. PASS.

- [ ] **Step 5:** `npx vitest run src/admin` verde; `tsc` limpo; build verde. Commit `feat(admin): componentes de viz de inteligencia (BarList, CohortMatrix, InsightCard, TrendChart line/area)`.

## Task I5: Página Hub "Panorama" + rota + navegação

**Files:** `src/admin/pages/AdminInteligencia.tsx` (novo), `src/admin/lib/navigation.ts` (add item), `src/App.tsx` (rota), testes.

- [ ] **Step 1:** `AdminInteligencia.tsx` (default export gated por `AdminCapabilityGate capability="intel.view"`, wrapper `AdminInteligenciaContent`). Estado local de período (7/30/90, default 30) e segmento (all/guest/standard/pro). `AdminPageHeader title="Panorama"` + actions (período + segmento). Seções na ordem da spec §4, cada uma com `id` âncora (`areas`,`evolucao`,`distribuicao`,`cohorts`,`engajamento`,`segmentos`) e estados loading/erro/vazio:
  1. Faixa de insights (`useAdminIntelInsights`, grid de `AdminInsightCard`, `onNavigate` faz scroll/`navigate`).
  2. Desempenho por área (`AdminBarList`, filtro simulado; clicar área → `admin_performance_by_theme` via `useAdminPerformanceByTheme`, exibe sub-lista).
  3. Evolução (`AdminTrendChart type="line"` avg+median; 3 `AdminStatCard`).
  4. Distribuição (`AdminTrendChart type="bar"`).
  5. Cohorts (`AdminCohortMatrix`).
  6. Engajamento (`AdminStatCard`s com deltas de abandono/tempo).
  7. Segmentos (`AdminDataTable`).

- [ ] **Step 2:** `navigation.ts`: adicionar `{ to: '/admin/inteligencia', label: 'Panorama', icon: Gauge, capability: 'intel.view' }` como PRIMEIRO item do grupo "Inteligência". (Import `Gauge` de lucide-react.)

- [ ] **Step 3:** `src/App.tsx`: lazy `const AdminInteligencia = lazy(() => import('./admin/pages/AdminInteligencia'))` + `<Route path="inteligencia" element={<Suspense fallback={<PageLoadingSkeleton/>}><AdminInteligencia/></Suspense>} />` no bloco admin.

- [ ] **Step 4:** Atualizar teste de navegação/registry se asserta a lista de itens (Panorama agora é o 1º de Inteligência). Adicionar teste mínimo de render do hub com `renderWithAccess` (de `src/admin/__tests__/test-utils.tsx`) mockando os hooks de intel (retorno vazio → mostra empty states sem crashar).

- [ ] **Step 5:** `npx vitest run src/admin` verde; `tsc`; build. Commit `feat(admin): pagina Panorama (hub de inteligencia) + rota e navegacao`.

## Task I6: Sino de alertas funcional na topbar

**Files:** `src/admin/components/AdminAlertsBell.tsx` (novo), `src/admin/components/AdminTopbar.tsx` (substituir placeholder), teste.

- [ ] **Step 1 (TDD):** `AdminAlertsBell.test.tsx`: com `useAdminIntelInsights` mockado retornando 2 insights (1 critical, 1 info) dentro de `AdminAccessProvider` com `intel.view` → badge mostra contagem de critical+warning (=1), abrir popover lista os 2; sem `intel.view` → componente não renderiza nada; lista vazia → "Nenhum alerta no momento.". FAIL.

- [ ] **Step 2:** Implementar `AdminAlertsBell.tsx`: `useAdminCan('intel.view')` (se false, `return null`); `useAdminIntelInsights()`; shadcn `Popover` com `Bell` + badge (`bg-admin-destructive` se há critical, senão `bg-admin-warning`; oculto se 0). Lista de itens (severity dot + title + detail truncado), clique → `navigate(insight.route)` e fecha. Loading skeleton; empty state. Tokens admin; portal com className admin.

- [ ] **Step 3:** Em `AdminTopbar.tsx`, substituir o `<button ... disabled>` do sino por `<AdminAlertsBell />`. Remover imports órfãos (`Bell` se não usado mais lá).

- [ ] **Step 4:** `npx vitest run src/admin` verde; `tsc`; build. Commit `feat(admin): sino de alertas reais na topbar (insights por capability)`.

## Task I7: Verificação final + smoke + merge

- [ ] **Step 1:** `npm run test` (suite completa) + `npm run lint` (0 erros) + `npm run build` + `npx tsc --noEmit` — tudo verde. Falhas flaky do aluno: confirmar isolado.

- [ ] **Step 2:** Smoke final no banco vivo: as 8 RPCs executam e retornam formatos esperados; `admin_intel_insights` devolve lista coerente; nenhuma executável por anon; todas com `admin_require('intel.view')`.

- [ ] **Step 3:** Review final da branch (dispatch de code-reviewer no range main..HEAD): integração (capability `intel.view` consistente em nav/registry/página/sino/RPCs), resiliência a dados vazios, sem regressão no app do aluno, tokens, a11y do hub/sino.

- [ ] **Step 4:** Aplicar fixes do review (se houver). Atualizar memória do programa (status Fase 2).

- [ ] **Step 5:** Merge `--no-ff` na main (resolvendo conflitos de types.ts via regeneração se ocorrerem), verificar tsc/build/test no resultado mesclado, remover worktree, deletar branch — seguindo finishing-a-development-branch (opção merge local). Não pushar (a menos que pedido).

---

## Riscos e contingências

- **Volume/performance:** ~2.7k attempts e ~1.4k históricos — trivial; sem necessidade de índices novos. Se `admin_performance_by_area` ficar lenta, há índices em attempt_question_results(attempt_id) e questions(simulado_id).
- **`questions.area` nulo/heterogêneo:** agrupar por `coalesce(area,'(sem área)')`; reportar se a distribuição de áreas estiver suja (impacta interpretação, não a corretude).
- **median/percentile:** `percentile_cont` exige ordering set — usar `within group`. `stddev_pop` pode ser 0 (1 amostra) → `cutoff_proxy` = avg.
- **types.ts conflito no merge:** arquivo gerado; resolver tomando a versão regenerada do banco vivo (superset), como na Fase 1.
- **Sino e hub compartilham `admin_intel_insights`:** mesma queryKey → cache compartilhado (bom).
