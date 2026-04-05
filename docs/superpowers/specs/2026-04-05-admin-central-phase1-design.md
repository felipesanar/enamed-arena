# Admin Central — Fase 1: Shell + Dashboard Executivo

**Data:** 2026-04-05  
**Status:** Aprovado — pronto para implementação  
**Fase:** P0-A (pré-requisito para todos os módulos seguintes)  
**Escopo:** Reconstrução do shell de navegação + implementação do Dashboard Executivo

---

## Contexto e motivação

O admin atual tem 11 arquivos, 2 links na sidebar (Dashboard + Simulados), 4 cards de contador sem nenhuma análise, e zero módulos operacionais. A plataforma já captura 35+ eventos em `analytics_events` e tem dados ricos em `attempts`, `profiles`, `onboarding_profiles` e `user_performance_history` — mas nenhum desses dados é exposto no admin.

Esta fase reconstrói a base sobre a qual todos os módulos futuros serão construídos.

---

## O que está fora do escopo desta fase

- Central de usuários (Fase 2)
- Central de simulados analítica (Fase 2)
- Central de suporte (Fase 2)
- Módulos P1: tentativas, analytics, marketing, produto, tecnologia, auditoria

Os módulos P1 são scaffoldados como stubs nesta fase para que a estrutura de navegação esteja completa desde o início.

---

## 1. Arquitetura do Shell

### 1.1 Estrutura de arquivos

```
src/admin/
├── AdminApp.tsx                    ← reescrito (shell com rail+flyout)
├── AdminGuard.tsx                  ← mantido sem alterações
├── AdminLoginPage.tsx              ← mantido sem alterações
├── components/
│   ├── AdminRail.tsx               ← novo
│   ├── AdminFlyout.tsx             ← novo
│   ├── AdminTopbar.tsx             ← novo
│   └── ui/
│       ├── AdminStatCard.tsx       ← novo (componente compartilhado)
│       ├── AdminTrendChart.tsx     ← novo (componente compartilhado)
│       ├── AdminFunnelChart.tsx    ← novo (componente compartilhado)
│       ├── AdminLivePanel.tsx      ← novo (componente compartilhado)
│       ├── AdminDataTable.tsx      ← novo (componente compartilhado)
│       └── AdminSectionHeader.tsx  ← novo (componente compartilhado)
├── hooks/
│   ├── useAdminAuth.ts             ← mantido sem alterações
│   └── useAdminDashboard.ts        ← novo (React Query hooks)
├── pages/
│   ├── AdminDashboard.tsx          ← reescrito
│   ├── AdminSimulados.tsx          ← mantido sem alterações
│   ├── AdminSimuladoForm.tsx       ← mantido sem alterações
│   ├── AdminUploadQuestions.tsx    ← mantido sem alterações
│   └── stubs/
│       ├── AdminUsuarios.tsx       ← stub P0
│       ├── AdminSupporte.tsx       ← stub P0
│       ├── AdminTentativas.tsx     ← stub P1
│       ├── AdminAnalytics.tsx      ← stub P1
│       ├── AdminMarketing.tsx      ← stub P1
│       ├── AdminProduto.tsx        ← stub P1
│       ├── AdminTecnologia.tsx     ← stub P1
│       └── AdminAuditoria.tsx      ← stub P1
├── services/
│   └── adminApi.ts                 ← expandido com métodos analytics
└── utils/
    └── xlsxImageExtractor.ts       ← mantido sem alterações
```

### 1.2 Roteamento (src/App.tsx)

Rotas novas adicionadas ao bloco `/admin` existente:

```
/admin                        → AdminDashboard
/admin/simulados              → AdminSimulados (mantido)
/admin/simulados/novo         → AdminSimuladoForm (mantido)
/admin/simulados/:id          → AdminSimuladoForm (mantido)
/admin/simulados/:id/questoes → AdminUploadQuestions (mantido)
/admin/usuarios               → AdminUsuarios (stub)
/admin/suporte                → AdminSupporte (stub)
/admin/tentativas             → AdminTentativas (stub)
/admin/analytics              → AdminAnalytics (stub)
/admin/marketing              → AdminMarketing (stub)
/admin/produto                → AdminProduto (stub)
/admin/tecnologia             → AdminTecnologia (stub)
/admin/auditoria              → AdminAuditoria (stub)
```

Todas as rotas continuam protegidas pelo `AdminGuard` existente via `has_role('admin')`.

### 1.3 AdminApp — Shell com rail + flyout

`AdminApp.tsx` passa de um flex simples para o shell com o novo sistema de navegação:

```tsx
// Layout:
// [AdminRail 56px] [AdminFlyout 200px, visível condicionalmente] [main flex-1]
// AdminTopbar ocupa a faixa superior do main
```

Estado de navegação gerenciado localmente em `AdminApp` com `useState<string | null>(activeGroup)`. O flyout abre ao clicar em um grupo no rail e fecha ao clicar fora, pressionar ESC, ou ao navegar.

### 1.4 AdminRail

- Largura fixa: 56px
- Fundo: `bg-card`, `border-r border-border`
- Logo ENAMED no topo (32px, cor `wine`)
- 4 grupos de ícones com separadores visuais entre eles
- Ícone do grupo ativo: `bg-primary/10 border border-primary/30` + indicador lateral `wine` (3px, altura 20px)
- Tooltip nativo (`title`) com nome do grupo ao hover
- Logout no rodapé

**Grupos e ícones (lucide-react):**
| Grupo | Ícone | Módulos |
|-------|-------|---------|
| Operacional | `LayoutDashboard` | Dashboard, Suporte |
| Dados | `Database` | Usuários, Simulados, Tentativas |
| Inteligência | `BarChart3` | Analytics, Marketing, Produto |
| Sistema | `Settings2` | Tecnologia, Auditoria |

### 1.5 AdminFlyout

- Largura: 200px
- Fundo: `bg-card/80 backdrop-blur-sm`, `border-r border-border`
- Aparece à direita do rail via `flex` com transição de largura — **empurra o conteúdo principal**, não sobrepõe
- Animação: `transition-all duration-150` em `width` (0 → 200px) com `overflow-hidden`
- Cabeçalho: nome do grupo em uppercase, `text-muted-foreground text-xs tracking-widest`
- Itens: ícone pequeno (14px) + nome + subtítulo descritivo
- Item ativo: `bg-primary/10 text-primary font-medium`
- Módulos P1 (stubs): visíveis mas com `opacity-40 cursor-not-allowed` + badge "Em breve"
- Fecha ao clicar fora via `useEffect` com `mousedown` listener

### 1.6 AdminTopbar

- Altura: 48px, `border-b border-border bg-background/80 backdrop-blur-sm`
- Esquerda: título da página atual + breadcrumb de 1 nível
- Direita: ícone de busca global (placeholder por ora), ícone de notificação (placeholder), avatar do admin com iniciais
- **Não contém o seletor de período** — o seletor é renderizado no cabeçalho da página `AdminDashboard.tsx`, não no componente `AdminTopbar`. O topbar é idêntico em todas as páginas admin.

---

## 2. Período global (AdminPeriodContext)

Context simples com `period: 7 | 30 | 90` e `setPeriod`. Valor inicial: `7`. Persiste em `sessionStorage` com chave `admin_period`.

Renderizado no `AdminApp` como provider. O seletor de período é exibido no cabeçalho de página do `AdminDashboard.tsx` (canto superior direito, acima das seções) — não no componente `AdminTopbar`, que permanece idêntico em todas as páginas.

---

## 3. Arquitetura de Dados

### 3.1 Migration Supabase

Uma migration com 5 RPCs SECURITY DEFINER. Todas verificam role de admin no início:

```sql
if not exists (
  select 1 from user_roles where user_id = auth.uid() and role = 'admin'
) then
  raise exception 'unauthorized' using errcode = 'P0003';
end if;
```

---

#### `admin_dashboard_kpis(p_days int DEFAULT 7)`

Retorna métricas do período atual e do período anterior para cálculo de delta.

**Retorno (linha única):**
```
total_users         int   -- profiles count total
new_users           int   -- profiles criados no período
new_users_prev      int   -- profiles criados no período anterior
exams_started       int   -- attempts criados no período
exams_started_prev  int
completion_rate     numeric  -- % attempts com status='completed' / total do período
completion_rate_prev numeric
avg_score           numeric  -- média de score_percentage dos attempts completed
avg_score_prev      numeric
activation_rate     numeric  -- distinct users com ≥1 attempt / new_users do período
activation_rate_prev numeric
```

**Fontes:**
- `profiles.created_at` para new_users
- `attempts.created_at` + `attempts.status` para exams
- `user_performance_history.score_percentage` para avg_score

---

#### `admin_events_timeseries(p_days int DEFAULT 7)`

Retorna contagens diárias de 3 métricas específicas.

**Retorno (N linhas, uma por dia):**
```
day              date
new_users        int   -- profiles.created_at naquele dia
exams_started    int   -- analytics_events WHERE event_name = 'simulado_started'
exams_completed  int   -- analytics_events WHERE event_name = 'simulado_completed'
```

**Nota:** `new_users` vem de `profiles`, não de `analytics_events`, para garantir precisão mesmo que o evento de login não tenha sido capturado.

---

#### `admin_funnel_stats(p_days int DEFAULT 7)`

Funil de coorte: universo = usuários registrados no período. Para cada etapa, conta quantos desses usuários realizaram a ação.

**Retorno (6 linhas ordenadas):**
```
step_order    int
step_label    text
user_count    int
conversion_from_prev  numeric  -- % em relação à etapa anterior
```

**Etapas:**
1. Cadastro — `profiles.created_at` no período
2. Onboarding — `onboarding_profiles.completed_at` não nulo para os usuários da coorte
3. Simulado visto — evento `simulado_detail_viewed` para os usuários da coorte
4. Simulado iniciado — `attempts.created_at` para os usuários da coorte
5. Simulado concluído — `attempts` com `status='completed'` para os usuários da coorte
6. Resultado visto — evento `resultado_viewed` para os usuários da coorte

---

#### `admin_simulado_engagement(p_limit int DEFAULT 10)`

Retorna os `p_limit` simulados mais recentes com métricas de engajamento.

**Retorno:**
```
simulado_id         uuid
sequence_number     int
title               text
participants        int   -- distinct user_id com attempt nesse simulado
completion_rate     numeric
avg_score           numeric
abandonment_rate    numeric  -- attempts sem status='completed' / total
```

Ordenado por `execution_window_start DESC`.

---

#### `admin_live_signals()`

Retorna sinais em tempo real. Sem parâmetros.

**Retorno (linha única):**
```
online_last_15min   int   -- distinct user_id em analytics_events nos últimos 15min
active_exams        int   -- attempts com status='in_progress'
open_tickets        int   -- hardcoded 0 por ora (suporte não implementado ainda)
```

**Definição de "online":** usuários com qualquer evento em `analytics_events` nos últimos 15 minutos. Aproximação documentada — não há presença em tempo real via WebSocket.

---

### 3.2 Expansão do adminApi.ts

5 métodos adicionados ao objeto `adminApi` existente. CRUD de simulados e upload de questões não são alterados.

```typescript
adminApi.getDashboardKpis(days: number): Promise<DashboardKpis>
adminApi.getEventsTimeseries(days: number): Promise<TimeseriesRow[]>
adminApi.getFunnelStats(days: number): Promise<FunnelStep[]>
adminApi.getSimuladoEngagement(limit?: number): Promise<SimuladoEngagementRow[]>
adminApi.getLiveSignals(): Promise<LiveSignals>
```

Todos chamam o RPC correspondente via `supabase.rpc(...)`.

### 3.3 Types

Arquivo `src/admin/types.ts` criado com as interfaces:
- `DashboardKpis`
- `TimeseriesRow`
- `FunnelStep`
- `SimuladoEngagementRow`
- `LiveSignals`

### 3.4 React Query hooks (useAdminDashboard.ts)

```typescript
useAdminDashboardKpis(period: number)
  → queryKey: ['admin', 'kpis', period]
  → staleTime: 2 * 60 * 1000

useAdminEventsTimeseries(period: number)
  → queryKey: ['admin', 'timeseries', period]
  → staleTime: 2 * 60 * 1000

useAdminFunnelStats(period: number)
  → queryKey: ['admin', 'funnel', period]
  → staleTime: 2 * 60 * 1000

useAdminSimuladoEngagement()
  → queryKey: ['admin', 'simulado-engagement']
  → staleTime: 5 * 60 * 1000

useAdminLiveSignals()
  → queryKey: ['admin', 'live']
  → staleTime: 0
  → refetchInterval: 60 * 1000
```

Todos recebem dados via `adminApi` e propagam erros para o componente.

---

## 4. Componentes Compartilhados

Todos em `src/admin/components/ui/`. Nenhum deles usa estilos fora do design system (tokens, tipografia, Tailwind classes do projeto).

### AdminStatCard

Props:
```typescript
label: string
value: string | number
delta?: number          // positivo = bom, negativo = ruim, null = neutro
deltaLabel?: string     // ex: "vs período anterior"
trend?: 'up' | 'down' | 'neutral'
accentBorder?: boolean  // borda lateral wine quando KPI em queda relevante
```

- Valor em `text-2xl font-bold`
- Delta em verde (`text-success`) se positivo, vermelho (`text-destructive`) se negativo
- Seta ▲/▼ prefixando o delta
- `accentBorder` adiciona `border-l-2 border-primary` para chamar atenção em KPIs negativos

### AdminTrendChart

Wrapper sobre `BarChart` ou `LineChart` do Recharts.

Props:
```typescript
data: Record<string, unknown>[]
xKey: string
bars?: Array<{ key: string; color: string; label: string }>
lines?: Array<{ key: string; color: string; label: string }>
height?: number   // default: 120
```

- `CartesianGrid` com `stroke` em `hsl(var(--border))`
- `Tooltip` com tema dark, fundo `bg-card border border-border`
- `Legend` opcional, renderizado abaixo do gráfico

### AdminFunnelChart

Props:
```typescript
steps: FunnelStep[]
onStepClick?: (step: FunnelStep) => void
```

- Renderiza os blocos horizontais com gradiente de opacidade da cor `wine`
- Destaca automaticamente a etapa com menor `conversion_from_prev` com borda `border-destructive/40`
- Rodapé com insight textual: "Maior queda: [etapa anterior] → [etapa] (−X%)"

### AdminLivePanel

Props:
```typescript
data: LiveSignals | undefined
isLoading: boolean
```

- Indicador "●" verde pulsante no título ("Ao vivo")
- 3 mini-cards empilhados: Online agora, Em prova, Tickets abertos
- Tickets abertos com fundo `bg-warning/5 border-warning/30` quando > 0

### AdminDataTable (modo compacto)

Props:
```typescript
columns: Array<{ key: string; label: string; width?: string; render?: (row) => ReactNode }>
data: Record<string, unknown>[]
footer?: ReactNode
compact?: boolean   // reduz padding, fonte menor
```

Mesma base que o `AdminDataTable` completo (a ser criado na Fase 2 para o módulo de usuários). O modo `compact` é usado no dashboard inline. Reutilização garante consistência visual.

### AdminSectionHeader

Props:
```typescript
title: string
hook?: string   // nome do hook, exibido como badge sutil
```

Linha com: título uppercase tracking-wide + divisor flex-1 + badge opcional com nome do hook. Visual consistente entre todas as seções do dashboard.

---

## 5. Dashboard (AdminDashboard.tsx)

Composição de UI pura — toda lógica nos hooks.

### Estrutura de seções

```
[AdminTopbar com seletor de período]
│
├── Seção "Visão Executiva"
│   └── 5× AdminStatCard (data: useAdminDashboardKpis)
│
├── Seção "Tendências"
│   ├── AdminTrendChart — Novos cadastros/dia (data: useAdminEventsTimeseries)
│   ├── AdminTrendChart — Iniciados vs Concluídos (data: useAdminEventsTimeseries)
│   └── AdminLivePanel (data: useAdminLiveSignals)
│
├── Seção "Funil de Jornada"
│   └── AdminFunnelChart (data: useAdminFunnelStats)
│
└── Seção "Simulados — Engajamento"
    └── AdminDataTable compact (data: useAdminSimuladoEngagement)
        com link "Ver todos →" para /admin/simulados
```

### Loading states

Cada seção tem seu próprio estado de loading independente. `AdminStatCard` em loading: skeleton de 1 linha de valor + 1 linha de delta. Gráficos em loading: skeleton retangular na altura do gráfico. Nunca bloqueia a página inteira.

### Error states

Se um hook retorna erro, a seção exibe um mini card de erro com botão "Tentar novamente" que chama `refetch()`. Outras seções continuam funcionando normalmente.

### Empty states

Se não há dados no período selecionado, exibe mensagem contextual: "Nenhuma atividade nos últimos X dias" com sugestão de ampliar o período.

---

## 6. Stubs de módulos futuros

8 páginas stub em `src/admin/pages/stubs/`. Estrutura padronizada:

```tsx
export default function AdminXxx() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="text-4xl opacity-20">[ícone]</div>
      <h2 className="text-heading-2 text-foreground">[Nome do módulo]</h2>
      <p className="text-body text-muted-foreground">Em construção — Fase [P0/P1]</p>
    </div>
  )
}
```

---

## 7. Segurança

- `AdminGuard` não muda — continua validando via `has_role('admin')` RPC
- Todos os novos RPCs têm verificação de admin no início com `raise exception 'unauthorized'` se não for admin
- Nenhuma query analítica é executável por usuários não-admin
- `adminApi` não expõe dados sensíveis (senhas, tokens) — acessa apenas tabelas de métricas agregadas

---

## 8. O que NÃO está incluído nesta fase

Estas funcionalidades existem na visão de longo prazo mas não são implementadas aqui:

- Busca global no admin
- Notificações em tempo real
- Persistência de filtros/views salvas
- Drilldown clicável no funil
- Exportação de dados
- Alertas automáticos

Estão planejadas para fases seguintes e não criam débito técnico — os componentes desta fase expõem as interfaces necessárias (ex: `onStepClick` no `AdminFunnelChart`) mas os handlers ficam vazios por ora.

---

## 9. Módulos seguintes (fora do escopo, para referência)

**Fase 2 — P0 restante:**
- Central de usuários: `AdminUsuarios` (listagem) + `AdminUsuarioDetail` (detalhe)
- Central de simulados analítica: substitui o CRUD atual por visão analítica
- Central de suporte: inbox de tickets (sistema próprio ou integração)

**Fase 3 — P1:**
- Tentativas, Analytics/Produto, Marketing, Tecnologia, Auditoria

Cada fase gera um spec separado que referencia este como base.
