# Admin P1-A — Design Spec
## Tentativas · Analytics · Marketing · Produto

**Date:** 2026-04-05
**Status:** Approved — ready for implementation

---

## Goal

Implement four admin modules (P1-A) that replace the current stubs at `/admin/tentativas`, `/admin/analytics`, `/admin/marketing`, `/admin/produto`. All four are read-heavy observation dashboards; Tentativas additionally has write actions.

---

## Context & Constraints

- **Stack:** React 18 + TypeScript + TanStack Query 5 + Supabase SECURITY DEFINER RPCs
- **Auth guard:** Every RPC starts with `if not exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin') then raise exception 'unauthorized'`
- **Existing infra:**
  - `analytics_events (id, user_id, event_name, payload jsonb, created_at)` — event log
  - `log_analytics_event(event_name, payload)` — client-callable RPC
  - `profiles`, `onboarding_profiles`, `attempts`, `user_performance_history`, `simulados` — core tables
  - `attempt_status` enum: `in_progress | submitted | expired | offline_pending`
  - `attempts.finished_at` — used for time calculations
- **UTM tracking** currently not implemented. `setSuperProperties` in `main.tsx` only sets `session_id`, `platform`, `app_version`. UTM capture must be added to `main.tsx` as part of this work.

---

## 1. UTM Capture (prerequisite for Marketing)

### Where: `src/main.tsx`

On each app load, read UTM params from the URL and persist them to `localStorage` so they survive page navigations (e.g., social → landing → login → signup).

**Logic:**
```typescript
// read on load; only write if present (don't overwrite with empty)
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const params = new URLSearchParams(window.location.search)
const utmFromUrl: Record<string, string> = {}
for (const k of UTM_KEYS) {
  const v = params.get(k)
  if (v) utmFromUrl[k] = v
}
if (Object.keys(utmFromUrl).length > 0) {
  localStorage.setItem('_ea_utm', JSON.stringify(utmFromUrl))
}
const storedUtm = JSON.parse(localStorage.getItem('_ea_utm') ?? '{}')
setSuperProperties(storedUtm)   // all subsequent events carry UTM in payload
```

This is called **before** `registerAnalyticsHandler`, so every event sent after will include UTM keys in the payload.

---

## 2. Module: Tentativas (`/admin/tentativas`)

### UI (approved mockup)

- **4 KPI cards:** Total · Em andamento · Concluídas · Expiradas
- **Toolbar:** search input (debounced 300ms, matches user name or email) · simulado dropdown · status pills (Todos / Em andamento / Concluído / Expirado) · period dropdown (7d / 30d / 90d / Todos)
- **Table columns:** Usuário (avatar + name + email) | Simulado | Início | Status | Nota | Posição | Actions
- **Actions per row:**
  - 👁 Ver detalhes — navigates to `/admin/usuarios/:id` (already implemented)
  - ✕ Cancelar — only for `in_progress`; confirmation dialog; calls `admin_cancel_attempt`
  - 🗑 Excluir — confirmation dialog; calls `admin_delete_attempt`; toast on success
- **Pagination:** 25 per page, same pattern as AdminUsuarios
- **Status badge colors:** `submitted` = green, `in_progress` = blue, `expired` = yellow, `offline_pending` = grey

### New Types (`src/admin/types.ts`)

```typescript
export interface AttemptListKpis {
  total: number
  in_progress: number
  submitted: number
  expired: number
}

export interface AttemptListRow {
  attempt_id: string
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  simulado_id: string
  sequence_number: number
  simulado_title: string
  created_at: string
  status: string
  score_percentage: number | null
  ranking_position: number | null
  total_count: number
}
```

### New SQL Migration: `20260405240000_admin_p1a_tentativas_rpcs.sql`

Four RPCs:

**`admin_attempts_kpis(p_days int)`** → `AttemptListKpis`
Counts total/in_progress/submitted/expired for attempts where `created_at >= now() - p_days days` (if p_days = 0, no filter).

**`admin_list_attempts(p_search text, p_simulado_id uuid, p_status text, p_days int, p_limit int, p_offset int)`** → `AttemptListRow[]`
JOIN attempts → profiles → simulados. Filters: ILIKE on name/email, simulado_id exact match, status exact match, date range. Returns total_count for pagination.

**`admin_cancel_attempt(p_attempt_id uuid)`** → void
Sets `status = 'expired'`, `finished_at = now()` on the attempt. Only applies when current status is `in_progress`. Raises exception if not in_progress.

**`admin_delete_attempt(p_attempt_id uuid)`** → void
Deletes `answers` for this attempt, then `attempt_question_results`, then `attempts` row itself. This allows the user to re-attempt the simulado (bypasses the one-attempt-per-simulado guard).

### New API Methods (`src/admin/services/adminApi.ts`)

```typescript
getAttemptKpis(days: number): Promise<AttemptListKpis>
listAttempts(search, simuladoId, status, days, limit, offset): Promise<AttemptListRow[]>
cancelAttempt(attemptId: string): Promise<void>
deleteAttempt(attemptId: string): Promise<void>
```

### New Hooks (`src/admin/hooks/useAdminTentativas.ts`)

```typescript
useAdminAttemptKpis(days: AdminPeriod | 0): TanStack query
useAdminAttemptList(search, simuladoId, status, days, page): TanStack query, key includes all params
useAdminCancelAttempt(): mutation with onSuccess → invalidate attempt list + kpis
useAdminDeleteAttempt(): mutation with onSuccess → invalidate attempt list + kpis
```

### New Page: `src/admin/pages/AdminTentativas.tsx`

Replaces stub. App.tsx import updated: `lazy(() => import('./admin/pages/AdminTentativas'))`.

### Tests: `src/admin/__tests__/AdminTentativas.test.tsx`

- renders 4 KPI values
- renders table rows with status badges
- cancel button only shown for in_progress rows
- delete button shows confirmation dialog
- search input debounces correctly (mock `useAdminAttemptList`)

---

## 3. Module: Analytics (`/admin/analytics`)

### UI (approved mockup)

- **Period pills:** 7d / 30d / 90d + segment dropdown (Todos / Guest / Standard / PRO)
- **Funnel de 6 etapas:** Visitou landing → Cadastrou-se → Concluiu onboarding → Iniciou prova → Submeteu prova → Retornou (2+ provas). Each step shows count + % of previous step. Color: green ≥70%, yellow 50–70%, red <50%.
- **Weekly bar chart:** new_users vs. first_exams per week (last 8 weeks, using 7-day buckets)
- **Split row:**
  - Left card: Origem UTM — utm_source breakdown with bar + conv. rate to cadastro
  - Right card: Tempo médio por etapa — 4 key median times

### New Types (`src/admin/types.ts`)

```typescript
// Note: admin_analytics_funnel reuses the existing FunnelStep interface (step_order, step_label, user_count, conversion_from_prev) — no new type needed.

export interface JourneyTimeseriesRow {
  week_start: string   // ISO date
  new_users: number
  first_exams: number
}

export interface JourneySourceRow {
  utm_source: string   // 'organic' if null/empty
  user_count: number
  signup_conv_rate: number   // % of visits that signed up (approximated)
}

export interface JourneyTimeToConvert {
  landing_to_signup_min: number
  signup_to_onboarding_min: number
  onboarding_to_first_exam_days: number
  first_to_second_exam_days: number
}
```

### New SQL Migration: `20260405250000_admin_p1a_analytics_rpcs.sql`

**`admin_analytics_funnel(p_days int)`** → `JourneyFunnelStep[]`

6 steps:
1. Visitou landing — `count(distinct user_id) from analytics_events where event_name = 'landing_page_viewed'` in period
2. Cadastrou-se — `count(*) from profiles` in period  
3. Concluiu onboarding — `count(distinct user_id) from onboarding_profiles where completed_at is not null` in period
4. Iniciou prova — `count(distinct user_id) from attempts` in period
5. Submeteu prova — `count(distinct user_id) from attempts where status = 'submitted'` in period
6. Retornou (2+) — `count(distinct user_id) from (select user_id from attempts group by user_id having count(*) >= 2)` in period

Note: Steps 1–6 are **independent counts** in the period, not a cohort. Conversion is step_n / step_{n-1}.

**`admin_analytics_timeseries(p_days int)`** → `JourneyTimeseriesRow[]`

Groups by 7-day buckets: `date_trunc('week', created_at)`. Returns week_start, new_users (from profiles), first_exams (from attempts where this is the user's first attempt). Last 8 weeks if p_days >= 56; otherwise p_days / 7 buckets.

**`admin_analytics_sources(p_days int)`** → `JourneySourceRow[]`

Groups `analytics_events.payload->>'utm_source'` for `signup_completed` events. Counts distinct user_id per source. Source = coalesce(payload->>'utm_source', 'organic'). Returns top 6 ordered by count desc.

**`admin_analytics_time_to_convert(p_days int)`** → single row as `JourneyTimeToConvert`

- `landing_to_signup`: median minutes between earliest `landing_page_viewed` and `profiles.created_at` for users created in period
- `signup_to_onboarding`: median minutes between `profiles.created_at` and `onboarding_profiles.completed_at` for completions in period
- `onboarding_to_first_exam`: median days between `onboarding_profiles.completed_at` and first `attempts.created_at` for attempts in period
- `first_to_second_exam`: median days between 1st and 2nd attempt `created_at` for users with 2+ attempts in period

### New API Methods (`src/admin/services/adminApi.ts`)

```typescript
getAnalyticsFunnel(days: number): Promise<JourneyFunnelStep[]>
getAnalyticsTimeseries(days: number): Promise<JourneyTimeseriesRow[]>
getAnalyticsSources(days: number): Promise<JourneySourceRow[]>
getAnalyticsTimeToConvert(days: number): Promise<JourneyTimeToConvert>
```

### New Hooks (`src/admin/hooks/useAdminAnalytics.ts`)

```typescript
useAdminAnalyticsFunnel(days): query   // returns FunnelStep[]
useAdminAnalyticsTimeseries(days): query
useAdminAnalyticsSources(days): query
useAdminAnalyticsTimeToConvert(days): query
```

### New Page: `src/admin/pages/AdminAnalytics.tsx`

Replaces stub. App.tsx import updated to `lazy(() => import('./admin/pages/AdminAnalytics'))`.

### Tests: `src/admin/__tests__/AdminAnalytics.test.tsx`

- renders 6 funnel steps with labels
- conversion badge red when <50%
- weekly bar chart renders (by checking rendered step counts)
- period pill selection updates query params

---

## 4. Module: Marketing (`/admin/marketing`)

### UI (approved mockup)

- **Period pills + warning:** "⚠ UTM capturado a partir de [first_utm_date]"
- **4 KPI cards:** Novos usuários · Conv. landing→cadastro · Campanhas ativas · % orgânico
- **Source + Medium cards** (side by side): bar rows with user count + conv. rate. Conv. rate is green ≥40%, yellow 20–40%, red <20%.
- **Campaign table** (`utm_campaign`): Campanha | Canal (utm_source badge) | Visitas | Cadastros | Conv. | 1ª prova
- **Export button** on campaign table: downloads table as CSV (client-side Blob, pt-BR headers)

### New Types (`src/admin/types.ts`)

```typescript
export interface MarketingKpis {
  new_users: number
  new_users_prev: number
  landing_to_signup_rate: number   // 0-100
  active_campaigns: number
  organic_pct: number              // 0-100
}

export interface MarketingSourceRow {
  source: string          // utm_source or 'organic'
  user_count: number
  conv_rate: number       // % of signups that started a first exam
}

export interface MarketingMediumRow {
  medium: string          // utm_medium or '(nenhum)'
  user_count: number
  conv_rate: number
}

export interface MarketingCampaignRow {
  campaign: string        // utm_campaign or '(sem campanha)'
  source: string
  visits: number          // landing_page_viewed events with this campaign
  signups: number         // profiles created with this campaign in payload
  conv_rate: number       // signups / visits * 100
  first_exams: number     // attempts.created_at for users whose first analytics_event had this campaign
}
```

### New SQL Migration: `20260405260000_admin_p1a_marketing_rpcs.sql`

**`admin_marketing_kpis(p_days int)`** → `MarketingKpis`

- `new_users`: count from profiles in period
- `new_users_prev`: count from profiles in prev period
- `landing_to_signup_rate`: count(distinct signup user_id in period) / count(distinct landing_page_viewed user_id in period) * 100
- `active_campaigns`: count(distinct payload->>'utm_campaign') from analytics_events where payload->>'utm_campaign' is not null and created_at in period
- `organic_pct`: count of signups with no utm_source / total signups * 100

**`admin_marketing_sources(p_days int)`** → `MarketingSourceRow[]`

Groups profiles created in period by `coalesce(first_utm.utm_source, 'organic')` where `first_utm` is the earliest analytics_events record for that user_id that has `payload->>'utm_source' is not null`. Returns top 8 ordered by user_count desc.

**`admin_marketing_mediums(p_days int)`** → `MarketingMediumRow[]`

Same logic but for `utm_medium`, label `'(nenhum)'` when null.

**`admin_marketing_campaigns(p_days int)`** → `MarketingCampaignRow[]`

- `visits`: count of `landing_page_viewed` events in period grouped by `coalesce(payload->>'utm_campaign', '(sem campanha)')` and `coalesce(payload->>'utm_source', 'organic')`
- `signups`: profiles created in period where earliest analytics_event had matching campaign
- `first_exams`: attempts created by users who arrived via this campaign
- Returns top 20 by signups desc

### New API Methods & Hooks

Same pattern as previous modules:

```typescript
// adminApi.ts
getMarketingKpis(days): Promise<MarketingKpis>
getMarketingSources(days): Promise<MarketingSourceRow[]>
getMarketingMediums(days): Promise<MarketingMediumRow[]>
getMarketingCampaigns(days): Promise<MarketingCampaignRow[]>

// useAdminMarketing.ts hooks
useAdminMarketingKpis(days)
useAdminMarketingSources(days)
useAdminMarketingMediums(days)
useAdminMarketingCampaigns(days)
```

### New Page: `src/admin/pages/AdminMarketing.tsx`

Export CSV function:

```typescript
function exportCampaignsCsv(rows: MarketingCampaignRow[]) {
  const header = 'Campanha,Canal,Visitas,Cadastros,Conversão (%),1ª Prova'
  const lines = rows.map(r =>
    [r.campaign, r.source, r.visits, r.signups, r.conv_rate.toFixed(1), r.first_exams].join(',')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'campanhas.csv'; a.click()
  URL.revokeObjectURL(url)
}
```

App.tsx import updated to `lazy(() => import('./admin/pages/AdminMarketing'))`.

### Tests: `src/admin/__tests__/AdminMarketing.test.tsx`

- renders KPI values
- renders source rows with conv rates
- campaign table shows correct columns
- export button triggers download (mock `URL.createObjectURL`)

---

## 5. Module: Produto (`/admin/produto`)

### UI (approved mockup)

- **Filters:** Period pills + segment pills (Todos / Guest / Standard / PRO)
- **Segmented funnel table:** 4 rows (Cadastrou / Onboarding / 1ª prova / Retornou 2+) × 3 segment columns. Each cell shows count + % with color-coded mini bar.
- **Friction map:** 6 cards (3×2 grid) with colored left border (red = crítico, yellow = atenção, green = saudável). Each card shows: icon, title, event name in monospace, metric value, description, severity badge.
- **Bottom split:**
  - Left: Feature adoption bar chart (6 features with % of active users)
  - Right: Top 6 events with counts

### New Types (`src/admin/types.ts`)

```typescript
export interface SegmentedFunnelRow {
  step_order: number
  step_label: string
  guest_count: number
  guest_pct: number       // % of guest signups in period
  standard_count: number
  standard_pct: number
  pro_count: number
  pro_pct: number
}

export interface FrictionPoint {
  key: string             // unique identifier
  title: string
  event_name: string      // e.g. 'exam_submitted → (none)'
  metric_value: number    // the key metric (%, days, etc.)
  metric_unit: 'percent' | 'days' | 'minutes'
  description: string
  severity: 'critical' | 'warning' | 'healthy'
}

export interface FeatureAdoptionRow {
  feature: string
  event_name: string
  adoption_pct: number    // % of active users (≥1 attempt) who triggered the event
  segment_filter?: string // 'pro' | 'standard' | null
}

export interface TopEventRow {
  event_name: string
  count: number
}
```

### New SQL Migration: `20260405270000_admin_p1a_produto_rpcs.sql`

**`admin_produto_segmented_funnel(p_days int)`** → `SegmentedFunnelRow[]`

For each step (Cadastrou / Onboarding / 1ª prova / Retornou 2+), counts users broken down by `profiles.segment`. Percentages are relative to the signup count for that segment in the period. No segment filter param — always returns all 3 columns; segment pills on the page affect only friction + adoption sections.

**`admin_produto_friction(p_days int, p_segment text default 'all')`** → `FrictionPoint[]`

Returns 6 pre-defined friction metrics (hardcoded keys, computed values):

| key | metric | severity rule |
|-----|--------|--------------|
| `post_exam_churn` | % of users with exactly 1 attempt | critical if >50% |
| `onboarding_dropout` | % of signups who didn't complete onboarding | warning if >20% |
| `onboarding_to_exam_delay` | median days onboarding→first attempt | warning if >2 days |
| `exam_completion` | % of started exams that reached submitted | healthy if >75% |
| `notebook_adoption` | % of PRO users who accessed caderno_erros | warning if <50% |
| `results_engagement` | % of submitted users who viewed resultado | healthy if >60% |

**`admin_produto_feature_adoption(p_days int, p_segment text default 'all')`** → `FeatureAdoptionRow[]`

Base: active users = distinct user_id from attempts in period.
For each feature, counts `count(distinct user_id) from analytics_events where event_name = X` in period, divides by active_users.

Features: desempenho_viewed, ranking_viewed, correction_viewed, caderno_erros_viewed (PRO-only), comparativo_viewed (standard+), resultado_viewed.

**`admin_produto_top_events(p_days int, p_limit int default 10)`** → `TopEventRow[]`

`select event_name, count(*) from analytics_events where created_at >= ... group by event_name order by count desc limit p_limit`

### New API Methods & Hooks

```typescript
// adminApi.ts
getProdutoSegmentedFunnel(days): Promise<SegmentedFunnelRow[]>
getProdutoFriction(days): Promise<FrictionPoint[]>
getProdutoFeatureAdoption(days): Promise<FeatureAdoptionRow[]>
getProdutoTopEvents(days): Promise<TopEventRow[]>

// useAdminProduto.ts hooks
useAdminProdutoSegmentedFunnel(days)           // always returns all 3 segments
useAdminProdutoFriction(days, segment?)        // segment filters the metric population
useAdminProdutoFeatureAdoption(days, segment?) // segment filters active users base
useAdminProdutoTopEvents(days)
```

Page: `src/admin/pages/AdminProduto.tsx`. App.tsx import updated.

### Tests: `src/admin/__tests__/AdminProduto.test.tsx`

- renders 4 funnel rows × 3 segment columns
- critical friction card has red indicator
- feature adoption bars render for each feature
- segment filter pills call hook with correct segment

---

## 6. App.tsx Changes

Four lazy imports need to be updated (from stubs to real pages):

```typescript
// Change from stubs to real pages:
const AdminTentativas = lazy(() => import('./admin/pages/AdminTentativas'))
const AdminAnalytics  = lazy(() => import('./admin/pages/AdminAnalytics'))
const AdminMarketing  = lazy(() => import('./admin/pages/AdminMarketing'))
const AdminProduto    = lazy(() => import('./admin/pages/AdminProduto'))
```

Routes are already registered in App.tsx — no route changes needed.

---

## 7. File Structure

| File | Action |
|------|--------|
| `src/main.tsx` | Modify — add UTM capture before `createRoot` |
| `src/admin/types.ts` | Modify — add 12 new interfaces |
| `src/admin/services/adminApi.ts` | Modify — add 14 new methods |
| `src/admin/hooks/useAdminTentativas.ts` | Create |
| `src/admin/hooks/useAdminAnalytics.ts` | Create |
| `src/admin/hooks/useAdminMarketing.ts` | Create |
| `src/admin/hooks/useAdminProduto.ts` | Create |
| `src/admin/pages/AdminTentativas.tsx` | Create (replaces stub) |
| `src/admin/pages/AdminAnalytics.tsx` | Create (replaces stub) |
| `src/admin/pages/AdminMarketing.tsx` | Create (replaces stub) |
| `src/admin/pages/AdminProduto.tsx` | Create (replaces stub) |
| `src/admin/__tests__/AdminTentativas.test.tsx` | Create |
| `src/admin/__tests__/AdminAnalytics.test.tsx` | Create |
| `src/admin/__tests__/AdminMarketing.test.tsx` | Create |
| `src/admin/__tests__/AdminProduto.test.tsx` | Create |
| `src/App.tsx` | Modify — update 4 lazy imports |
| `supabase/migrations/20260405240000_admin_p1a_tentativas_rpcs.sql` | Create |
| `supabase/migrations/20260405250000_admin_p1a_analytics_rpcs.sql` | Create |
| `supabase/migrations/20260405260000_admin_p1a_marketing_rpcs.sql` | Create |
| `supabase/migrations/20260405270000_admin_p1a_produto_rpcs.sql` | Create |

---

## 8. Out of Scope (P1-B / Future)

- Suporte module (P3 — requires ticket system design)
- Tecnologia + Auditoria modules (P1-B)
- UTM attribution model beyond last-touch (MVP uses first-touch approximation)
- Real-time updates / subscriptions on any P1-A page
- Per-campaign landing page analysis
