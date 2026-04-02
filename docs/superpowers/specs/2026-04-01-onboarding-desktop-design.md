# Onboarding Desktop Layout — Design Spec

**Date:** 2026-04-01
**Visual reference:** `.superpowers/brainstorm/432-1775093094/content/desktop-detail.html`
**Base:** `docs/superpowers/specs/2026-04-01-onboarding-redesign-design.md` (mobile spec)

## Overview

Add a desktop-native 2-column layout to the existing dark onboarding flow. Below `lg` (1024px) the mobile layout is unchanged. At `lg+` the glass panel expands to a centered 2-column card: left column provides step context (glyph + tips), right column holds the form. Only `OnboardingPage.tsx` and the 3 step components need changes — no new files, no logic changes.

---

## Breakpoint

| Range | Layout |
|-------|--------|
| `< 1024px` | Mobile: single-column glass panel (unchanged) |
| `≥ 1024px` | Desktop: 2-column card, max-width 900px, centered |

Tailwind prefix: `lg:` throughout.

---

## OnboardingPage — Desktop Shell

### Card dimensions
- `max-w-[900px] w-full mx-auto`
- `min-h-[520px]`
- Same glass panel tokens as mobile: `border-radius: 28px`, `background: rgba(255,255,255,.022)`, `border: 1px solid rgba(255,255,255,.06)`, `box-shadow: inset 0 1px 0 rgba(255,255,255,.055)`
- Mobile margins `mx-3.5 mt-4 mb-4` → desktop `lg:mx-auto lg:mt-5 lg:mb-8`

### Brand header + progress
Unchanged from mobile — sits above the card in the dark canvas. On desktop, add `lg:px-0` to center within the max-width column.

### Card body: 2-column flex
```
<div class="flex flex-col lg:flex-row flex-1 min-h-0">
  <LeftColumn />   {/* lg:w-[280px] */}
  <RightColumn />  {/* flex-1 */}
</div>
```

### Step metadata lookup (desktop only)

`OnboardingPage` defines a `STEP_META` array so the left column can render the correct glyph, title, and description without coupling to the step components:

```tsx
import { GraduationCap, Building2, Sparkles } from "lucide-react";

const STEP_META = [
  {
    icon: GraduationCap,
    title: "Qual sua especialidade desejada?",
    description: "Usaremos essa informação para comparar seu desempenho com candidatos da mesma área.",
  },
  {
    icon: Building2,
    title: "Quais instituições você deseja?",
    description: "Selecione até 3 instituições do ENARE onde pretende prestar residência.",
  },
  {
    icon: Sparkles,
    title: "Tudo pronto!",
    description: "Confira suas informações antes de começar. Editável entre janelas de simulado.",
  },
] as const;
```

The step components' glyph areas (which contain the same h2 + p) are hidden on `lg+` via `lg:hidden` — so copy is never duplicated in the rendered DOM.

---

### Left column — static context panel
- `lg:w-[280px] lg:flex-shrink-0`
- `lg:border-r lg:border-white/[.055]`
- `background: rgba(255,255,255,.012)` (desktop only, via inline style or Tailwind arbitrary)
- Padding: `lg:px-6 lg:py-7`
- Subtle radial glow: `pointer-events-none absolute inset-0 rounded-full` centered, `rgba(232,56,98,.07)`

Contents (top to bottom):
1. Glyph box — 56×56px, reuses `.onboarding-glyph-box` + `.onboarding-glyph-glow` CSS classes
2. Wine accent rule — `w-7 h-0.5 rounded-full bg-[rgba(232,56,98,.45)]`
3. Step title — `text-[17px] font-extrabold text-white/[.88] leading-snug`
4. Step description — `text-[12px] text-white/[.38] leading-relaxed`
5. Contextual tips (steps 0 and 1 only) — see below
6. ConfirmationStep: no tips — intentional negative space

### Left column transition
`motion.div` keyed on `step`, animates only `opacity`:
```tsx
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
transition={{ duration: 0.35, ease: "easeInOut" }}
```
Independent of the right column's slide animation.

### Right column
- `flex-1 overflow-hidden flex flex-col`
- Padding: `lg:px-6 lg:py-5 lg:pb-0` (overwrites mobile `px-4`)

### Bottom nav
Spans full card width (both columns). No change from mobile — `flex items-center gap-2.5 px-4 pb-7 pt-3.5` plus `lg:px-6`.

---

## Contextual Tips

Rendered inside the left column on `lg+`, steps 0 and 1 only.

**Component:** inline `DesktopTips` inside `OnboardingPage` (not a separate file).

```tsx
const DESKTOP_TIPS: Record<number, string[]> = {
  0: [
    "Aparece no seu ranking e comparativos",
    "Editável entre janelas de prova",
  ],
  1: [
    "Comparativo com inscritos nessas vagas",
    "Máximo 3 instituições do ENARE",
  ],
};
```

Each tip renders as:
- Container: `rounded-[9px] bg-white/[.028] border border-white/[.06] px-3 py-2 flex items-start gap-2`
- Dot: `w-1.5 h-1.5 rounded-full bg-[rgba(232,56,98,.5)] flex-shrink-0 mt-[5px]`
- Text: `text-[10.5px] text-white/[.38] leading-relaxed`

Tips list wrapper: `flex flex-col gap-2 mt-2`

---

## SpecialtyStep — Desktop Adjustments

Only JSX changes, no logic.

### Chip grid
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```
(was `grid-cols-1 sm:grid-cols-2`)

### Glyph area + form layout
On `lg+`, the step component no longer needs its own glyph area — the glyph lives in `OnboardingPage`'s left column.

**Implementation:** hide the glyph area div on desktop:
```
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0 lg:hidden">
```
The `h-full overflow-hidden flex flex-col` root wrapper adds `lg:pt-4` to compensate for removed top padding.

---

## InstitutionStep — Desktop Adjustments

Same glyph-area hide pattern as SpecialtyStep:
```
<div className="... lg:hidden">  {/* glyph area */}
```

No other layout changes needed — the UF accordion naturally uses the available width.

---

## ConfirmationStep — Desktop Adjustments

### Glyph area
Same hide pattern: `lg:hidden`.

### Cards: horizontal grid on desktop
```
<div className="flex-1 overflow-y-auto px-4 pb-2 lg:px-0 lg:pb-0 flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:content-start">
```

Each card gets `lg:h-fit` so they don't stretch vertically.

The institutions card's tags stay `flex-wrap gap-1.5` — they wrap naturally within the narrower column.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/OnboardingPage.tsx` | Desktop card shell, left column, DesktopTips, responsive margins |
| `src/components/onboarding/SpecialtyStep.tsx` | Hide glyph on `lg+`, `lg:grid-cols-3` for chips, `lg:pt-4` |
| `src/components/onboarding/InstitutionStep.tsx` | Hide glyph on `lg+` |
| `src/components/onboarding/ConfirmationStep.tsx` | Hide glyph on `lg+`, `lg:grid-cols-3` for cards |

No new files. No CSS additions (Tailwind only). No logic changes.

---

## Preserved (No Changes)

- All state, hooks, and business logic in `OnboardingPage`
- All API calls and data fetching
- All copy
- All mobile styles (additive responsive classes only)
- All existing tests (they run in jsdom which ignores breakpoints)
- All CSS keyframe classes (`.onboarding-glyph-box`, `.onboarding-glyph-glow`, `.onboarding-dot-active`)
