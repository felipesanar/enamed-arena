# Ranking Filter Bar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current two-column ranking filter card with a compact horizontal pill row featuring spring animations, shimmer effects, and a conditional institution pill that slides in when the specialty filter is active.

**Architecture:** Two-file change. First add CSS keyframes to `src/index.css` (shimmer pseudo-element). Then rewrite the filter bar section of `src/components/ranking/RankingView.tsx` (lines 843–1022) — add Framer Motion `motion.button` for transforms, CSS transitions for color changes, `AnimatePresence` for the institution pill's enter/exit animation, and a `shimmeringPillId` state that drives the `data-shimmer` attribute.

**Tech Stack:** React 18, TypeScript, Framer Motion 12 (already installed), Tailwind CSS, Lucide icons, inline styles (project's pattern in `RankingView.tsx`)

---

## Files

| File | Change |
|------|--------|
| `src/index.css` | Append shimmer keyframes + `[data-shimmer="1"]::before` rule |
| `src/components/ranking/RankingView.tsx` | Add FM imports; add `shimmeringPillId` state + `triggerShimmer` + `getPillStyle`; shorten segment labels; replace filter bar JSX lines 843–1022 |

---

## Task 1: Add shimmer CSS to index.css

**Files:**
- Modify: `src/index.css` (append after line 717)

This task adds the CSS keyframes and `::before` rule that the shimmer effect depends on. The `[data-shimmer="1"]::before` selector targets any pill that has `data-shimmer="1"` set temporarily by React state.

- [ ] **Step 1: Append shimmer rules to `src/index.css`**

Add the following block at the very end of the file (after the closing `}` of the `@media (prefers-reduced-motion: reduce)` block at line 717):

```css
/* ── Ranking filter bar — pill shimmer ──────────────────────────────────── */
@keyframes pill-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

[data-shimmer="1"]::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
  animation: pill-shimmer 0.7s ease forwards;
  pointer-events: none;
}
```

- [ ] **Step 2: Verify no CSS syntax errors**

Run: `npm run build 2>&1 | head -30`
Expected: No CSS parse errors. (Full build may warn about TS but CSS should be clean.)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add pill-shimmer keyframes for ranking filter bar"
```

---

## Task 2: Rewrite filter bar in RankingView.tsx

**Files:**
- Modify: `src/components/ranking/RankingView.tsx`

This is the main task. It touches four distinct areas of the file in order:

1. **Import line (line 5)** — add Framer Motion imports
2. **Lucide import (line 17–25)** — remove unused `Filter` icon
3. **SEGMENT_OPTIONS constant (lines 88–92)** — shorten labels
4. **State declarations (lines 214–215)** — add `shimmeringPillId` state
5. **After `t` token object (after line 419)** — add `triggerShimmer` + `getPillStyle`
6. **Filter bar JSX (lines 843–1022)** — replace entirely

### Step 1: Add Framer Motion import

- [ ] **Step 1: Open `src/components/ranking/RankingView.tsx` and add the Framer Motion import after the existing `react-router-dom` import (line 12)**

Current line 12:
```tsx
import { Link } from 'react-router-dom';
```

Add after it:
```tsx
import { motion, AnimatePresence } from 'framer-motion';
```

### Step 2: Remove the unused `Filter` icon from Lucide imports

- [ ] **Step 2: In the Lucide import block (lines 17–25), remove `Filter`**

Current:
```tsx
import {
  Trophy,
  Filter,
  Users,
  Stethoscope,
  Building,
  Globe,
  Crown,
  AlertTriangle,
} from 'lucide-react';
```

Replace with:
```tsx
import {
  Trophy,
  Users,
  Stethoscope,
  Building,
  Globe,
  Crown,
  AlertTriangle,
} from 'lucide-react';
```

### Step 3: Shorten segment option labels

- [ ] **Step 3: Update `SEGMENT_OPTIONS` constant (lines 88–92) with shorter labels**

Current:
```tsx
const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix padrão', icon: Users },
  { key: 'pro', label: 'Aluno PRO', icon: Crown },
];
```

Replace with:
```tsx
const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'SanarFlix', icon: Users },
  { key: 'pro', label: 'PRO', icon: Crown },
];
```

### Step 4: Add `shimmeringPillId` state

- [ ] **Step 4: Add `shimmeringPillId` state alongside the existing state declarations**

Current state block (lines 214–215):
```tsx
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  // ...
  const [cutoffModalOpen, setCutoffModalOpen] = useState(false);
```

Add `shimmeringPillId` state immediately after `cutoffModalOpen` (currently line 215):
```tsx
  const [shimmeringPillId, setShimmeringPillId] = useState<string | null>(null);
```

### Step 5: Add `triggerShimmer` and `getPillStyle` after the `t` token object

The `t` token object closes with `};` at approximately line 419. Add the following two definitions immediately after it:

- [ ] **Step 5: Add `triggerShimmer` and `getPillStyle` after the closing `};` of the `t` token object**

```tsx
  const triggerShimmer = (id: string) => {
    setShimmeringPillId(id);
    setTimeout(() => setShimmeringPillId((cur) => (cur === id ? null : cur)), 750);
  };

  const PILL_TRANSITION =
    'background 0.22s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s cubic-bezier(0.34,1.56,0.64,1), color 0.18s ease, box-shadow 0.2s ease';

  const getPillStyle = (isActive: boolean, isPro = false): React.CSSProperties => {
    if (isActive)
      return {
        background: 'linear-gradient(135deg, #8b1a35 0%, #5c1225 100%)',
        border: '1px solid rgba(255,150,170,0.2)',
        color: '#fff',
        boxShadow: '0 4px 14px rgba(122,26,50,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
        transition: PILL_TRANSITION,
        position: 'relative',
        overflow: 'hidden',
      };
    if (isPro)
      return {
        background: 'rgba(196,181,253,0.08)',
        border: '1px solid rgba(196,181,253,0.2)',
        color: '#c4b5fd',
        transition: PILL_TRANSITION,
        position: 'relative',
        overflow: 'hidden',
      };
    return {
      ...t.chipInactive,
      transition: PILL_TRANSITION,
      position: 'relative',
      overflow: 'hidden',
    };
  };
```

### Step 6: Replace the filter bar JSX

The filter bar is the `<div>` block at lines 843–1022. Replace it entirely.

- [ ] **Step 6: Replace lines 843–1022 (the filter bar `<div>` and everything inside it through its closing `</div>`) with the new compact pill bar**

Find the old block (starts at line 843):
```tsx
              {/* ── Filter bar ────────────────────────────────────────────── */}
              <div
                className="p-4 mb-4 rounded-[15px]"
                style={{
                  background: t.surfaceBg,
                  border: t.surfaceBorder,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Filter
```

…all the way through to the closing `</div>` at line 1022 (the line immediately before the blank line and `{/* ── Table`).

Replace the entire block with:

```tsx
              {/* ── Filter bar ────────────────────────────────────────────── */}
              <div
                className="px-4 py-3.5 mb-4 rounded-[15px]"
                style={{ background: t.surfaceBg, border: t.surfaceBorder }}
              >
                <div className="flex flex-wrap items-center gap-2">

                  {/* ─ Comparar group ─ */}
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.filterLabel }}
                  >
                    Comparar
                  </span>

                  {/* Todos comparison pill */}
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (rankingComparison.bySpecialty || rankingComparison.byInstitution) triggerShimmer('comp-all');
                      handleSelectAllComparison();
                    }}
                    aria-pressed={!rankingComparison.bySpecialty && !rankingComparison.byInstitution}
                    aria-label="Todos os candidatos"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.73rem] font-medium"
                    style={getPillStyle(!rankingComparison.bySpecialty && !rankingComparison.byInstitution)}
                    data-shimmer={shimmeringPillId === 'comp-all' ? '1' : undefined}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <motion.span
                      className="inline-flex shrink-0"
                      whileHover={{ scale: 1.15 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden />
                    </motion.span>
                    Todos
                  </motion.button>

                  {/* Specialty pill — only when user has a configured specialty */}
                  {userSpecialty && (
                    <motion.button
                      type="button"
                      onClick={() => {
                        if (!rankingComparison.bySpecialty) triggerShimmer('comp-specialty');
                        handleToggleSpecialtyComparison();
                      }}
                      aria-pressed={rankingComparison.bySpecialty}
                      aria-label={`Filtrar por especialidade: ${userSpecialty}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.73rem] font-medium"
                      style={getPillStyle(rankingComparison.bySpecialty)}
                      data-shimmer={shimmeringPillId === 'comp-specialty' ? '1' : undefined}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <motion.span
                        className="inline-flex shrink-0"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                      </motion.span>
                      {userSpecialty}
                    </motion.button>
                  )}

                  {/* Institution pill — slides in when specialty filter is active */}
                  <AnimatePresence>
                    {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
                      <motion.button
                        key="institution-pill"
                        type="button"
                        onClick={() => {
                          if (!rankingComparison.byInstitution) triggerShimmer('comp-institution');
                          handleToggleInstitutionComparison();
                        }}
                        aria-pressed={rankingComparison.byInstitution}
                        aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.73rem] font-medium max-w-[12rem]"
                        style={getPillStyle(rankingComparison.byInstitution)}
                        data-shimmer={shimmeringPillId === 'comp-institution' ? '1' : undefined}
                        initial={{ opacity: 0, x: -8, scale: 0.88 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.88 }}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      >
                        <motion.span
                          className="inline-flex shrink-0"
                          whileHover={{ scale: 1.15 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <Building className="h-3.5 w-3.5" aria-hidden />
                        </motion.span>
                        <span className="truncate">{userInstitutions[0]}</span>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Vertical divider */}
                  <div
                    className="shrink-0"
                    style={{ width: '1px', height: '22px', background: t.borderColor, borderRadius: '1px' }}
                    aria-hidden
                  />

                  {/* ─ Segmento group ─ */}
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.filterLabel }}
                  >
                    Segmento
                  </span>

                  {visibleSegmentOptions.map((f) => (
                    <motion.button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        if (segmentFilter !== f.key) triggerShimmer(`seg-${f.key}`);
                        handleSegmentFilterChange(f.key);
                      }}
                      aria-pressed={segmentFilter === f.key}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.73rem] font-medium"
                      style={getPillStyle(segmentFilter === f.key, f.key === 'pro' && segmentFilter !== f.key)}
                      data-shimmer={shimmeringPillId === `seg-${f.key}` ? '1' : undefined}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <motion.span
                        className="inline-flex shrink-0"
                        whileHover={{ scale: 1.15 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <f.icon className="h-3.5 w-3.5" aria-hidden />
                      </motion.span>
                      <span className="hidden sm:inline">{f.label}</span>
                    </motion.button>
                  ))}

                </div>

                {/* Active filter summary */}
                {(rankingComparison.bySpecialty || rankingComparison.byInstitution) && (
                  <p
                    className="text-xs mt-2.5 leading-snug"
                    style={{ color: t.filterLabel }}
                  >
                    <span style={{ color: '#7a1a32', marginRight: '4px' }}>●</span>
                    {rankingComparison.bySpecialty && userSpecialty && rankingComparison.byInstitution && userInstitutions[0] ? (
                      <>
                        Comparando com candidatos de{' '}
                        <span style={{ color: t.text2 }}>{userSpecialty}</span>
                        {' · '}
                        <span style={{ color: t.text2 }}>{userInstitutions[0]}</span>
                      </>
                    ) : rankingComparison.bySpecialty && userSpecialty && !rankingComparison.byInstitution ? (
                      <>
                        Comparando com candidatos de{' '}
                        <span style={{ color: t.text2 }}>{userSpecialty}</span>
                        <span style={{ color: t.filterLabel }}> (todas as instituições)</span>
                      </>
                    ) : !rankingComparison.bySpecialty && rankingComparison.byInstitution && userInstitutions[0] ? (
                      <>
                        Comparando com candidatos da{' '}
                        <span style={{ color: t.text2 }}>{userInstitutions[0]}</span>
                        <span style={{ color: t.filterLabel }}> (todas as especialidades)</span>
                      </>
                    ) : (
                      <span>Configure sua especialidade nas Configurações para usar este filtro.</span>
                    )}
                  </p>
                )}
              </div>
```

### Step 7: Verify tests still pass

- [ ] **Step 7: Run the test suite**

Run: `npm run test`

Expected output: all tests pass. The existing `RankingView.test.tsx` tests are unit tests for `buildTableRows` and rendering behavior — none of them test the filter bar's internal DOM structure, so they should continue to pass unchanged.

If any test fails, check:
- Did `Filter` removal cause a missing export? (It shouldn't — `Filter` is only used as a rendered JSX element, not exported)
- Did the `shimmeringPillId` state addition cause any hook-order issues? (It shouldn't — `useState` calls are unconditional)

### Step 8: Verify TypeScript builds cleanly

- [ ] **Step 8: Run TypeScript check**

Run: `npm run build 2>&1 | grep -E "error TS|ERROR"` 

Expected: no output (zero errors).

Common pitfalls:
- `motion.button` needs `type="button"` (already in the code above) — without it some TS configs warn
- `f.icon` in `<f.icon />` is typed as `React.ElementType` — this is already established in `SEGMENT_OPTIONS` and works fine

### Step 9: Commit

- [ ] **Step 9: Commit**

```bash
git add src/components/ranking/RankingView.tsx
git commit -m "feat: redesign ranking filter bar with premium spring-animated pills"
```
