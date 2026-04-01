# Desempenho Page — UI Redesign Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Goal

Rebuild the visual layer of `/desempenho` (`DesempenhoPage.tsx`) to a premium, high-creativity standard — same information, same journey, same copy, radically improved UI.

No data logic changes. No new routes. No new hooks. Pure visual/structural upgrade of `DesempenhoPage.tsx`.

---

## Design Language

**Blend: Banner Escuro + Corpo Editorial Claro**

- One unified card: dark wine hero (rounded top) + white body (rounded bottom)
- Hero: `linear-gradient(135deg, hsl(345,64%,22%) → hsl(340,58%,14%) → #0f111a)` with atmospheric glow overlay
- Body: `#ffffff` with `border: 1px solid rgba(0,0,0,0.07)`
- The two halves share a single `border-radius: 22px` container — they look like one piece

---

## Layout Structure

```
┌─────────────────────────────────────────────────┐  ← rounded top
│  [pills: Sim #1]  [Sim #2]  [Sim #3]            │  dark wine hero
│                                                  │
│  Aproveitamento geral      ┌──────┐ ┌──────┐    │
│  72%                       │ 82%  │ │ 54%  │    │
│  43/60 · 1h24min           │melhor│ │ foco │    │
│                            └──────┘ └──────┘    │
├─────────────────────────────────────────────────┤  nav strip
│  Ver também: [Correção] [Resultado] [Ranking]   │
├─────────────────────────────────────────────────┤  white body
│  Grande Área (2×2 grid)  │  Temas (accordion)  │
│                          │                      │
│  ┌──────────┐ ┌────────┐ │  ▸ HAS          90% │
│  │Clínica   │ │Cirurgia│ │  ▾ Diabetes     75% │  ← expanded
│  │82%  ████ │ │68% ███ │ │    Q3 — ...   ✓     │
│  └──────────┘ └────────┘ │    Q7 — ...   ✗     │
│  ┌──────────┐ ┌────────┐ │  ▸ Dislipidemia 60% │
│  │Gineco    │ │Prev.   │ │                      │
│  │63%  ███  │ │54% ██  │ │                      │
│  └──────────┘ └────────┘ │                      │
│                                                  │
│  ───────────────────────────────────────────     │
│  Resumo do desempenho                            │
│  ┌─────────────────┐  ┌─────────────────┐        │
│  │ ★ Onde brilha   │  │ ↓ Próximo foco  │        │
│  │ Clínica 82%     │  │ Prev. 54%       │        │
│  └─────────────────┘  └─────────────────┘        │
│                                                  │
│  ───────────────────────────────────────────     │
│  Evolução por grande área                        │
│  Clínica Médica      82%  ████████████████       │
│  Cirurgia            68%  █████████████          │
│  ...                                             │
└─────────────────────────────────────────────────┘  ← rounded bottom
```

---

## Section 1 — Hero Banner

**File:** `DesempenhoPage.tsx` (inline, no new component file)

### Pill selector (conditional: only if `simuladosWithResults.length > 1`)
- Horizontal scroll row of pills, `overflow-x: auto`, `scrollbar-width: none`
- Active pill: `bg-white/[0.14] border-white/[0.28]` text white
- Inactive pill: `bg-white/[0.05] border-white/[0.10]` text `white/40`
- Clicking a pill calls `setSelectedSimuladoId` + resets `selectedArea` + `selectedTheme`
- Pills show simulado title truncated to ~20 chars; no date

### Score block
- Overline: `"Aproveitamento geral"` — `text-[9px] uppercase tracking-[1.5px] text-white/40`
- Score: `overall.percentageScore%` — `text-[40px] font-black tracking-[-2px] text-white leading-none`
- Subline: `"{totalCorrect} de {totalQuestions} questões"` — `text-[10px] text-white/40`

### Stat chips (always visible)
- "melhor área": `bestArea.score%` in `text-green-400`
- "foco": `worstArea.score%` in `text-red-400`
- Both: `bg-white/[0.08] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-center`

### Atmospheric decoration
- Top-right glow: `absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[hsl(345,72%,48%)] blur-[60px] opacity-25 pointer-events-none`

---

## Section 2 — Nav Strip (`SimuladoResultNav`)

Existing component `<SimuladoResultNav simuladoId={selectedSimuladoId} />` — rendered between hero and body as a thin white bar with `border-b border-border/40`. No changes to the component itself.

---

## Section 3 — Body: Area Grid + Theme Accordion (two columns)

### Area Grid (left column)
- `grid grid-cols-2 gap-1.5`
- Each cell: `bg-white border rounded-[10px] p-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5`
- Border color variants:
  - Best area (index 0): `border-green-200 shadow-[0_3px_10px_-4px_rgba(34,197,94,0.2)]`
  - Worst area (last index): `border-red-200 shadow-[0_3px_10px_-4px_rgba(239,68,68,0.15)]`
  - Selected (matches `selectedArea`): `border-primary/40 shadow-[0_3px_10px_-4px_rgba(142,31,61,0.2)]`
  - Default: `border-border/40`
- Content per cell: area name (truncated), score (large, color-coded), `"{correct}/{questions}"` sub-label, thin bar at bottom
- Score color: green-700 for best, red-600 for worst, `text-foreground` for others
- Progress bar: `h-[3px] rounded-full bg-border/40` with fill proportional to score
  - Best fill: `bg-green-400`, worst fill: `bg-red-400`, others: `bg-gradient-to-r from-[#8e1f3d] to-[#e83862]`
- Clicking an area sets `selectedArea`; clicking selected area deselects (`null`); also resets `selectedTheme`

### Theme Accordion (right column, conditional: `selectedArea !== null`)
- Header: `"Temas · {selectedArea}"` overline
- Empty state if no area selected: dashed border placeholder "Selecione uma Grande Área"
- `themesForArea` list, each as an accordion row:
  - Row wrapper: `bg-[#fafafa] border border-border/40 rounded-[9px] overflow-hidden cursor-pointer`
  - Row header: area name + score, chevron `▸`/`▾`
  - When `selectedTheme === theme.theme`: row gets `border-primary/30 bg-white`, chevron becomes `▾`
  - Expanded area: `border-t border-primary/10 px-2.5 py-1.5 flex flex-col gap-0.5`
  - Each question in expanded: `Link` to `/simulados/{id}/correcao?q={number}`, flex row, truncated text + badge
  - Badge variants: `ok` (green), `err` (red), `blank` (amber)
- Score color: green-700 if ≥ 70, amber-600 if 50–69, red-600 if < 50

---

## Section 4 — Summary Cards (conditional: `byArea.length > 1`)

Two cards side by side (`grid grid-cols-2 gap-2`):
- **Onde você brilha:** `border-success/20 bg-success/[0.03]`, star icon, `bestArea.area` + `bestArea.score%`
- **Próximo foco:** `border-destructive/20 bg-destructive/[0.03]`, trending-down icon, `worstArea.area` + `worstArea.score%`
- Copy unchanged from current implementation

---

## Section 5 — Evolution Bars

- Each `byArea` entry as a row: area name (left) + `"{score}% · {correct}/{questions}"` (right)
- Bar: `h-[6px] bg-primary/[0.08] rounded-full overflow-hidden`
- Fill: `bg-gradient-to-r from-[#8e1f3d] to-[#e83862]` animated with Framer Motion `width: 0 → {score}%`
- Worst area bar fill: `from-[#991b1b] to-[#ef4444]`
- No separate `SectionHeader` component — overline label inside the body card

---

## Component / File Strategy

**Single-file rebuild** of `DesempenhoPage.tsx`. All visual sub-elements (hero, area card, theme accordion row, question row, summary card, evo bar) are inlined as JSX functions within the file — no new component files.

Helper components (all private, not exported):
- `HeroSection` — banner with pills + score
- `AreaCard` — one cell in the 2×2 grid  
- `ThemeAccordionRow` — one theme row with optional expanded questions
- `SummarySection` — the two green/red cards
- `EvoBars` — the evolution bar list

**Removed imports:** `SectionHeader`, `StatCard`, `PremiumCard` — replaced by inline styling.
**Kept imports:** `SimuladoResultNav`, `EmptyState`, `SkeletonCard`, `PageHeader` (used in loading/empty states), all hooks, all data helpers, Framer Motion, lucide icons.

---

## Skeleton / Loading State

Three skeleton blocks:
1. Full-width rounded skeleton for hero (`h-[140px] rounded-[22px] bg-primary/[0.06]`)
2. Two-column skeleton for area grid + themes (`h-[280px]`)
3. Full-width for summary + evo bars (`h-[160px]`)

---

## Empty State

Unchanged — `EmptyState` component with `BarChart3` icon, existing copy.

---

## Animations

- Hero entrance: `motion.div` `opacity: 0, y: 12 → opacity: 1, y: 0`, duration 0.45s
- Body: stagger children 0.07s
- Area cards: `whileHover={{ y: -2 }}`
- Theme accordion expand: `AnimatePresence` + `motion.div` height animation
- Evo bars: `motion.div` width `0 → score%`, duration 0.7s, staggered by index × 0.06s
- All animations respect `useReducedMotion`

---

## Constraints

- No new files
- No changes to hooks or data logic
- `simuladosWithResults`, `selectedSimuladoId`, `selectedArea`, `selectedTheme` state unchanged
- `SimuladoResultNav` component unchanged
- All existing copy preserved exactly
- TypeScript: follow project conventions (`noImplicitAny: false`, `strictNullChecks: false`)
