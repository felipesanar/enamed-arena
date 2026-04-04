# Results Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent any score or performance data from being visible to students before the simulado's `results_release_at` timestamp across all surfaces.

**Architecture:** Rewrite two DB read RPCs to filter via `JOIN simulados WHERE results_release_at <= now()`, bypassing the pre-aggregated summary table for client reads. Fix `HomePagePremium` stats fallback and hero logic. Fix `deriveHomeHeroState` to not show `awaiting_results` when the student has prior released simulados.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, React 18, Vitest

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260405000000_gate_performance_by_release.sql` | New — rewrite `get_user_performance_history` and `get_user_performance_summary` with `results_release_at <= now()` filter |
| `src/lib/home-hero-state.ts` | Fix `awaiting_results` to only trigger when no released history exists |
| `src/lib/home-hero-state.test.ts` | Add tests for the corrected `awaiting_results` behaviour |
| `src/components/premium/home/HomePagePremium.tsx` | Fix `stats` fallback, add `pendingSimulado`, render pending banner |

---

### Task 1: DB Migration — Gate performance RPCs by `results_release_at`

**Files:**
- Create: `supabase/migrations/20260405000000_gate_performance_by_release.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Gate performance read RPCs by results_release_at
-- Prevents students from seeing scores before official release.
-- The write path (recalculate_user_performance, user_performance_summary table) is unchanged.
-- Only the two read RPCs are rewritten.

-- ─── get_user_performance_history (rewritten) ────────────────────────────────
-- Adds JOIN simulados WHERE results_release_at <= now().
-- Only returns rows for simulados whose results have been officially released.

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

-- ─── get_user_performance_summary (rewritten) ────────────────────────────────
-- Bypasses the pre-aggregated user_performance_summary table for client reads.
-- Computes live from user_performance_history JOIN simulados WHERE results_release_at <= now().
-- When user has no released results this returns 0 rows (not a row with zeros).
-- Frontend already handles summary === null correctly.

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

- [ ] **Step 2: Verify file was created correctly**

Run: `cat supabase/migrations/20260405000000_gate_performance_by_release.sql`
Expected: Full SQL displayed with both `CREATE OR REPLACE FUNCTION` blocks.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260405000000_gate_performance_by_release.sql
git commit -m "fix(db): gate performance RPCs by results_release_at

get_user_performance_history and get_user_performance_summary now JOIN
simulados WHERE results_release_at <= now(), preventing students from
seeing scores before official release. Summary is computed live from
history instead of the pre-aggregated table."
```

---

### Task 2: Fix `deriveHomeHeroState` — `awaiting_results` only when no released history

**Context:** Currently `awaiting_results` triggers for any `closed_waiting` simulado, even if the student has previously released results. Per spec: only show `awaiting_results` as the hero when there is no prior released history; otherwise show stats normally with a pending banner below.

**Files:**
- Modify: `src/lib/home-hero-state.ts`
- Test: `src/lib/home-hero-state.test.ts`

- [ ] **Step 1: Write failing tests first**

Open `src/lib/home-hero-state.test.ts` and add after the existing `"retorna awaiting_results..."` test:

```typescript
it("retorna awaiting_results apenas quando nao ha historico anterior liberado", () => {
  // closed_waiting simulado + no released history → should show awaiting_results
  const state = deriveHomeHeroState({
    userName: "Felipe",
    isOnboardingComplete: true,
    simulados: [
      buildSimulado({
        id: "sim-waiting",
        status: "closed_waiting",
        resultsReleaseAt: "2026-04-08T12:00:00.000Z",
        userState: {
          simuladoId: "sim-waiting",
          started: true,
          finished: true,
          finishedAt: "2026-04-07T10:00:00.000Z",
        },
      }),
    ],
    simuladosRealizados: 0,
    mediaAtual: 0,
    lastScore: null,
    recentScores: [],
  });

  expect(state.scenario).toBe("awaiting_results");
});

it("nao retorna awaiting_results quando ha historico anterior liberado", () => {
  // closed_waiting simulado + previous released history → should NOT show awaiting_results
  const state = deriveHomeHeroState({
    userName: "Felipe",
    isOnboardingComplete: true,
    simulados: [
      buildSimulado({
        id: "sim-waiting",
        status: "closed_waiting",
        resultsReleaseAt: "2026-04-08T12:00:00.000Z",
        userState: {
          simuladoId: "sim-waiting",
          started: true,
          finished: true,
          finishedAt: "2026-04-07T10:00:00.000Z",
        },
      }),
    ],
    simuladosRealizados: 2,
    mediaAtual: 74,
    lastScore: 74,
    recentScores: [68, 74],
  });

  expect(state.scenario).not.toBe("awaiting_results");
  // Falls through to steady_progress since no completed/available/late simulados
  expect(state.scenario).toBe("steady_progress");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- home-hero-state --run`
Expected: The two new tests FAIL (current code has no `hasReleasedHistory` guard).

- [ ] **Step 3: Implement the fix in `src/lib/home-hero-state.ts`**

Find the `waitingResults` block (around line 137) and add a `hasReleasedHistory` guard:

```typescript
  // Before fix (lines ~137-153):
  const waitingResults = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "closed_waiting"),
    (simulado) => simulado.resultsReleaseAt,
  )[0];

  if (waitingResults) {
    const resultsDate = formatDateShort(waitingResults.resultsReleaseAt);
    return {
      scenario: "awaiting_results",
      ...
    };
  }
```

Replace with:

```typescript
  const waitingResults = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "closed_waiting"),
    (simulado) => simulado.resultsReleaseAt,
  )[0];

  // Only show awaiting_results hero if student has no prior released history.
  // If they have history, fall through to show stats normally — a pending
  // banner is rendered separately in HomePagePremium.
  const hasReleasedHistory = simuladosRealizados > 0 || recentScores.length > 0;

  if (waitingResults && !hasReleasedHistory) {
    const resultsDate = formatDateShort(waitingResults.resultsReleaseAt);
    return {
      scenario: "awaiting_results",
      tone: "calm",
      eyebrow: "Aguardando resultado",
      headline: "Sua tentativa já foi enviada",
      description: `Resultado previsto para ${resultsDate}. Enquanto isso, acompanhe seu histórico de evolução.`,
      ctaLabel: "Ver desempenho",
      ctaTo: "/desempenho",
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- home-hero-state --run`
Expected: All tests PASS including the two new ones.

- [ ] **Step 5: Also fix the existing `awaiting_results` test — it will now fail**

The existing test `"retorna awaiting_results quando ha tentativa aguardando liberacao"` passes `simuladosRealizados: 1` and `recentScores: [75]`, which means `hasReleasedHistory` is `true`, so the scenario will no longer return `awaiting_results`. Fix the test to reflect the correct behaviour (no prior history):

```typescript
it("retorna awaiting_results quando ha tentativa aguardando liberacao e sem historico anterior", () => {
  const state = deriveHomeHeroState({
    userName: "Felipe",
    isOnboardingComplete: true,
    simulados: [
      buildSimulado({
        id: "sim-waiting",
        status: "closed_waiting",
        resultsReleaseAt: "2026-04-08T12:00:00.000Z",
      }),
    ],
    simuladosRealizados: 0,   // <-- changed from 1
    mediaAtual: 0,             // <-- changed from 75
    lastScore: null,           // <-- changed from 75
    recentScores: [],          // <-- changed from [75]
  });

  expect(state.scenario).toBe("awaiting_results");
  expect(state.ctaTo).toBe("/desempenho");
  expect(state.description).toContain("Resultado previsto");
});
```

- [ ] **Step 6: Run full test suite**

Run: `npm run test --run`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/home-hero-state.ts src/lib/home-hero-state.test.ts
git commit -m "fix(home-hero): awaiting_results only when no prior released history

When a student has previous released simulados, falling through to show
their stats is more useful than showing an awaiting_results screen.
The pending banner in HomePagePremium (next task) handles the
notification about the unreleased result."
```

---

### Task 3: Fix `HomePagePremium` — stats fallback, pendingSimulado, pending banner

**Files:**
- Modify: `src/components/premium/home/HomePagePremium.tsx`

- [ ] **Step 1: Fix the `stats` fallback — replace `userState?.finished` with `canViewResults`**

In `HomePagePremium.tsx`, line 102–118, the `stats` `useMemo` computes a fallback count using all finished simulados, including `closed_waiting`. Fix it to only count released simulados.

Find:
```typescript
  const stats = useMemo(() => {
    const completed = simulados.filter((s) => s.userState?.finished);
```

Replace with:
```typescript
  const stats = useMemo(() => {
    const completed = simulados.filter((s) => canViewResults(s.status));
```

Also add the import at the top of the file (check if already imported from `simulado-helpers`):

At the top of the file imports, add:
```typescript
import { canViewResults } from "@/lib/simulado-helpers";
```

- [ ] **Step 2: Add `pendingSimulado` detection**

After the `stats` useMemo (around line 118), add:

```typescript
  // Detect most-recent closed_waiting simulado where the student has finished.
  // Used to show a pending banner when they have prior released results.
  const pendingSimulado = useMemo(
    () =>
      simulados
        .filter((s) => s.status === "closed_waiting" && s.userState?.finished)
        .sort(
          (a, b) =>
            Date.parse(b.executionWindowEnd) - Date.parse(a.executionWindowEnd),
        )[0] ?? null,
    [simulados],
  );
```

- [ ] **Step 3: Add `Clock` to lucide-react imports**

Find the existing lucide-react import line (line 2):
```typescript
import { BarChart3, AlertTriangle, CalendarDays, BookOpen, ArrowUpRight, Lock } from "lucide-react";
```

Replace with:
```typescript
import { BarChart3, AlertTriangle, CalendarDays, BookOpen, ArrowUpRight, Lock, Clock } from "lucide-react";
```

- [ ] **Step 4: Render the pending banner below the hero**

In the JSX return (around line 272–274), the hero section currently renders:

```tsx
      {/* Layer 1: Hero premium — full width */}
      <motion.div variants={itemVariants}>
        <HomeHeroSection heroState={heroState} />
      </motion.div>
```

Replace with:

```tsx
      {/* Layer 1: Hero premium — full width */}
      <motion.div variants={itemVariants}>
        <HomeHeroSection heroState={heroState} />
        {pendingSimulado && (recentScores.length > 0 || stats.simuladosRealizados > 0) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-muted bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              Resultado do <strong className="font-medium text-foreground">{pendingSimulado.title}</strong> disponível em{" "}
              {formatDateShort(pendingSimulado.resultsReleaseAt)}
            </span>
          </div>
        )}
      </motion.div>
```

- [ ] **Step 5: Start dev server and verify visually**

Run: `npm run dev`
Expected: Dev server starts at port 8080 without TypeScript errors.

Check:
- Student with only `closed_waiting` (no prior history): hero shows `awaiting_results` scenario, no pending banner
- Student with `closed_waiting` + prior released simulados: hero shows stats normally, pending banner appears below hero
- `stats.simuladosRealizados` no longer counts `closed_waiting` simulados

Stop the server with Ctrl+C.

- [ ] **Step 6: Run full test suite**

Run: `npm run test --run`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/premium/home/HomePagePremium.tsx
git commit -m "fix(home): gate stats fallback and add pending result banner

- stats fallback now uses canViewResults() instead of userState?.finished,
  excluding closed_waiting simulados from the count/average
- pendingSimulado detects closed_waiting + finished attempts
- pending banner shown below hero when student has prior released results
- KpiGridSection.lastScore and worstArea already fixed via DB RPC change"
```

---

### Task 4: Push to remote

- [ ] **Step 1: Push all commits to main**

```bash
git push origin main
```

Expected: Push succeeds. No force-push required.

- [ ] **Step 2: Confirm what the user must do manually**

After pushing, relay the following to the user:

> **User action required:**
> 1. Go to Supabase Dashboard → SQL Editor
> 2. Run migration: `supabase/migrations/20260405000000_gate_performance_by_release.sql`
>    (or apply via `supabase db push` if CLI is configured)
> 3. No other manual steps required — the frontend changes deploy automatically.

---

## Security Properties After Fix

| Invariant | Mechanism |
|-----------|-----------|
| Score never readable before release via performance RPCs | `results_release_at <= now()` JOIN in both read RPCs |
| Score never readable before release via result pages | `canViewResults(status)` in each page (existing) |
| Score never readable before release via ranking | `results_release_at <= now()` in `fetchSimuladosWithResults()` (existing) |
| `HomePagePremium` stats only from released simulados | `canViewResults(s.status)` in stats fallback (this fix) |
| `lastScore`, `recentScores`, `worstArea` only from released | Fixed via DB RPC — history only returns released rows |
