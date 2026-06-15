# Admin — Inteligência de Dados (Fase 2 do programa "Central de Gestão")

**Data:** 2026-06-15
**Status:** design autônomo (Felipe concedeu 100% de autonomia para a Fase 2)
**Branch:** `feat/admin-inteligencia` (worktree `.claude/worktrees/admin-inteligencia`, base = main com a Fundação)

## Contexto e descoberta crítica

A Fase 1 (Fundação) entregou shell, tema, paleta, roles/capabilities e adaptação das páginas. A Fase 2 traz **inteligência de dados**: cruzamentos, cohorts, insights e alertas reais.

**Descoberta que define o eixo da fase:** a tabela `analytics_events` está **vazia** em produção (0 linhas). O handler que insere eventos (`log_analytics_event` em `src/main.tsx:86`) só existe no código recente, ainda não deployado — então as páginas atuais Jornada/Aquisição/Produto, que dependem de `analytics_events`, mostram dados vazios até o pipeline rodar em produção por tempo suficiente.

**Decisão:** a Fase 2 ancora a inteligência nas tabelas **realmente populadas** — onde está o valor analítico de uma plataforma de simulados médicos:

| Tabela | Linhas | Sinais |
|---|---|---|
| `profiles` | ~6.593 | segment, created_at (coorte de entrada) |
| `attempts` | ~2.779 | status, started_at/finished_at, score_percentage, total_correct/answered, tab_exit_count, fullscreen_exit_count, is_within_window, attempt_type |
| `user_performance_history` | ~1.432 | score_percentage por attempt/simulado, finished_at (evolução ao longo dos 7 simulados) |
| `attempt_question_results` | (por questão) | is_correct, was_answered → joinável a `questions.area/theme/difficulty` |
| `onboarding_profiles` | — | specialty, target_institutions (dimensões de coorte) |
| `questions` | — | area, theme, difficulty (eixos de desempenho) |

Eventos (`analytics_events`) ficam **fora de escopo** desta fase como fonte primária; quando o pipeline tiver volume, uma fase futura adiciona cohorts comportamentais. As novas RPCs devem **degradar graciosamente** (retornar vazio, nunca quebrar) se uma fonte estiver vazia.

## Escopo da Fase 2

Um **hub de inteligência cross-dados** (`/admin/inteligencia`, item "Panorama" no grupo Inteligência) + um **sistema de alertas/insights reais** no sino da topbar. Tudo gated por capability `intel.view`, sobre RPCs `SECURITY DEFINER` com `admin_require('intel.view')`.

Fora de escopo (fases futuras): cohorts comportamentais sobre `analytics_events`; configuração de regras de alerta pela UI (nesta fase as regras são computadas no servidor com thresholds fixos, versionados em migration); export agendado.

## 1. Camada de dados (migrations, capability `intel.view`)

Todas as funções: `language sql`/`plpgsql` conforme necessário, `STABLE SECURITY DEFINER SET search_path TO 'public'`, primeira linha `perform public.admin_require('intel.view')` (ou, em SQL puro, embutir o guard via wrapper plpgsql — preferir plpgsql para manter o contrato de erro P0003). `revoke execute ... from anon, public; grant execute ... to authenticated, service_role` (padrão da Fundação). Aplicadas via MCP, registradas em `supabase/migrations-log.md`.

### 1.1 `admin_cohort_retention(p_months int default 6)`
Coortes por mês de cadastro (`profiles.created_at`), cruzadas com participação em simulados.
Retorna por coorte: `cohort_month (date)`, `cohort_size (bigint)`, `did_onboarding (bigint)`, `did_1_plus (bigint)`, `did_2_plus (bigint)`, `did_3_plus (bigint)`, `avg_score numeric`. (≥N simulados = distinct simulados com attempt finalizado por usuário daquela coorte.) Limita às últimas `p_months` coortes.

### 1.2 `admin_performance_by_area(p_simulado_id uuid default null, p_segment text default 'all')`
Desempenho por área médica via `attempt_question_results` × `questions.area`, restrito a attempts dentro da janela (`is_within_window = true`) e finalizados.
Retorna por área: `area text`, `total_responses bigint`, `correct_responses bigint`, `correct_rate numeric` (0–100), `n_users bigint`, `n_questions bigint`. Filtros: simulado específico (ou todos) e segmento. Ordenado por `correct_rate asc` (piores primeiro).

### 1.3 `admin_performance_by_theme(p_simulado_id uuid default null, p_area text default null, p_limit int default 12)`
Mesma lógica por `questions.theme` (drill-down dentro de uma área). Retorna `theme, area, correct_rate, total_responses`. Ordenado por `correct_rate asc`, top `p_limit` piores.

### 1.4 `admin_score_distribution(p_simulado_id uuid default null)`
Histograma de notas finais (`user_performance_history.score_percentage`) em faixas de 10 pontos (0–10, …, 90–100).
Retorna `bucket_label text`, `bucket_min int`, `count bigint`.

### 1.5 `admin_score_evolution()`
Evolução simulado-a-simulado (eixo = `simulados.sequence_number`).
Retorna por simulado: `simulado_id uuid`, `sequence_number int`, `title text`, `participants bigint`, `avg_score numeric`, `median_score numeric` (via `percentile_cont(0.5)`), `cutoff_proxy numeric` (média − ½ desvio, indicativo). Ordenado por sequence_number.

### 1.6 `admin_engagement_metrics(p_days int default 30)`
Engajamento/integridade dos attempts no período.
Retorna linha única: `started bigint`, `completed bigint`, `abandonment_rate numeric` (in_progress+expired sem finish / started), `avg_minutes numeric` (finished − started), `median_minutes numeric`, `avg_tab_exits numeric`, `avg_fullscreen_exits numeric`, `high_integrity_flag_pct numeric` (% attempts com tab_exit_count ≥ 3). Comparar com período anterior: incluir `*_prev` para abandonment_rate e avg_minutes.

### 1.7 `admin_segment_breakdown()`
Cross-tab por segmento (guest/standard/pro).
Retorna por segmento: `segment text`, `users bigint`, `participants bigint` (com ≥1 attempt), `participation_rate numeric`, `avg_score numeric`, `avg_attempts numeric`.

### 1.8 `admin_intel_insights()`
Motor de insights/alertas — computa observações sobre as funções acima e devolve uma lista priorizada. **Sem tabela nova**: thresholds fixos no corpo da função.
Retorna 0+ linhas: `id text` (estável, ex. `weakest_area`), `severity text` ('critical'|'warning'|'info'), `category text` ('desempenho'|'engajamento'|'aquisicao'|'conteudo'), `title text`, `detail text`, `metric_value numeric`, `metric_unit text`, `route text` (deep-link para a seção do hub, ex. `/admin/inteligencia#areas`). Regras iniciais:
- **weakest_area** (warning/critical): área com menor correct_rate (< 60% = warning, < 50% = critical).
- **participation_drop** (warning): queda de participantes no último simulado vs anterior > 15%.
- **high_abandonment** (warning/critical): abandonment_rate dos últimos 30d > 25% (warning) / > 40% (critical).
- **integrity_spike** (warning): high_integrity_flag_pct > 20%.
- **low_cohort_activation** (info/warning): coorte mais recente (com ≥30 dias) com did_1_plus/cohort_size < 40%.
- **score_decline** (warning): avg_score do último simulado < avg_score do anterior − 5pts.
Cada regra só emite linha se disparar. Ordenar por severity (critical→info).

## 2. Camada de serviço, hooks e tipos

- `src/admin/types.ts`: adicionar `CohortRetentionRow`, `AreaPerformanceRow`, `ThemePerformanceRow`, `ScoreBucket`, `ScoreEvolutionRow`, `EngagementMetrics`, `SegmentBreakdownRow`, `IntelInsight`.
- `src/admin/services/adminApi.ts`: um método por RPC (padrão dos vizinhos — `supabase.rpc(...)`, throw on error, cast tipado).
- `src/admin/hooks/useAdminInteligencia.ts` (novo): um hook React Query por RPC; `staleTime` 5min; chaves `['admin','intel',<nome>, ...args]`. `useAdminIntelInsights()` com `staleTime` 2min (alimenta o sino e o hub).

## 3. Componentes de visualização (novos + extensão)

Reusar tokens `--admin-*` e `adminChartTheme`. Recharts 2.15.4 (Bar já usado; Line/Area/Pie disponíveis).

- **Extensão `AdminTrendChart`**: aceitar `type?: 'bar' | 'line' | 'area'` e `lines?`/`areas?` análogos a `bars`, para a evolução de notas. Manter retrocompat (default 'bar').
- **`AdminCohortMatrix.tsx` (novo)**: grade coorte × marcos (onboarding, ≥1, ≥2, ≥3 simulados) com células tingidas por intensidade (heatmap via `bg-admin-accent` com opacity proporcional). Cabeçalho de coorte = mês; rodapé/coluna = tamanho. Acessível (table semântica, aria).
- **`AdminBarList.tsx` (novo)**: lista de barras horizontais rotuladas (área/tema → correct_rate), com cor por faixa de severidade (verde/âmbar/vermelho via tokens admin), valor à direita. Reutilizável para área e tema.
- **`AdminInsightCard.tsx` (novo)**: card de insight com ícone por categoria, faixa de severidade (borda esquerda colorida), título, detalhe e link para a seção.
- **`AdminDistributionChart`**: usar `AdminTrendChart type="bar"` (histograma) — sem componente novo.

## 4. Página Hub — "Panorama" (`/admin/inteligencia`)

`src/admin/pages/AdminInteligencia.tsx` (default export, gated por `AdminCapabilityGate capability="intel.view"`, padrão `*Content`).

Layout (top→down), com `AdminPageHeader` (title "Panorama", subtitle, actions = período + segmento) e `AdminPeriodProvider`/estado local de período+segmento:
1. **Faixa de Insights** — grid de `AdminInsightCard` de `admin_intel_insights()` (vazio → `AdminEmptyState` "Tudo sob controle").
2. **Desempenho por área** (`id="areas"`) — `AdminBarList` (piores primeiro) + filtro de simulado; clicar numa área expande temas (`admin_performance_by_theme`).
3. **Evolução de notas** (`id="evolucao"`) — `AdminTrendChart type="line"` (avg + median por simulado) + `AdminStatCard`s (média geral, melhor simulado, pior simulado).
4. **Distribuição de notas** (`id="distribuicao"`) — histograma (`AdminTrendChart type="bar"`).
5. **Retenção por coorte** (`id="cohorts"`) — `AdminCohortMatrix`.
6. **Engajamento & integridade** (`id="engajamento"`) — `AdminStatCard`s (abandono, tempo médio, saídas de aba, flag de integridade) com deltas.
7. **Segmentos** (`id="segmentos"`) — `AdminDataTable` cross-tab (segmento × usuários, participação, média, attempts médios).

Cada seção: estados de loading (skeleton dos componentes), erro (mensagem inline) e vazio (`AdminEmptyState`). Filtros de período/segmento propagam às RPCs aplicáveis.

## 5. Alertas no sino (topbar)

Substituir o placeholder `disabled` em `AdminTopbar` por um sino funcional:
- `src/admin/components/AdminAlertsBell.tsx` (novo): `Popover` (shadcn) com lista de `admin_intel_insights()` (severity-colored), contagem badge (nº de critical+warning) sobre o ícone. Item clicável → navega para `insight.route`. Estado vazio: "Nenhum alerta no momento.". Loading: skeleton. Usa `useAdminIntelInsights()`.
- Gating: só aparece para quem tem `intel.view` (via `useAdminCan`); sem a capability, o sino não é renderizado.
- Dismissal: nesta fase, sem persistência de "lido" (insights são derivados/efêmeros). O badge reflete o estado atual computado.

## 6. Navegação e paleta

- `src/admin/lib/navigation.ts`: adicionar item **Panorama** (`/admin/inteligencia`, icon `Sparkles` ou `Gauge`, capability `intel.view`) como **primeiro** item do grupo "Inteligência" (antes de Jornada).
- `src/App.tsx`: rota lazy `inteligencia` dentro do bloco admin, gated pelo guard existente.
- Command registry: o item Panorama entra automaticamente (NAV_COMMANDS deriva de ADMIN_NAV). Adicionar ação opcional "Ver alertas" que navega ao hub.

## 7. Tratamento de erros e bordas

- Toda RPC degrada para vazio sem quebrar (ex.: 0 attempts finalizados → tabelas/menores retornam 0 linhas; o front mostra `AdminEmptyState`).
- `admin_intel_insights` nunca lança por falta de dados; regras que não conseguem computar são silenciosamente omitidas.
- Divisões por zero protegidas com `nullif`.
- Períodos suportados reusam o seletor existente (7/30/90; cohorts usam `p_months`, independente do período).
- Contrato de erro `unauthorized`/P0003 mantido (front já trata).

## 8. Testes e verificação

- Unit (Vitest): `commandRegistry`/`navigation` incluem Panorama; `AdminBarList` (cores por faixa), `AdminCohortMatrix` (render de células/intensidade), `AdminInsightCard` (severidade→estilo), `AdminAlertsBell` (badge count, lista, empty), extensão `AdminTrendChart` (type line/area). Hook `useAdminIntelInsights` (mock adminApi).
- `npm run test`, `npm run lint`, `npm run build`, `npx tsc --noEmit` verdes.
- Smoke no banco vivo: cada RPC executa e retorna formato esperado com os dados reais (área mais fraca, evolução dos 7 simulados, coortes dos últimos 6 meses, insights computados). Confirmar `admin_require('intel.view')` nega sem a capability e que anon não executa.
- Verificação visual autenticada (hub + sino, dark/light) fica para o usuário (precisa de credenciais), como na Fase 1.

## 9. Fora de escopo (registrado)

- Cohorts comportamentais sobre `analytics_events` (aguarda pipeline com volume em produção).
- UI de configuração de regras de alerta (thresholds hoje fixos em migration).
- Persistência de "alerta lido"/dismissal e notificações push/email.
- Correção do deploy do pipeline de eventos (domínio do app do aluno; só sinalizar).
