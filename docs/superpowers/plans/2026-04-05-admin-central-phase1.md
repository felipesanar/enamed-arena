# Admin Central — Fase 1: Shell + Dashboard Executivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir o shell de navegação do admin (rail + flyout) e implementar o Dashboard Executivo com métricas reais via 5 RPCs Supabase.

**Architecture:** Shell novo em `src/admin/` com `AdminRail` (56px) + `AdminFlyout` (200px animado, empurra conteúdo) + `AdminTopbar`. Dashboard composto de 6 componentes compartilhados alimentados por React Query hooks que chamam RPCs SECURITY DEFINER. CRUD de simulados existente não é tocado.

**Tech Stack:** React 18, React Router 6, TanStack Query 5, Recharts 2, Supabase (RPCs plpgsql), Tailwind CSS 3.4, shadcn/ui, Lucide React, Vitest 3.

---

> **Nota crítica sobre `attempt_status`:** O enum no banco é `in_progress | submitted | expired | offline_pending`. NÃO existe `completed`. Um exame finalizado tem `status IN ('submitted', 'expired')`. Usar isso em todo SQL desta tarefa.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `src/admin/types.ts` | Criar | Interfaces de domínio do admin |
| `supabase/migrations/20260405210000_admin_analytics_rpcs.sql` | Criar | 5 RPCs analytics SECURITY DEFINER |
| `src/admin/services/adminApi.ts` | Modificar | +5 métodos analytics |
| `src/admin/contexts/AdminPeriodContext.tsx` | Criar | Context de período global (7/30/90d) |
| `src/admin/hooks/useAdminDashboard.ts` | Criar | 5 hooks React Query |
| `src/admin/components/ui/AdminStatCard.tsx` | Criar | Card KPI com delta |
| `src/admin/components/ui/AdminSectionHeader.tsx` | Criar | Cabeçalho de seção |
| `src/admin/components/ui/AdminTrendChart.tsx` | Criar | Wrapper Recharts BarChart |
| `src/admin/components/ui/AdminFunnelChart.tsx` | Criar | Funil horizontal com insight |
| `src/admin/components/ui/AdminLivePanel.tsx` | Criar | Painel sinais ao vivo |
| `src/admin/components/ui/AdminDataTable.tsx` | Criar | Tabela compacta reutilizável |
| `src/admin/components/AdminRail.tsx` | Criar | Rail 56px com 4 grupos |
| `src/admin/components/AdminFlyout.tsx` | Criar | Flyout 200px animado |
| `src/admin/components/AdminTopbar.tsx` | Criar | Topbar 48px uniforme |
| `src/admin/AdminApp.tsx` | Reescrever | Shell com rail+flyout+topbar |
| `src/admin/components/AdminSidebar.tsx` | Deletar | Substituído pelo novo shell |
| `src/admin/pages/stubs/*.tsx` | Criar (8 arquivos) | Stubs P0/P1 |
| `src/admin/pages/AdminDashboard.tsx` | Reescrever | Composição do dashboard |
| `src/App.tsx` | Modificar | +9 rotas admin |
| `src/admin/__tests__/AdminStatCard.test.tsx` | Criar | Testes do StatCard |
| `src/admin/__tests__/AdminFunnelChart.test.tsx` | Criar | Testes do funil |

---

## Task 1: Types

**Files:**
- Create: `src/admin/types.ts`

- [ ] **Criar o arquivo de tipos**

```typescript
// src/admin/types.ts

export type AdminPeriod = 7 | 30 | 90

export interface DashboardKpis {
  total_users: number
  new_users: number
  new_users_prev: number
  exams_started: number
  exams_started_prev: number
  completion_rate: number
  completion_rate_prev: number
  avg_score: number
  avg_score_prev: number
  activation_rate: number
  activation_rate_prev: number
}

export interface TimeseriesRow {
  day: string        // 'YYYY-MM-DD'
  new_users: number
  exams_started: number
  exams_completed: number
}

export interface FunnelStep {
  step_order: number
  step_label: string
  user_count: number
  conversion_from_prev: number  // 0–100, percentual
}

export interface SimuladoEngagementRow {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  completion_rate: number   // 0–100
  avg_score: number         // 0–100
  abandonment_rate: number  // 0–100
}

export interface LiveSignals {
  online_last_15min: number
  active_exams: number
  open_tickets: number
}
```

- [ ] **Commit**

```bash
git add src/admin/types.ts
git commit -m "feat(admin): add domain types for analytics dashboard"
```

---

## Task 2: Migration — 5 RPCs analytics

**Files:**
- Create: `supabase/migrations/20260405210000_admin_analytics_rpcs.sql`

- [ ] **Criar o arquivo de migration**

```sql
-- =====================================================================
-- Admin Analytics RPCs — Dashboard Executivo
-- Todas as funções são SECURITY DEFINER com verificação de role admin.
-- =====================================================================

-- ─── Bloco reutilizável de verificação (macro via DO block) ──────────
-- Cada função verifica individualmente via user_roles.

-- ─── 1. admin_dashboard_kpis ─────────────────────────────────────────
create or replace function admin_dashboard_kpis(p_days int default 7)
returns table (
  total_users         bigint,
  new_users           bigint,
  new_users_prev      bigint,
  exams_started       bigint,
  exams_started_prev  bigint,
  completion_rate     numeric,
  completion_rate_prev numeric,
  avg_score           numeric,
  avg_score_prev      numeric,
  activation_rate     numeric,
  activation_rate_prev numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now         timestamptz := now();
  v_cur_start   timestamptz := v_now - (p_days || ' days')::interval;
  v_prev_start  timestamptz := v_now - (p_days * 2 || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    -- total_users
    (select count(*)::bigint from profiles),

    -- new_users (período atual)
    (select count(*)::bigint from profiles
     where created_at >= v_cur_start),

    -- new_users_prev
    (select count(*)::bigint from profiles
     where created_at >= v_prev_start and created_at < v_cur_start),

    -- exams_started (período atual)
    (select count(*)::bigint from attempts
     where created_at >= v_cur_start),

    -- exams_started_prev
    (select count(*)::bigint from attempts
     where created_at >= v_prev_start and created_at < v_cur_start),

    -- completion_rate atual: status submitted ou expired / total no período
    coalesce(
      round(
        (select count(*) filter (where status in ('submitted', 'expired'))::numeric
               / nullif(count(*), 0) * 100
         from attempts where created_at >= v_cur_start),
      1), 0),

    -- completion_rate_prev
    coalesce(
      round(
        (select count(*) filter (where status in ('submitted', 'expired'))::numeric
               / nullif(count(*), 0) * 100
         from attempts where created_at >= v_prev_start and created_at < v_cur_start),
      1), 0),

    -- avg_score atual (de user_performance_history, que só tem finalizados)
    coalesce(
      round((select avg(score_percentage)
             from user_performance_history
             where finished_at >= v_cur_start)::numeric, 1),
      0),

    -- avg_score_prev
    coalesce(
      round((select avg(score_percentage)
             from user_performance_history
             where finished_at >= v_prev_start and finished_at < v_cur_start)::numeric, 1),
      0),

    -- activation_rate: usuários que criaram ≥1 attempt / new_users do período
    coalesce(
      round(
        (select count(distinct a.user_id)::numeric
               / nullif(
                   (select count(*) from profiles where created_at >= v_cur_start), 0
                 ) * 100
         from attempts a
         join profiles p on p.id = a.user_id
         where p.created_at >= v_cur_start),
      1), 0),

    -- activation_rate_prev
    coalesce(
      round(
        (select count(distinct a.user_id)::numeric
               / nullif(
                   (select count(*) from profiles
                    where created_at >= v_prev_start and created_at < v_cur_start), 0
                 ) * 100
         from attempts a
         join profiles p on p.id = a.user_id
         where p.created_at >= v_prev_start and p.created_at < v_cur_start),
      1), 0);
end;
$$;

grant execute on function admin_dashboard_kpis(int) to authenticated;

-- ─── 2. admin_events_timeseries ───────────────────────────────────────
create or replace function admin_events_timeseries(p_days int default 7)
returns table (
  day             date,
  new_users       bigint,
  exams_started   bigint,
  exams_completed bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  with days as (
    select generate_series(
      date_trunc('day', v_cur_start),
      date_trunc('day', now()),
      '1 day'::interval
    )::date as d
  ),
  reg as (
    select date_trunc('day', created_at)::date as d, count(*) as cnt
    from profiles where created_at >= v_cur_start
    group by 1
  ),
  started as (
    select date_trunc('day', created_at)::date as d, count(*) as cnt
    from attempts where created_at >= v_cur_start
    group by 1
  ),
  completed as (
    select date_trunc('day', finished_at)::date as d, count(*) as cnt
    from attempts
    where finished_at >= v_cur_start
      and status in ('submitted', 'expired')
    group by 1
  )
  select
    days.d,
    coalesce(reg.cnt, 0)::bigint,
    coalesce(started.cnt, 0)::bigint,
    coalesce(completed.cnt, 0)::bigint
  from days
  left join reg       on reg.d = days.d
  left join started   on started.d = days.d
  left join completed on completed.d = days.d
  order by days.d;
end;
$$;

grant execute on function admin_events_timeseries(int) to authenticated;

-- ─── 3. admin_funnel_stats ────────────────────────────────────────────
-- Funil de coorte: universo = usuários registrados no período.
create or replace function admin_funnel_stats(p_days int default 7)
returns table (
  step_order           int,
  step_label           text,
  user_count           bigint,
  conversion_from_prev numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur_start timestamptz := now() - (p_days || ' days')::interval;
  v_step1 bigint;
  v_step2 bigint;
  v_step3 bigint;
  v_step4 bigint;
  v_step5 bigint;
  v_step6 bigint;
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  -- 1. Cadastro no período
  select count(*) into v_step1 from profiles where created_at >= v_cur_start;

  -- 2. Onboarding concluído (do coorte)
  select count(distinct op.user_id) into v_step2
  from onboarding_profiles op
  join profiles p on p.id = op.user_id
  where p.created_at >= v_cur_start
    and op.completed_at is not null;

  -- 3. Simulado visto (evento simulado_detail_viewed do coorte)
  select count(distinct ae.user_id) into v_step3
  from analytics_events ae
  join profiles p on p.id = ae.user_id
  where p.created_at >= v_cur_start
    and ae.event_name = 'simulado_detail_viewed'
    and ae.user_id is not null;

  -- 4. Simulado iniciado (attempt do coorte)
  select count(distinct a.user_id) into v_step4
  from attempts a
  join profiles p on p.id = a.user_id
  where p.created_at >= v_cur_start;

  -- 5. Simulado concluído (do coorte)
  select count(distinct a.user_id) into v_step5
  from attempts a
  join profiles p on p.id = a.user_id
  where p.created_at >= v_cur_start
    and a.status in ('submitted', 'expired');

  -- 6. Resultado visto (do coorte)
  select count(distinct ae.user_id) into v_step6
  from analytics_events ae
  join profiles p on p.id = ae.user_id
  where p.created_at >= v_cur_start
    and ae.event_name = 'resultado_viewed'
    and ae.user_id is not null;

  return query values
    (1, 'Cadastro',         v_step1, 100.0),
    (2, 'Onboarding',       v_step2, round(v_step2::numeric / nullif(v_step1,0) * 100, 1)),
    (3, 'Simulado visto',   v_step3, round(v_step3::numeric / nullif(v_step2,0) * 100, 1)),
    (4, 'Iniciou prova',    v_step4, round(v_step4::numeric / nullif(v_step3,0) * 100, 1)),
    (5, 'Concluiu',         v_step5, round(v_step5::numeric / nullif(v_step4,0) * 100, 1)),
    (6, 'Viu resultado',    v_step6, round(v_step6::numeric / nullif(v_step5,0) * 100, 1));
end;
$$;

grant execute on function admin_funnel_stats(int) to authenticated;

-- ─── 4. admin_simulado_engagement ─────────────────────────────────────
create or replace function admin_simulado_engagement(p_limit int default 10)
returns table (
  simulado_id      uuid,
  sequence_number  int,
  title            text,
  participants     bigint,
  completion_rate  numeric,
  avg_score        numeric,
  abandonment_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    s.id,
    s.sequence_number,
    s.title,
    count(distinct a.user_id)::bigint as participants,
    coalesce(round(
      count(*) filter (where a.status in ('submitted', 'expired'))::numeric
      / nullif(count(*), 0) * 100, 1), 0) as completion_rate,
    coalesce(round(avg(uph.score_percentage)::numeric, 1), 0) as avg_score,
    coalesce(round(
      count(*) filter (where a.status not in ('submitted', 'expired'))::numeric
      / nullif(count(*), 0) * 100, 1), 0) as abandonment_rate
  from simulados s
  left join attempts a on a.simulado_id = s.id
  left join user_performance_history uph on uph.attempt_id = a.id
  group by s.id, s.sequence_number, s.title, s.execution_window_start
  order by s.execution_window_start desc
  limit p_limit;
end;
$$;

grant execute on function admin_simulado_engagement(int) to authenticated;

-- ─── 5. admin_live_signals ────────────────────────────────────────────
-- "online" = distinct user_id com evento nos últimos 15 minutos.
-- Aproximação documentada — não há presença WebSocket.
create or replace function admin_live_signals()
returns table (
  online_last_15min  bigint,
  active_exams       bigint,
  open_tickets       bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized' using errcode = 'P0003';
  end if;

  return query
  select
    (select count(distinct user_id)
     from analytics_events
     where created_at >= now() - interval '15 minutes'
       and user_id is not null)::bigint,

    (select count(*)
     from attempts
     where status = 'in_progress')::bigint,

    -- open_tickets: hardcoded 0 até módulo de suporte ser implementado
    0::bigint;
end;
$$;

grant execute on function admin_live_signals() to authenticated;
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260405210000_admin_analytics_rpcs.sql
git commit -m "feat(admin): add 5 analytics RPCs for executive dashboard"
```

---

## Task 3: adminApi — 5 novos métodos

**Files:**
- Modify: `src/admin/services/adminApi.ts`

- [ ] **Adicionar import de tipos no topo do arquivo**

No início de `src/admin/services/adminApi.ts`, após o import existente:

```typescript
import type {
  DashboardKpis,
  TimeseriesRow,
  FunnelStep,
  SimuladoEngagementRow,
  LiveSignals,
} from '@/admin/types'
```

- [ ] **Adicionar os 5 métodos ao objeto `adminApi` (antes do fechamento `}`)**

```typescript
  // ─── Analytics Dashboard ───
  async getDashboardKpis(days: number): Promise<DashboardKpis> {
    const { data, error } = await supabase.rpc('admin_dashboard_kpis', { p_days: days })
    if (error) throw error
    const row = (data as any[])[0]
    return {
      total_users: Number(row.total_users),
      new_users: Number(row.new_users),
      new_users_prev: Number(row.new_users_prev),
      exams_started: Number(row.exams_started),
      exams_started_prev: Number(row.exams_started_prev),
      completion_rate: Number(row.completion_rate),
      completion_rate_prev: Number(row.completion_rate_prev),
      avg_score: Number(row.avg_score),
      avg_score_prev: Number(row.avg_score_prev),
      activation_rate: Number(row.activation_rate),
      activation_rate_prev: Number(row.activation_rate_prev),
    }
  },

  async getEventsTimeseries(days: number): Promise<TimeseriesRow[]> {
    const { data, error } = await supabase.rpc('admin_events_timeseries', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      day: r.day as string,
      new_users: Number(r.new_users),
      exams_started: Number(r.exams_started),
      exams_completed: Number(r.exams_completed),
    }))
  },

  async getFunnelStats(days: number): Promise<FunnelStep[]> {
    const { data, error } = await supabase.rpc('admin_funnel_stats', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      step_order: Number(r.step_order),
      step_label: r.step_label as string,
      user_count: Number(r.user_count),
      conversion_from_prev: Number(r.conversion_from_prev),
    }))
  },

  async getSimuladoEngagement(limit = 10): Promise<SimuladoEngagementRow[]> {
    const { data, error } = await supabase.rpc('admin_simulado_engagement', { p_limit: limit })
    if (error) throw error
    return (data as any[]).map(r => ({
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      title: r.title as string,
      participants: Number(r.participants),
      completion_rate: Number(r.completion_rate),
      avg_score: Number(r.avg_score),
      abandonment_rate: Number(r.abandonment_rate),
    }))
  },

  async getLiveSignals(): Promise<LiveSignals> {
    const { data, error } = await supabase.rpc('admin_live_signals')
    if (error) throw error
    const row = (data as any[])[0]
    return {
      online_last_15min: Number(row.online_last_15min),
      active_exams: Number(row.active_exams),
      open_tickets: Number(row.open_tickets),
    }
  },
```

- [ ] **Commit**

```bash
git add src/admin/services/adminApi.ts
git commit -m "feat(admin): add 5 analytics methods to adminApi"
```

---

## Task 4: AdminPeriodContext

**Files:**
- Create: `src/admin/contexts/AdminPeriodContext.tsx`

- [ ] **Criar o context**

```typescript
// src/admin/contexts/AdminPeriodContext.tsx
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { AdminPeriod } from '@/admin/types'

const STORAGE_KEY = 'admin_period'

interface AdminPeriodContextValue {
  period: AdminPeriod
  setPeriod: (p: AdminPeriod) => void
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null)

export function AdminPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<AdminPeriod>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return (stored === '7' || stored === '30' || stored === '90')
      ? (Number(stored) as AdminPeriod)
      : 7
  })

  const setPeriod = (p: AdminPeriod) => {
    sessionStorage.setItem(STORAGE_KEY, String(p))
    setPeriodState(p)
  }

  return (
    <AdminPeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </AdminPeriodContext.Provider>
  )
}

export function useAdminPeriod() {
  const ctx = useContext(AdminPeriodContext)
  if (!ctx) throw new Error('useAdminPeriod must be used inside AdminPeriodProvider')
  return ctx
}
```

- [ ] **Commit**

```bash
git add src/admin/contexts/AdminPeriodContext.tsx
git commit -m "feat(admin): add AdminPeriodContext (7/30/90d global period)"
```

---

## Task 5: useAdminDashboard hooks

**Files:**
- Create: `src/admin/hooks/useAdminDashboard.ts`

- [ ] **Criar o arquivo de hooks**

```typescript
// src/admin/hooks/useAdminDashboard.ts
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminDashboardKpis(period: number) {
  return useQuery({
    queryKey: ['admin', 'kpis', period],
    queryFn: () => adminApi.getDashboardKpis(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminEventsTimeseries(period: number) {
  return useQuery({
    queryKey: ['admin', 'timeseries', period],
    queryFn: () => adminApi.getEventsTimeseries(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminFunnelStats(period: number) {
  return useQuery({
    queryKey: ['admin', 'funnel', period],
    queryFn: () => adminApi.getFunnelStats(period),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminSimuladoEngagement(limit = 10) {
  return useQuery({
    queryKey: ['admin', 'simulado-engagement', limit],
    queryFn: () => adminApi.getSimuladoEngagement(limit),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminLiveSignals() {
  return useQuery({
    queryKey: ['admin', 'live'],
    queryFn: () => adminApi.getLiveSignals(),
    staleTime: 0,
    refetchInterval: 60 * 1000,
  })
}
```

- [ ] **Commit**

```bash
git add src/admin/hooks/useAdminDashboard.ts
git commit -m "feat(admin): add React Query hooks for dashboard data"
```

---

## Task 6: AdminStatCard + testes

**Files:**
- Create: `src/admin/components/ui/AdminStatCard.tsx`
- Create: `src/admin/__tests__/AdminStatCard.test.tsx`

- [ ] **Escrever os testes primeiro**

```typescript
// src/admin/__tests__/AdminStatCard.test.tsx
import { render, screen } from '@testing-library/react'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'

describe('AdminStatCard', () => {
  it('renders label and value', () => {
    render(<AdminStatCard label="Usuários totais" value={1247} />)
    expect(screen.getByText('Usuários totais')).toBeInTheDocument()
    expect(screen.getByText('1247')).toBeInTheDocument()
  })

  it('shows green arrow for positive delta', () => {
    render(<AdminStatCard label="Novos" value={48} delta={12} deltaLabel="vs período ant." />)
    expect(screen.getByText(/\+12/)).toBeInTheDocument()
    expect(screen.getByText(/vs período ant\./)).toBeInTheDocument()
  })

  it('shows red arrow for negative delta', () => {
    render(<AdminStatCard label="Conclusão" value="71%" delta={-4} />)
    expect(screen.getByText(/−4/)).toBeInTheDocument()
  })

  it('shows neutral text when delta is undefined', () => {
    render(<AdminStatCard label="Média" value="58,4%" />)
    expect(screen.queryByText(/▲/)).not.toBeInTheDocument()
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument()
  })

  it('applies loading skeleton when isLoading is true', () => {
    const { container } = render(<AdminStatCard label="X" value={0} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
```

- [ ] **Rodar o teste para confirmar que falha**

```bash
cd "C:\Users\Felipe Souza\Documents\enamed-arena"
npm run test -- src/admin/__tests__/AdminStatCard.test.tsx --run
```

Esperado: FAIL — `AdminStatCard` não existe.

- [ ] **Criar o componente**

```typescript
// src/admin/components/ui/AdminStatCard.tsx
import { cn } from '@/lib/utils'

interface AdminStatCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  accentBorder?: boolean
  isLoading?: boolean
}

export function AdminStatCard({
  label,
  value,
  delta,
  deltaLabel,
  accentBorder,
  isLoading,
}: AdminStatCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse bg-card rounded-lg border border-border p-3">
        <div className="h-3 bg-muted rounded w-2/3 mb-3" />
        <div className="h-6 bg-muted rounded w-1/2 mb-2" />
        <div className="h-2.5 bg-muted rounded w-1/3" />
      </div>
    )
  }

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  return (
    <div
      className={cn(
        'bg-card rounded-lg border border-border p-3',
        accentBorder && 'border-l-2 border-l-primary',
      )}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground leading-none mb-1.5">
        {value}
      </p>
      {delta !== undefined ? (
        <p
          className={cn(
            'text-[10px] flex items-center gap-1',
            isPositive && 'text-success',
            isNegative && 'text-destructive',
            !isPositive && !isNegative && 'text-muted-foreground',
          )}
        >
          {isPositive && `▲ +${delta}`}
          {isNegative && `▼ −${Math.abs(delta)}`}
          {!isPositive && !isNegative && `― ${Math.abs(delta)}`}
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Rodar o teste para confirmar que passa**

```bash
npm run test -- src/admin/__tests__/AdminStatCard.test.tsx --run
```

Esperado: PASS (5 testes).

- [ ] **Commit**

```bash
git add src/admin/components/ui/AdminStatCard.tsx src/admin/__tests__/AdminStatCard.test.tsx
git commit -m "feat(admin): add AdminStatCard with delta display and loading skeleton"
```

---

## Task 7: AdminSectionHeader

**Files:**
- Create: `src/admin/components/ui/AdminSectionHeader.tsx`

- [ ] **Criar o componente**

```typescript
// src/admin/components/ui/AdminSectionHeader.tsx
interface AdminSectionHeaderProps {
  title: string
  hook?: string
}

export function AdminSectionHeader({ title, hook }: AdminSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
      {hook && (
        <span className="text-[9px] text-muted-foreground/40 bg-card border border-border px-2 py-0.5 rounded-full whitespace-nowrap">
          {hook}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/ui/AdminSectionHeader.tsx
git commit -m "feat(admin): add AdminSectionHeader"
```

---

## Task 8: AdminTrendChart

**Files:**
- Create: `src/admin/components/ui/AdminTrendChart.tsx`

- [ ] **Criar o componente**

```typescript
// src/admin/components/ui/AdminTrendChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface BarSeries {
  key: string
  color: string
  label: string
}

interface AdminTrendChartProps {
  title: string
  data: Record<string, unknown>[]
  xKey: string
  bars: BarSeries[]
  height?: number
  isLoading?: boolean
}

export function AdminTrendChart({
  title,
  data,
  xKey,
  bars,
  height = 120,
  isLoading,
}: AdminTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-1/3 mb-3" />
        <div className="bg-muted rounded" style={{ height }} />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold text-foreground mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)} // 'YYYY-MM-DD' → 'MM-DD'
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'hsl(var(--foreground))',
            }}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
              formatter={(value) => bars.find(b => b.key === value)?.label ?? value}
            />
          )}
          {bars.map(b => (
            <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/ui/AdminTrendChart.tsx
git commit -m "feat(admin): add AdminTrendChart (Recharts BarChart wrapper)"
```

---

## Task 9: AdminFunnelChart + testes

**Files:**
- Create: `src/admin/components/ui/AdminFunnelChart.tsx`
- Create: `src/admin/__tests__/AdminFunnelChart.test.tsx`

- [ ] **Escrever os testes primeiro**

```typescript
// src/admin/__tests__/AdminFunnelChart.test.tsx
import { render, screen } from '@testing-library/react'
import { AdminFunnelChart } from '@/admin/components/ui/AdminFunnelChart'
import type { FunnelStep } from '@/admin/types'

const steps: FunnelStep[] = [
  { step_order: 1, step_label: 'Cadastro',       user_count: 100, conversion_from_prev: 100 },
  { step_order: 2, step_label: 'Onboarding',     user_count: 71,  conversion_from_prev: 71 },
  { step_order: 3, step_label: 'Simulado visto', user_count: 50,  conversion_from_prev: 70.4 },
  { step_order: 4, step_label: 'Iniciou prova',  user_count: 20,  conversion_from_prev: 40 },
  { step_order: 5, step_label: 'Concluiu',       user_count: 15,  conversion_from_prev: 75 },
  { step_order: 6, step_label: 'Viu resultado',  user_count: 12,  conversion_from_prev: 80 },
]

describe('AdminFunnelChart', () => {
  it('renders all step labels', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('Cadastro')).toBeInTheDocument()
    expect(screen.getByText('Iniciou prova')).toBeInTheDocument()
    expect(screen.getByText('Viu resultado')).toBeInTheDocument()
  })

  it('renders user counts', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('identifies and highlights the biggest drop step', () => {
    render(<AdminFunnelChart steps={steps} />)
    // Step 4 (Iniciou prova) has lowest conversion_from_prev = 40
    expect(screen.getByText(/Maior queda/)).toBeInTheDocument()
    expect(screen.getByText(/Simulado visto/)).toBeInTheDocument()
    expect(screen.getByText(/Iniciou prova/)).toBeInTheDocument()
  })
})
```

- [ ] **Rodar o teste para confirmar que falha**

```bash
npm run test -- src/admin/__tests__/AdminFunnelChart.test.tsx --run
```

Esperado: FAIL — `AdminFunnelChart` não existe.

- [ ] **Criar o componente**

```typescript
// src/admin/components/ui/AdminFunnelChart.tsx
import { cn } from '@/lib/utils'
import type { FunnelStep } from '@/admin/types'

// Gera gradiente de opacidade baseado na posição (primeiro = mais escuro)
function stepOpacity(index: number, total: number): string {
  const min = 0.25
  const opacity = 1 - (index / (total - 1)) * (1 - min)
  return String(Math.round(opacity * 100) / 100)
}

interface AdminFunnelChartProps {
  steps: FunnelStep[]
  isLoading?: boolean
}

export function AdminFunnelChart({ steps, isLoading }: AdminFunnelChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4 animate-pulse">
        <div className="h-3 bg-muted rounded w-1/4 mb-4" />
        <div className="flex gap-1 items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 h-14 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Encontrar o maior drop (ignorando step 1 que sempre é 100%)
  const stepsWithDrop = steps.slice(1)
  const biggestDropStep = stepsWithDrop.reduce((min, s) =>
    s.conversion_from_prev < min.conversion_from_prev ? s : min,
    stepsWithDrop[0],
  )
  const biggestDropIndex = steps.findIndex(s => s.step_order === biggestDropStep.step_order)
  const prevStep = steps[biggestDropIndex - 1]

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-stretch gap-0.5">
        {steps.map((step, i) => (
          <div key={step.step_order} className="flex items-center flex-1 gap-0.5">
            <div
              className={cn(
                'flex-1 rounded px-2 py-2.5 text-center',
                step.step_order === biggestDropStep.step_order &&
                  'ring-1 ring-destructive/40',
              )}
              style={{
                backgroundColor: `hsl(345 65% 42% / ${stepOpacity(i, steps.length)})`,
              }}
            >
              <p className="text-base font-bold text-white leading-none mb-1">
                {step.user_count.toLocaleString('pt-BR')}
              </p>
              <p className="text-[9px] text-white/60 leading-tight">{step.step_label}</p>
              {i > 0 && (
                <p
                  className={cn(
                    'text-[9px] mt-1 font-medium',
                    step.conversion_from_prev >= 70 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {step.conversion_from_prev}%
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <span className="text-border text-xs flex-shrink-0">›</span>
            )}
          </div>
        ))}
      </div>

      {biggestDropStep && prevStep && (
        <div className="mt-3 px-3 py-2 bg-destructive/5 border border-destructive/20 rounded text-[10px]">
          <span className="text-destructive font-semibold">⚠ Maior queda: </span>
          <span className="text-muted-foreground">
            {prevStep.step_label} → {biggestDropStep.step_label} (−
            {(100 - biggestDropStep.conversion_from_prev).toFixed(1)}pp). Possível fricção nessa etapa.
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Rodar o teste para confirmar que passa**

```bash
npm run test -- src/admin/__tests__/AdminFunnelChart.test.tsx --run
```

Esperado: PASS (3 testes).

- [ ] **Commit**

```bash
git add src/admin/components/ui/AdminFunnelChart.tsx src/admin/__tests__/AdminFunnelChart.test.tsx
git commit -m "feat(admin): add AdminFunnelChart with biggest-drop highlight"
```

---

## Task 10: AdminLivePanel + AdminDataTable

**Files:**
- Create: `src/admin/components/ui/AdminLivePanel.tsx`
- Create: `src/admin/components/ui/AdminDataTable.tsx`

- [ ] **Criar AdminLivePanel**

```typescript
// src/admin/components/ui/AdminLivePanel.tsx
import { cn } from '@/lib/utils'
import type { LiveSignals } from '@/admin/types'

interface AdminLivePanelProps {
  data: LiveSignals | undefined
  isLoading: boolean
}

function LiveCard({
  label,
  value,
  warning,
  isLoading,
}: {
  label: string
  value: number
  warning?: boolean
  isLoading: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md px-2.5 py-2 border',
        warning && value > 0
          ? 'bg-warning/5 border-warning/30'
          : 'bg-background border-border',
      )}
    >
      <p className={cn('text-[9px] mb-0.5', warning && value > 0 ? 'text-warning' : 'text-muted-foreground')}>
        {warning && value > 0 ? '⚠ ' : ''}{label}
      </p>
      {isLoading ? (
        <div className="h-5 w-8 bg-muted rounded animate-pulse" />
      ) : (
        <p className={cn('text-lg font-bold', warning && value > 0 ? 'text-warning' : 'text-foreground')}>
          {value}
        </p>
      )}
    </div>
  )
}

export function AdminLivePanel({ data, isLoading }: AdminLivePanelProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <p className="text-[11px] font-semibold text-foreground">Ao vivo</p>
      </div>
      <LiveCard
        label="Online agora"
        value={data?.online_last_15min ?? 0}
        isLoading={isLoading}
      />
      <LiveCard
        label="Em prova agora"
        value={data?.active_exams ?? 0}
        isLoading={isLoading}
      />
      <LiveCard
        label="Tickets abertos"
        value={data?.open_tickets ?? 0}
        warning
        isLoading={isLoading}
      />
      <p className="text-[8px] text-muted-foreground/40 text-center">
        "online" = eventos nos últimos 15 min
      </p>
    </div>
  )
}
```

- [ ] **Criar AdminDataTable**

```typescript
// src/admin/components/ui/AdminDataTable.tsx
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  label: string
  width?: string
  render?: (row: T) => ReactNode
}

interface AdminDataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  footer?: ReactNode
  compact?: boolean
  isLoading?: boolean
  emptyMessage?: string
}

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  footer,
  compact,
  isLoading,
  emptyMessage = 'Nenhum dado encontrado.',
}: AdminDataTableProps<T>) {
  const cellPadding = compact ? 'px-3.5 py-2' : 'px-4 py-3'
  const textSize = compact ? 'text-[11px]' : 'text-sm'

  const gridStyle = {
    gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden animate-pulse">
        <div className="grid border-b border-border px-3.5 py-2" style={gridStyle}>
          {columns.map(c => (
            <div key={c.key} className="h-2.5 bg-muted rounded w-2/3" />
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="grid border-b border-border/50 px-3.5 py-2.5" style={gridStyle}>
            {columns.map(c => (
              <div key={c.key} className="h-3 bg-muted/60 rounded w-4/5" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="grid border-b border-border" style={gridStyle}>
        {columns.map(c => (
          <div key={c.key} className={cn(cellPadding)}>
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide">
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.length === 0 ? (
        <div className={cn(cellPadding, 'text-center text-muted-foreground', textSize)}>
          {emptyMessage}
        </div>
      ) : (
        data.map((row, i) => (
          <div
            key={i}
            className={cn(
              'grid border-b border-border/40 last:border-0',
              i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20',
            )}
            style={gridStyle}
          >
            {columns.map(c => (
              <div key={c.key} className={cn(cellPadding, textSize, 'text-foreground')}>
                {c.render ? c.render(row) : String(row[c.key] ?? '')}
              </div>
            ))}
          </div>
        ))
      )}

      {footer && (
        <div className={cn(cellPadding, 'border-t border-border text-muted-foreground', textSize)}>
          {footer}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/ui/AdminLivePanel.tsx src/admin/components/ui/AdminDataTable.tsx
git commit -m "feat(admin): add AdminLivePanel and AdminDataTable shared components"
```

---

## Task 11: AdminRail

**Files:**
- Create: `src/admin/components/AdminRail.tsx`

- [ ] **Criar o componente**

```typescript
// src/admin/components/AdminRail.tsx
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Database, BarChart3, Settings2, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'

export type RailGroup = 'operacional' | 'dados' | 'inteligencia' | 'sistema'

interface RailGroupConfig {
  id: RailGroup
  label: string
  icon: React.ElementType
}

const GROUPS: RailGroupConfig[] = [
  { id: 'operacional',  label: 'Operacional',  icon: LayoutDashboard },
  { id: 'dados',        label: 'Dados',         icon: Database },
  { id: 'inteligencia', label: 'Inteligência',  icon: BarChart3 },
  { id: 'sistema',      label: 'Sistema',       icon: Settings2 },
]

interface AdminRailProps {
  activeGroup: RailGroup | null
  onGroupClick: (group: RailGroup) => void
}

export function AdminRail({ activeGroup, onGroupClick }: AdminRailProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <aside className="w-14 shrink-0 bg-card border-r border-border flex flex-col items-center py-3 gap-1 min-h-screen z-20">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-3 shrink-0">
        <span className="text-primary-foreground text-sm font-black">E</span>
      </div>

      {GROUPS.map((g, i) => {
        const Icon = g.icon
        const isActive = activeGroup === g.id
        return (
          <div key={g.id}>
            {i > 0 && <div className="w-6 h-px bg-border my-1" />}
            <button
              title={g.label}
              onClick={() => onGroupClick(g.id)}
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative',
                isActive
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <Icon className="h-4 w-4" />
            </button>
          </div>
        )
      })}

      <div className="flex-1" />

      <button
        title="Sair"
        onClick={handleLogout}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </aside>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/AdminRail.tsx
git commit -m "feat(admin): add AdminRail with 4 group icons"
```

---

## Task 12: AdminFlyout

**Files:**
- Create: `src/admin/components/AdminFlyout.tsx`

- [ ] **Criar o componente**

```typescript
// src/admin/components/AdminFlyout.tsx
import { useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Headphones, Users, FileText, ClipboardList,
  BarChart3, Megaphone, Compass, Monitor, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RailGroup } from './AdminRail'

interface FlyoutItem {
  to: string
  label: string
  description: string
  icon: React.ElementType
  phase: 'live' | 'p0' | 'p1'
}

const FLYOUT_GROUPS: Record<RailGroup, { title: string; items: FlyoutItem[] }> = {
  operacional: {
    title: 'Operacional',
    items: [
      { to: '/admin',     label: 'Dashboard', description: 'Central de comando', icon: LayoutDashboard, phase: 'live' },
      { to: '/admin/suporte', label: 'Suporte', description: 'Tickets e chamados', icon: Headphones, phase: 'p0' },
    ],
  },
  dados: {
    title: 'Dados',
    items: [
      { to: '/admin/usuarios',   label: 'Usuários',   description: 'Gestão e perfis',      icon: Users,          phase: 'p0' },
      { to: '/admin/simulados',  label: 'Simulados',  description: 'Gestão e analytics',   icon: FileText,       phase: 'live' },
      { to: '/admin/tentativas', label: 'Tentativas', description: 'Histórico e detalhes', icon: ClipboardList,  phase: 'p1' },
    ],
  },
  inteligencia: {
    title: 'Inteligência',
    items: [
      { to: '/admin/analytics', label: 'Analytics', description: 'Produto e jornada',   icon: BarChart3,  phase: 'p1' },
      { to: '/admin/marketing', label: 'Marketing', description: 'Aquisição e coortes', icon: Megaphone,  phase: 'p1' },
      { to: '/admin/produto',   label: 'Produto',   description: 'Funil e fricções',    icon: Compass,    phase: 'p1' },
    ],
  },
  sistema: {
    title: 'Sistema',
    items: [
      { to: '/admin/tecnologia', label: 'Tecnologia', description: 'Saúde e erros',       icon: Monitor, phase: 'p1' },
      { to: '/admin/auditoria',  label: 'Auditoria',  description: 'Permissões e logs',   icon: Shield,  phase: 'p1' },
    ],
  },
}

interface AdminFlyoutProps {
  activeGroup: RailGroup | null
  onClose: () => void
}

export function AdminFlyout({ activeGroup, onClose }: AdminFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = activeGroup !== null
  const group = activeGroup ? FLYOUT_GROUPS[activeGroup] : null

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'shrink-0 bg-card/90 backdrop-blur-sm border-r border-border overflow-hidden transition-all duration-150',
        isOpen ? 'w-52' : 'w-0',
      )}
    >
      <div className="w-52 h-full flex flex-col p-3 pt-4">
        {group && (
          <>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 px-1">
              {group.title}
            </p>
            <nav className="flex flex-col gap-0.5 flex-1">
              {group.items.map(item => {
                const Icon = item.icon
                const isStub = item.phase === 'p1' || item.phase === 'p0'
                const isDisabled = item.phase === 'p1'

                if (isDisabled) {
                  return (
                    <div
                      key={item.to}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md opacity-35 cursor-not-allowed"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-muted-foreground truncate">
                            {item.label}
                          </span>
                          <span className="text-[8px] bg-muted text-muted-foreground px-1 py-0.5 rounded">
                            em breve
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 truncate">{item.description}</p>
                      </div>
                    </div>
                  )
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate leading-tight">{item.label}</p>
                      <p className="text-[9px] text-muted-foreground/70 truncate">{item.description}</p>
                    </div>
                  </NavLink>
                )
              })}
            </nav>
            <p className="text-[8px] text-muted-foreground/25 text-center pt-2 border-t border-border/50">
              ESC para fechar
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/AdminFlyout.tsx
git commit -m "feat(admin): add AdminFlyout with 4 groups and P1 stubs disabled"
```

---

## Task 13: AdminTopbar

**Files:**
- Create: `src/admin/components/AdminTopbar.tsx`

- [ ] **Criar o componente**

```typescript
// src/admin/components/AdminTopbar.tsx
import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const ROUTE_LABELS: Record<string, string> = {
  '/admin':           'Dashboard',
  '/admin/simulados': 'Simulados',
  '/admin/usuarios':  'Usuários',
  '/admin/suporte':   'Suporte',
  '/admin/tentativas':'Tentativas',
  '/admin/analytics': 'Analytics',
  '/admin/marketing': 'Marketing',
  '/admin/produto':   'Produto',
  '/admin/tecnologia':'Tecnologia',
  '/admin/auditoria': 'Auditoria',
}

function getLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
  if (pathname.includes('/simulados/')) return 'Simulados'
  return 'Admin'
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'A'
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const label = getLabel(pathname)

  return (
    <header className="h-12 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground text-xs mx-1.5">·</span>
        <span className="text-xs text-muted-foreground">ENAMED Arena</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          title="Busca global (em breve)"
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors opacity-40 cursor-not-allowed"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          title="Notificações (em breve)"
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors opacity-40 cursor-not-allowed"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center ml-1">
          <span className="text-primary-foreground text-xs font-bold leading-none">
            {getInitials(user?.user_metadata?.full_name ?? user?.email)}
          </span>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Commit**

```bash
git add src/admin/components/AdminTopbar.tsx
git commit -m "feat(admin): add AdminTopbar with route label and avatar"
```

---

## Task 14: Reconstruir AdminApp

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Delete: `src/admin/components/AdminSidebar.tsx` (será removido)

- [ ] **Reescrever AdminApp.tsx**

```typescript
// src/admin/AdminApp.tsx
import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminRail, type RailGroup } from './components/AdminRail'
import { AdminFlyout } from './components/AdminFlyout'
import { AdminTopbar } from './components/AdminTopbar'
import { AdminPeriodProvider } from './contexts/AdminPeriodContext'

export function AdminApp() {
  const [activeGroup, setActiveGroup] = useState<RailGroup | null>(null)

  const handleGroupClick = useCallback((group: RailGroup) => {
    setActiveGroup(prev => (prev === group ? null : group))
  }, [])

  const handleFlyoutClose = useCallback(() => {
    setActiveGroup(null)
  }, [])

  return (
    <AdminPeriodProvider>
      <div className="flex min-h-screen bg-background">
        <AdminRail activeGroup={activeGroup} onGroupClick={handleGroupClick} />
        <AdminFlyout activeGroup={activeGroup} onClose={handleFlyoutClose} />
        <div className="flex flex-col flex-1 min-w-0">
          <AdminTopbar />
          <main className="flex-1 p-5 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminPeriodProvider>
  )
}
```

- [ ] **Deletar o arquivo legado**

```bash
rm "C:\Users\Felipe Souza\Documents\enamed-arena\src\admin\components\AdminSidebar.tsx"
```

- [ ] **Commit**

```bash
git add src/admin/AdminApp.tsx
git rm src/admin/components/AdminSidebar.tsx
git commit -m "feat(admin): rebuild AdminApp shell with rail+flyout navigation"
```

---

## Task 15: Stubs dos módulos futuros

**Files:**
- Create: `src/admin/pages/stubs/AdminUsuarios.tsx`
- Create: `src/admin/pages/stubs/AdminSupporte.tsx`
- Create: `src/admin/pages/stubs/AdminTentativas.tsx`
- Create: `src/admin/pages/stubs/AdminAnalytics.tsx`
- Create: `src/admin/pages/stubs/AdminMarketing.tsx`
- Create: `src/admin/pages/stubs/AdminProduto.tsx`
- Create: `src/admin/pages/stubs/AdminTecnologia.tsx`
- Create: `src/admin/pages/stubs/AdminAuditoria.tsx`

- [ ] **Criar os 8 arquivos stub**

```typescript
// src/admin/pages/stubs/AdminUsuarios.tsx
import { Users } from 'lucide-react'
export default function AdminUsuarios() {
  return <AdminStub icon={<Users className="h-12 w-12" />} title="Usuários" phase="P0" />
}
```

```typescript
// src/admin/pages/stubs/AdminSupporte.tsx
import { Headphones } from 'lucide-react'
export default function AdminSupporte() {
  return <AdminStub icon={<Headphones className="h-12 w-12" />} title="Suporte" phase="P0" />
}
```

```typescript
// src/admin/pages/stubs/AdminTentativas.tsx
import { ClipboardList } from 'lucide-react'
export default function AdminTentativas() {
  return <AdminStub icon={<ClipboardList className="h-12 w-12" />} title="Tentativas" phase="P1" />
}
```

```typescript
// src/admin/pages/stubs/AdminAnalytics.tsx
import { BarChart3 } from 'lucide-react'
export default function AdminAnalytics() {
  return <AdminStub icon={<BarChart3 className="h-12 w-12" />} title="Analytics" phase="P1" />
}
```

```typescript
// src/admin/pages/stubs/AdminMarketing.tsx
import { Megaphone } from 'lucide-react'
export default function AdminMarketing() {
  return <AdminStub icon={<Megaphone className="h-12 w-12" />} title="Marketing" phase="P1" />
}
```

```typescript
// src/admin/pages/stubs/AdminProduto.tsx
import { Compass } from 'lucide-react'
export default function AdminProduto() {
  return <AdminStub icon={<Compass className="h-12 w-12" />} title="Produto" phase="P1" />
}
```

```typescript
// src/admin/pages/stubs/AdminTecnologia.tsx
import { Monitor } from 'lucide-react'
export default function AdminTecnologia() {
  return <AdminStub icon={<Monitor className="h-12 w-12" />} title="Tecnologia" phase="P1" />
}
```

```typescript
// src/admin/pages/stubs/AdminAuditoria.tsx
import { Shield } from 'lucide-react'
export default function AdminAuditoria() {
  return <AdminStub icon={<Shield className="h-12 w-12" />} title="Auditoria" phase="P1" />
}
```

> **Nota:** Os 8 arquivos acima referenciam `AdminStub` que não existe ainda. Criar o componente helper inline — coloque-o em cada arquivo ou extraia para um arquivo compartilhado. A versão mais simples é incluir o helper em cada arquivo:

```typescript
// Adicionar no topo de CADA stub, antes do export default:
function AdminStub({ icon, title, phase }: { icon: React.ReactNode; title: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
      <div className="text-muted-foreground/20">{icon}</div>
      <h2 className="text-heading-2 text-foreground">{title}</h2>
      <p className="text-body text-muted-foreground">Em construção — Fase {phase}</p>
    </div>
  )
}
```

> Ou, para evitar repetição, criar `src/admin/pages/stubs/_AdminStub.tsx` com o componente exportado e importar nos 8 arquivos.

- [ ] **Commit**

```bash
git add src/admin/pages/stubs/
git commit -m "feat(admin): add 8 module stubs for future P0/P1 implementation"
```

---

## Task 16: Rotas em App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Adicionar lazy imports no topo (junto aos outros imports lazy de admin)**

```typescript
// Adicionar após a linha do AdminUploadQuestions lazy import:
const AdminUsuarios    = lazy(() => import('./admin/pages/stubs/AdminUsuarios'))
const AdminSupporte    = lazy(() => import('./admin/pages/stubs/AdminSupporte'))
const AdminTentativas  = lazy(() => import('./admin/pages/stubs/AdminTentativas'))
const AdminAnalytics   = lazy(() => import('./admin/pages/stubs/AdminAnalytics'))
const AdminMarketing   = lazy(() => import('./admin/pages/stubs/AdminMarketing'))
const AdminProduto     = lazy(() => import('./admin/pages/stubs/AdminProduto'))
const AdminTecnologia  = lazy(() => import('./admin/pages/stubs/AdminTecnologia'))
const AdminAuditoria   = lazy(() => import('./admin/pages/stubs/AdminAuditoria'))
```

- [ ] **Adicionar as rotas no bloco `/admin` (após a rota `simulados/:id/questoes` existente)**

```typescript
// Dentro do bloco <Route element={<Suspense ...><AdminApp /></Suspense>}>
// Adicionar após a rota de questoes:
<Route path="usuarios"   element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarios /></Suspense>} />
<Route path="suporte"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSupporte /></Suspense>} />
<Route path="tentativas" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTentativas /></Suspense>} />
<Route path="analytics"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAnalytics /></Suspense>} />
<Route path="marketing"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminMarketing /></Suspense>} />
<Route path="produto"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminProduto /></Suspense>} />
<Route path="tecnologia" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTecnologia /></Suspense>} />
<Route path="auditoria"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAuditoria /></Suspense>} />
```

- [ ] **Confirmar build compila sem erros**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript ou bundle.

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat(admin): register 8 new module routes in App.tsx"
```

---

## Task 17: Reconstruir AdminDashboard

**Files:**
- Modify: `src/admin/pages/AdminDashboard.tsx`

- [ ] **Reescrever AdminDashboard.tsx**

```typescript
// src/admin/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom'
import { useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import {
  useAdminDashboardKpis,
  useAdminEventsTimeseries,
  useAdminFunnelStats,
  useAdminSimuladoEngagement,
  useAdminLiveSignals,
} from '@/admin/hooks/useAdminDashboard'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminFunnelChart } from '@/admin/components/ui/AdminFunnelChart'
import { AdminLivePanel } from '@/admin/components/ui/AdminLivePanel'
import { AdminDataTable } from '@/admin/components/ui/AdminDataTable'
import type { AdminPeriod, SimuladoEngagementRow } from '@/admin/types'

const PERIOD_OPTIONS: { label: string; value: AdminPeriod }[] = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

function delta(current: number, prev: number): number {
  return Math.round((current - prev) * 10) / 10
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function AdminDashboard() {
  const { period, setPeriod } = useAdminPeriod()

  const kpis      = useAdminDashboardKpis(period)
  const timeseries = useAdminEventsTimeseries(period)
  const funnel    = useAdminFunnelStats(period)
  const engagement = useAdminSimuladoEngagement(8)
  const live      = useAdminLiveSignals()

  const k = kpis.data

  const engagementColumns = [
    { key: 'title',            label: 'Simulado',     width: '2fr',  render: (r: SimuladoEngagementRow) => `#${r.sequence_number} — ${r.title}` },
    { key: 'participants',     label: 'Participantes', width: '90px' },
    { key: 'completion_rate',  label: 'Conclusão',     width: '90px', render: (r: SimuladoEngagementRow) => formatPct(r.completion_rate) },
    { key: 'avg_score',        label: 'Média',         width: '80px', render: (r: SimuladoEngagementRow) => formatPct(r.avg_score) },
    { key: 'abandonment_rate', label: 'Abandono',      width: '80px', render: (r: SimuladoEngagementRow) => formatPct(r.abandonment_rate) },
  ] as const

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* Page header + period selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Dashboard</h1>
          <p className="text-caption text-muted-foreground">Central de comando · ENAMED Arena</p>
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEÇÃO 1: Visão Executiva ── */}
      <section>
        <AdminSectionHeader title="Visão Executiva" hook="useAdminDashboardKpis" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <AdminStatCard
            label="Usuários totais"
            value={k?.total_users.toLocaleString('pt-BR') ?? 0}
            delta={k ? delta(k.new_users, k.new_users_prev) : undefined}
            deltaLabel="novos vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Novos usuários"
            value={k?.new_users ?? 0}
            delta={k ? delta(k.new_users, k.new_users_prev) : undefined}
            deltaLabel="vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Taxa de conclusão"
            value={k ? formatPct(k.completion_rate) : '—'}
            delta={k ? delta(k.completion_rate, k.completion_rate_prev) : undefined}
            deltaLabel="pp vs período ant."
            accentBorder={k ? k.completion_rate < k.completion_rate_prev : false}
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Média de nota"
            value={k ? formatPct(k.avg_score) : '—'}
            delta={k ? delta(k.avg_score, k.avg_score_prev) : undefined}
            deltaLabel="pp vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Taxa de ativação"
            value={k ? formatPct(k.activation_rate) : '—'}
            delta={k ? delta(k.activation_rate, k.activation_rate_prev) : undefined}
            deltaLabel="pp vs período ant."
            isLoading={kpis.isLoading}
          />
        </div>
        {kpis.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro ao carregar KPIs.{' '}
            <button className="underline" onClick={() => kpis.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

      {/* ── SEÇÃO 2: Tendências + Sinais ao vivo ── */}
      <section>
        <AdminSectionHeader title="Tendências" hook="useAdminEventsTimeseries" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_200px] gap-3">
          <AdminTrendChart
            title="Novos cadastros / dia"
            data={timeseries.data ?? []}
            xKey="day"
            bars={[{ key: 'new_users', color: 'hsl(345 65% 42%)', label: 'Cadastros' }]}
            isLoading={timeseries.isLoading}
          />
          <AdminTrendChart
            title="Simulados iniciados vs concluídos"
            data={timeseries.data ?? []}
            xKey="day"
            bars={[
              { key: 'exams_started',   color: 'hsl(345 65% 42%)', label: 'Iniciados' },
              { key: 'exams_completed', color: 'hsl(142 40% 35%)', label: 'Concluídos' },
            ]}
            isLoading={timeseries.isLoading}
          />
          <AdminLivePanel data={live.data} isLoading={live.isLoading} />
        </div>
        {timeseries.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro nos gráficos.{' '}
            <button className="underline" onClick={() => timeseries.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

      {/* ── SEÇÃO 3: Funil de Jornada ── */}
      <section>
        <AdminSectionHeader title="Funil de Jornada" hook="useAdminFunnelStats" />
        <AdminFunnelChart steps={funnel.data ?? []} isLoading={funnel.isLoading} />
        {funnel.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro no funil.{' '}
            <button className="underline" onClick={() => funnel.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

      {/* ── SEÇÃO 4: Simulados — Engajamento ── */}
      <section>
        <AdminSectionHeader title="Simulados — Engajamento" hook="useAdminSimuladoEngagement" />
        <AdminDataTable
          columns={engagementColumns as any}
          data={(engagement.data ?? []) as any}
          compact
          isLoading={engagement.isLoading}
          emptyMessage="Nenhum simulado encontrado."
          footer={
            <Link to="/admin/simulados" className="text-primary hover:underline text-[11px]">
              → Ver todos os simulados
            </Link>
          }
        />
        {engagement.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro ao carregar simulados.{' '}
            <button className="underline" onClick={() => engagement.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

    </div>
  )
}
```

- [ ] **Confirmar build compila sem erros**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sem erros de TypeScript.

- [ ] **Commit**

```bash
git add src/admin/pages/AdminDashboard.tsx
git commit -m "feat(admin): rebuild AdminDashboard with 4 sections and real data"
```

---

## Task 18: Smoke test final + build

- [ ] **Rodar todos os testes**

```bash
npm run test -- --run
```

Esperado: testes existentes passando + novos `AdminStatCard` e `AdminFunnelChart` passando. Se algum teste quebrar por mudança no shell, investigar e corrigir antes de continuar.

- [ ] **Confirmar build de produção limpo**

```bash
npm run build
```

Esperado: Build completado sem erros.

- [ ] **Lint**

```bash
npm run lint 2>&1 | grep -E "error|Error" | head -20
```

Esperado: nenhum erro de lint (warnings são aceitáveis).

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat(admin): complete Phase 1 — shell rebuild + executive dashboard

- Rail + flyout navigation with 4 semantic groups
- AdminPeriodContext (7/30/90d, persisted in sessionStorage)
- 5 analytics RPCs: admin_dashboard_kpis, admin_events_timeseries,
  admin_funnel_stats, admin_simulado_engagement, admin_live_signals
- 6 shared components: AdminStatCard, AdminTrendChart, AdminFunnelChart,
  AdminLivePanel, AdminDataTable, AdminSectionHeader
- Dashboard with real data: KPIs, trend charts, cohort funnel, simulado engagement
- 8 module stubs scaffolded for P0/P1 phases
- All existing simulados CRUD routes preserved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Checklist de auto-revisão

Spec vs plano:
- ✅ Shell (rail + flyout + topbar) — Tasks 11, 12, 13, 14
- ✅ AdminPeriodContext — Task 4
- ✅ 5 RPCs analytics — Task 2
- ✅ adminApi 5 métodos — Task 3
- ✅ React Query hooks — Task 5
- ✅ AdminStatCard + testes — Task 6
- ✅ AdminSectionHeader — Task 7
- ✅ AdminTrendChart — Task 8
- ✅ AdminFunnelChart + testes — Task 9
- ✅ AdminLivePanel — Task 10
- ✅ AdminDataTable — Task 10
- ✅ 8 stubs — Task 15
- ✅ Rotas App.tsx — Task 16
- ✅ AdminDashboard reescrito — Task 17
- ✅ Tipos — Task 1
- ✅ Loading states por seção — no AdminDashboard (isLoading por hook)
- ✅ Error states com refetch — no AdminDashboard
- ✅ Empty states — AdminDataTable tem `emptyMessage`, AdminFunnelChart recebe `[]` graciosamente
- ✅ `attempt_status` correto (`submitted | expired`, não `completed`) — usado no SQL da Task 2
