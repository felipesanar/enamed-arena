# Results Release Gate — Design Spec

## Overview

In no place, under no circumstance, should a student see their result or performance data before the simulado's `results_release_at` timestamp. This spec defines the complete gate: database read layer + frontend behavior across every surface where results appear.

**Root cause:** The two performance read RPCs (`get_user_performance_summary`, `get_user_performance_history`) query pre-aggregated tables populated at submission time — before results are released. All other pages already protect correctly via `canViewResults(simulado.status)`.

---

## Scope

**Needs fixing:**
1. DB read RPCs for performance data
2. `HomePagePremium` — stats fallback, `worstArea`, and missing `closed_waiting` UX state

**Already correct (no changes):**
- `ResultadoPage`, `CorrecaoPage`, `DesempenhoPage`, `ComparativoPage`, `SimuladoDetailPage` — all use `canViewResults(status)` which derives from `results_release_at` via `deriveSimuladoStatus()`
- `RankingPage` — filters via `fetchSimuladosWithResults()` with `.lte('results_release_at', nowIso)` in the DB query
- `SimuladoCard` — only shows score when `status === 'completed'`
- `ExamCompletedScreen` — shows release date, never score

---

## DB Architecture (existing — do not change)

```
finalize_attempt_with_results()
  → writes score to attempts
  → inserts into user_performance_history (materialized table)
  → calls recalculate_user_performance()
      → aggregates user_performance_history → writes to user_performance_summary (materialized table)

get_user_performance_summary()   ← currently reads user_performance_summary directly (BUG)
get_user_performance_history()   ← currently reads user_performance_history directly (BUG)
```

The write path (`recalculate_user_performance`, `user_performance_summary` table) is **not changed**. Only the read RPCs are rewritten.

---

## Section 1 — Database Fix

### `get_user_performance_history` (rewritten)

Add `JOIN public.simulados s ON s.id = uph.simulado_id` with filter `s.results_release_at <= now()`.

**New behavior:** Only returns rows for simulados whose results have been officially released at query time. As `results_release_at` passes, results automatically become visible on the next query — no re-aggregation needed.

```sql
CREATE OR REPLACE FUNCTION public.get_user_performance_history(
  p_user_id uuid DEFAULT auth.uid(),
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  attempt_id uuid,
  simulado_id uuid,
  score_percentage numeric,
  total_correct integer,
  total_answered integer,
  total_questions integer,
  finished_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    uph.attempt_id,
    uph.simulado_id,
    uph.score_percentage,
    uph.total_correct,
    uph.total_answered,
    uph.total_questions,
    uph.finished_at
  FROM public.user_performance_history uph
  JOIN public.simulados s ON s.id = uph.simulado_id
  WHERE uph.user_id = p_user_id
    AND p_user_id = auth.uid()
    AND s.results_release_at <= now()
  ORDER BY uph.finished_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
$$;
```

### `get_user_performance_summary` (rewritten)

Bypasses the pre-aggregated `user_performance_summary` table for client reads. Computes live from `user_performance_history JOIN simulados WHERE results_release_at <= now()`.

**Why bypass the summary table:** The summary table is written at submission time and bakes in unreleased scores. Re-computing live from history is correct because history rows are already immutable and the JOIN is cheap (bounded by number of simulados per user, typically < 10).

```sql
CREATE OR REPLACE FUNCTION public.get_user_performance_summary(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  user_id uuid,
  total_attempts integer,
  avg_score numeric,
  best_score numeric,
  last_score numeric,
  last_simulado_id uuid,
  last_finished_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH released AS (
    SELECT
      uph.user_id,
      uph.simulado_id,
      uph.score_percentage,
      uph.finished_at
    FROM public.user_performance_history uph
    JOIN public.simulados s ON s.id = uph.simulado_id
    WHERE uph.user_id = p_user_id
      AND p_user_id = auth.uid()
      AND s.results_release_at <= now()
  ),
  last_released AS (
    SELECT simulado_id, score_percentage, finished_at
    FROM released
    ORDER BY finished_at DESC
    LIMIT 1
  )
  SELECT
    p_user_id                                            AS user_id,
    COUNT(*)::integer                                    AS total_attempts,
    COALESCE(ROUND(AVG(r.score_percentage), 2), 0)      AS avg_score,
    COALESCE(MAX(r.score_percentage), 0)                 AS best_score,
    COALESCE(lr.score_percentage, 0)                     AS last_score,
    lr.simulado_id                                       AS last_simulado_id,
    lr.finished_at                                       AS last_finished_at
  FROM released r
  LEFT JOIN last_released lr ON true
  GROUP BY lr.simulado_id, lr.score_percentage, lr.finished_at
$$;
```

**Note:** When the user has no released results, this RPC returns 0 rows (not a row with zeros). The frontend already handles `summary === null` correctly.

---

## Section 2 — Frontend: `HomePagePremium`

### 2.1 Detect `closed_waiting` simulado

Add a single `useMemo` to detect if a student has a finished simulado whose results are not yet released:

```typescript
const pendingSimulado = useMemo(
  () =>
    simulados
      .filter(s => s.status === 'closed_waiting' && s.userState?.finished)
      .sort((a, b) => Date.parse(b.executionWindowEnd) - Date.parse(a.executionWindowEnd))[0] ?? null,
  [simulados],
);
```

### 2.2 Fix stats fallback

The `stats` fallback (used when `summary` is null) currently counts all finished simulados, including `closed_waiting`. Fix:

```typescript
// Before (bug):
const completed = simulados.filter(s => s.userState?.finished);

// After:
const completed = simulados.filter(s => canViewResults(s.status));
```

### 2.3 `worstArea` — already auto-fixed by DB change

`worstArea` derives from `lastSimuladoId = summary?.last_simulado_id`. After the RPC fix, `last_simulado_id` is the last **released** simulado — so `worstArea` becomes correct automatically.

### 2.4 `lastScore` and `recentScores` — already auto-fixed by DB change

Both derive from `history` returned by `get_user_performance_history`. After the RPC fix, history only contains released simulados.

### 2.5 UX state machine for the Hero

```
pendingSimulado === null → normal hero (stats from released simulados)

pendingSimulado !== null AND history.length === 0
  → Hero shows:
      Title: "Resultado em breve"
      Body: "Disponível em [formatDateTime(pendingSimulado.resultsReleaseAt)]"
      Icon: Clock
      Score/sparkline cards: hidden

pendingSimulado !== null AND history.length > 0
  → Hero shows stats from released simulados normally
  → Subtle alert below hero:
      "Resultado do [pendingSimulado.title] disponível em [formatDateTime(pendingSimulado.resultsReleaseAt)]"
      Icon: Clock, variant: muted/info
```

### 2.6 `resultsReleaseAt` field

`SimuladoConfig` currently has `resultsReleaseAt: string`. It must be available on `SimuladoWithStatus` (it is — spread from config). Use it directly in the pending state UI.

---

## Section 3 — Complete Platform Behavior Reference

| Surface | Status when closed_waiting | Behavior |
|---------|---------------------------|----------|
| ResultadoPage | Redirects | `canViewResults()` → false → redirect (existing) |
| CorrecaoPage | Redirects | Same (existing) |
| DesempenhoPage | Empty state | "Nenhum resultado disponível" (existing) |
| ComparativoPage | Filtered out | `closed_waiting` simulado invisible (existing) |
| RankingPage | Not in selector | DB query `results_release_at <= now()` (existing) |
| SimuladoDetailPage | No score badge | `canViewResults()` → false → no badge (existing) |
| SimuladoCard | Status "Encerrado" | Score badge hidden — `status !== 'completed'` (existing) |
| ExamCompletedScreen | Release date shown | Prop `resultsAvailable=false` (existing) |
| HomePagePremium hero | "Resultado em breve" or pending tag | **NEW — this spec** |
| HomePagePremium stats | Only released simulados | **Fixed via DB RPC** |
| HomePagePremium sparkline | Only released scores | **Fixed via DB RPC** |
| HomePagePremium worstArea | Only from last released | **Fixed via DB RPC** |

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_gate_performance_by_release.sql` | Rewrite `get_user_performance_history` and `get_user_performance_summary` with `results_release_at <= now()` filter |
| `src/components/premium/home/HomePagePremium.tsx` | Add `pendingSimulado` detection, fix `stats` fallback, add pending UX states |

No other files require changes.

---

## Security Properties After Fix

| Invariant | Mechanism |
|-----------|-----------|
| Score never readable before release via performance RPCs | `results_release_at <= now()` JOIN in both read RPCs |
| Score never readable before release via result pages | `canViewResults(status)` in each page (existing) |
| Score never readable before release via ranking | `results_release_at <= now()` in `fetchSimuladosWithResults()` (existing) |
| `is_within_window` never client-writable | SECURITY DEFINER RPCs (existing) |
| Client cannot fake `results_release_at` | Column not updatable by authenticated role (RLS) |

---

## Out of Scope

- Push notifications when `results_release_at` arrives (separate feature)
- Auto-refresh of home page when results are released during active session (current: stale until page reload, acceptable for v1)
- Admin ability to preview results before release (separate admin feature)
