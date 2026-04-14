# Notas de Corte Drawer — Redesign Spec

**Date:** 2026-04-14  
**Component:** `src/components/ranking/CutoffScoreModal.tsx`  
**Status:** Approved

---

## Problem

The current drawer displays ~1000 cutoff score rows in a flat list with no visual hierarchy. The user's own institution is highlighted inline but can be missed. There is no immediate indication of whether the user passes or fails the cutoff. Score values are plain white numbers with no semantic color.

---

## Design Decision

**Hybrid C + A with B's auto-filter behavior:**
- A fixed **Hero card** at the top shows the user's own institution's cutoff scores in large type, with a pass/fail semantic color (blue = pass, red = fail) — matching the KPI cards already used in the Ranking page.
- The drawer **auto-opens with the user's specialty pre-selected**, reducing the list from ~1000 to ~300 rows.
- The user's institution row is **pinned at the top** of the table (separate section), independent of alphabetical order.
- Score cells are **color-tinted** for cutoff context: high scores in muted sky-blue, mid in default white, low in muted red — using the same semantic palette as the Ranking KPI cards.
- All colors use **exact token values from `RankingView.tsx`** — no new colors introduced.

---

## Color Tokens (all from RankingView)

| Element | Token used | Value (dark mode) |
|---|---|---|
| Drawer background | `containerBg` | `#100910` |
| Surface / table header | `surfaceBg` | `rgba(255,255,255,0.03)` |
| Dividers / borders | `borderColor` | `rgba(255,255,255,0.07)` |
| Active pill | `chipActive` | `bg: rgba(122,26,50,0.85)`, `border: rgba(255,150,170,0.25)`, `color: white` |
| Inactive pill | `chipInactive` | `bg: rgba(255,255,255,0.06)`, `border: rgba(255,255,255,0.09)`, `color: rgba(255,255,255,0.5)` |
| User row bg | `tableUserBg` | `rgba(122,26,50,0.28)` |
| User row score | `tableUserScore` | `#ffcbd8` |
| Other row score | `tableScore` | `rgba(255,255,255,0.7)` |
| Table header text | `tableHeaderText` | `rgba(255,255,255,0.25)` |
| Table row border | `tableRowBorder` | `1px solid rgba(255,255,255,0.05)` |
| Hero pass bg | `kpiCutPassBg` | `linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)` |
| Hero pass border | `kpiCutPassBorder` | `1px solid rgba(99,179,237,0.22)` |
| Hero pass value | `kpiCutPassVal` | `#7dd3fc` |
| Hero pass tag | `kpiCutPassTag` | `rgba(125,211,252,0.7)` |
| Hero fail bg | `kpiCutFailBg` | `linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)` |
| Hero fail border | `kpiCutFailBorder` | `1px solid rgba(239,68,68,0.20)` |
| Hero fail value | `kpiCutFailVal` | `#f87171` |
| Hero fail tag | `kpiCutFailTag` | `rgba(248,113,113,0.7)` |

Score tints (cutoff-specific, not in the ranking table):
- High (≥ 80%): `rgba(125,211,252,0.85)` — sky-blue, muted
- Mid (74–79%): `rgba(255,255,255,0.65)` — default white
- Low (< 74%): `rgba(248,113,113,0.75)` — red, muted

---

## Component Structure

```
CutoffScoreModal (rename to CutoffScoreDrawer internally or keep name)
├── Backdrop (blur + dark overlay, click-to-close)
└── Drawer panel (slides from right, spring animation, max-w-lg, full height)
    ├── Header (shrink-0)
    │   ├── Eyebrow: "ENAMED 2026"
    │   ├── Title: "Notas de Corte"
    │   ├── Close button (X)
    │   ├── HeroCard (conditional: only when userSpecialty && userInstitutions[0])
    │   │   ├── Label: "Sua nota de corte"
    │   │   ├── Pass/fail tag ("PASSARIA ✓" / "NÃO PASSARIA ✗")
    │   │   ├── Score numbers: cutoff_score_general (large) + cutoff_score_quota (medium)
    │   │   └── Meta: institution name · specialty pill
    │   ├── Search input
    │   └── Filter row: specialty pills + result count
    ├── Divider
    ├── Table column header (sticky, shrink-0)
    └── Scrollable body
        ├── Section separator "Sua instituição" (when user row exists)
        ├── User row (pinned, wine highlight)
        ├── Section separator "Outras instituições"
        └── Other rows (color-tinted scores)
    └── Footer: disclaimer text
```

---

## Data & State

**Props (unchanged):**
```typescript
interface CutoffScoreModalProps {
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
}
```

**New state / memo additions:**
- `search: string` — already exists
- `specialtyFilter: string` — already exists, but now **initialized to `userSpecialty`** when drawer opens (instead of `'all'`)
- `cutoffState` — derived: `'no_profile' | 'loading' | 'no_match' | 'pass' | 'fail'` — same logic as `RankingView` uses for the KPI card, but computed inside the drawer using the already-fetched `rows` (no extra query needed: find the user's institution row from `rows`)
- `userRow` — the single row where `specialty_name ≈ userSpecialty && institution_name ≈ userInstitutions[0]`

**Score tint logic:**
```typescript
function scoreTint(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 74) return 'mid';
  return 'low';
}
```

Thresholds (80 / 74) are a reasonable default for ENAMED context; can be adjusted later.

---

## Hero Card Logic

The hero card is shown when `userSpecialty` is provided and `userInstitutions[0]` is available (passed as a new prop — see below).

The hero card needs the user's own cutoff row. Rather than an extra query, derive it from `rows` once loaded:
```typescript
const userRow = useMemo(() => {
  if (!userSpecialty || !userInstitution) return null;
  return rows.find(r =>
    r.specialty_name.toLowerCase() === userSpecialty.toLowerCase() &&
    r.institution_name.toLowerCase().includes(userInstitution.toLowerCase().trim())
  ) ?? null;
}, [rows, userSpecialty, userInstitution]);
```

Pass/fail state (needed for hero card color):
```typescript
const heroState: 'no_data' | 'no_score' | 'pass' | 'fail' =
  !userRow ? 'no_data'
  : currentUserScore == null ? 'no_score'
  : currentUserScore >= userRow.cutoff_score_general
  ? 'pass'
  : 'fail';
```

- `'no_data'` → hero card hidden (no userRow found in data)
- `'no_score'` → hero card shown with cutoff numbers, **no badge** (currentUserScore not available)
- `'pass'` → hero card with blue gradient + "PASSARIA ✓" tag
- `'fail'` → hero card with red gradient + "NÃO PASSARIA ✗" tag

`currentUserScore` is the user's latest simulation score as a percentage (same unit as `cutoff_score_general`). In `RankingView`, `currentUser.score` is already in that unit and is used for the same comparison at line 337.

---

## Props Change

```typescript
interface CutoffScoreModalProps {
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
  userInstitution?: string;      // NEW — first institution from onboarding
  currentUserScore?: number;     // NEW — user's score % for pass/fail badge
}
```

`RankingView` already has `userInstitutions[0]` and `currentUser?.score` available — pass them through.

---

## Auto-filter on Open

```typescript
useEffect(() => {
  if (open) {
    setSpecialtyFilter(userSpecialty ?? 'all');  // auto-select user's specialty
    closeBtnRef.current?.focus();
  } else {
    setSearch('');
    setSpecialtyFilter('all');
    setShowFilters(false);
  }
}, [open, userSpecialty]);
```

---

## Pinned User Row

Render order in the scrollable body:
1. If `userRow` exists: section separator "Sua instituição" + user row (with `tableUserBg` highlight)
2. Section separator "Outras instituições"
3. Remaining `filteredRows` excluding the user row

The user row key uses `institution_name + specialty_name` (same as today).

---

## Animation (unchanged)

Drawer slides from right with the existing spring config:
```typescript
transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
```

---

## Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-label="Notas de Corte ENAMED"` — unchanged
- Close on Escape — unchanged
- Focus on close button on open — unchanged
- Score tint is supplementary (not the only indicator) — numbers are always visible

---

## Out of Scope

- Sorting by score (column headers not clickable)
- Virtual scrolling (1000 rows is acceptable; browser handles it)
- Saving filter state between opens
- Light mode (the Ranking page is always dark in practice; no light-mode tokens needed in the drawer for now)
