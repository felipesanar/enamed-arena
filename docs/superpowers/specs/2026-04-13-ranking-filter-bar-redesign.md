# Ranking Filter Bar Redesign — Design Spec

## Goal

Replace the current two-column filter card (with "Filtrar ranking" header) with a single compact horizontal pill row featuring premium spring animations, shimmer effects, and a cleaner active-filter summary line.

## Background

The current filter bar lives in `src/components/ranking/RankingView.tsx` (lines ~843–1021). It renders a card with:
- A "Filtrar ranking" label + Filter icon header
- Two sub-sections: "Comparar com" and "Segmento"
- An institution sub-section that always renders when `userInstitutions.length > 0`
- A text summary below showing active filters

Problems:
- The header "Filtrar ranking" is redundant noise
- Two-column layout is spacious but breaks the visual rhythm of the page
- The institution button appears statically below specialty — no visual connection between them
- Button styles don't match the premium quality of the redesigned hero/KPI cards
- Transitions are default 150ms `transition-all` with no spring feel

## Approved Design

### Structure

Single horizontal row inside the same card container (`p-4 mb-4 rounded-[15px]`), using flexbox with `flex-wrap`:

```
[ COMPARAR ]  [● Todos]  [○ {specialty}]  [○ {institution} ← conditional]   │   [ SEGMENTO ]  [● Todos]  [○ SanarFlix]  [○ ⭐ PRO]
```

- **"Filtrar ranking" header removed** — the pill groups are self-labelled
- Group labels `COMPARAR` and `SEGMENTO` are overline-style (`0.58rem`, `font-weight:700`, `letter-spacing:.1em`, uppercase, muted color `t.filterLabel`)
- Vertical divider between the two groups (1px, 22px tall, `rgba(0,0,0,0.09)` light / `rgba(255,255,255,0.1)` dark)
- Flex-wrap ensures mobile wraps cleanly; divider has `flex-shrink: 0`

### Pill Styles

**Inactive:**
```
background: t.chipInactive.background   // rgba(0,0,0,0.04) light / rgba(255,255,255,0.06) dark
border: 1px solid t.chipInactive.border  // rgba(0,0,0,0.08) / rgba(255,255,255,0.09)
color: t.chipInactive.color              // rgba(0,0,0,0.52) / rgba(255,255,255,0.5)
border-radius: 20px
padding: 6px 13px
font-size: 0.73rem, font-weight: 500
```

**Active:**
```
background: linear-gradient(135deg, #8b1a35 0%, #5c1225 100%)
border: 1px solid rgba(255,150,170,0.2)
color: #fff
box-shadow: 0 4px 14px rgba(122,26,50,0.35), inset 0 1px 0 rgba(255,255,255,0.12)
```

**PRO inactive** (regardless of theme): `background: rgba(196,181,253,0.08)`, `border: rgba(196,181,253,0.2)`, `color: #c4b5fd`

**PRO active**: same wine gradient as other active pills (wine takes precedence when selected)

### Animations

**Responsibility split:**
- **Framer Motion** handles transforms: scale, y-translation, icon hover scale.
- **CSS transitions** handle color/background/border changes (FM cannot animate `linear-gradient`).

Use `motion.button` for all pill buttons.

**Scale/translate transitions:**
```ts
whileHover={{ y: -1 }}
whileTap={{ scale: 0.95 }}
transition={{ type: 'spring', stiffness: 400, damping: 15 }}
```

**Background/color transitions** via inline `style` prop + CSS `transition` on those properties:
```ts
style={{
  ...activePillStyle,          // switches between chipActive / chipInactive objects
  transition: 'background 0.22s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s cubic-bezier(0.34,1.56,0.64,1), color 0.18s ease, box-shadow 0.2s ease',
}}
```

The spring cubic-bezier `(0.34, 1.56, 0.64, 1)` on `background` gives an overshoot "pulse" feel on the color change, independent of FM's transform spring.

**Shimmer on activation:**  
Add to `src/index.css`:
```css
@keyframes pill-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

[data-shimmer="1"]::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
  animation: pill-shimmer 0.7s ease forwards;
  pointer-events: none;
}
```

Each `motion.button` has `style={{ position: 'relative', overflow: 'hidden' }}` always. On click (activate), set a local `shimmeringId` state to the pill's key; clear it after 750ms via `setTimeout`. Render `data-shimmer={shimmeringId === pillKey ? "1" : undefined}`.

**Icon scale on hover:**
```ts
// Inside motion.button, wrap the icon in:
<motion.span
  className="inline-flex shrink-0"
  whileHover={{ scale: 1.15 }}
  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
>
  <IconComponent className="h-3.5 w-3.5" aria-hidden />
</motion.span>
```

### Institution Pill — Conditional Appearance

The institution pill only renders when `rankingComparison.bySpecialty === true` AND `userInstitutions.length > 0`.

Wrap with Framer Motion `AnimatePresence`:
```tsx
<AnimatePresence>
  {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
    <motion.div
      key="institution-pill"
      initial={{ opacity: 0, x: -8, scale: 0.88 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
    >
      {/* institution motion.button */}
    </motion.div>
  )}
</AnimatePresence>
```

The institution pill behaves like the other comparison pills (toggle byInstitution), with the same active/inactive styles.

### Active Filter Summary

Shown below the pill row when `bySpecialty || byInstitution` is true. Single line, no Lucide icons.

**New copy:**
- Both active: `● Comparando com candidatos de {specialty} · {institution[0]}`
- Only specialty: `● Comparando com candidatos de {specialty} (todas as instituições)`
- Only institution: `● Comparando com candidatos da {institution[0]} (todas as especialidades)`
- Specialty active but not configured: `● Configure sua especialidade nas Configurações para usar este filtro.`

**Styling:**
```tsx
<p style={{ fontSize: '0.72rem', color: t.text3, marginTop: '10px' }}>
  <span style={{ color: '#7a1a32', marginRight: '5px' }}>●</span>
  Comparando com candidatos de{' '}
  <span style={{ color: t.text2 }}>{specialty}</span>
  {' · '}
  <span style={{ color: t.text2 }}>{institution}</span>
</p>
```

`t.text3` is the muted label color; `t.text2` is the medium emphasis color (already defined in the token object).

### Token additions required

The existing `t` token object in `RankingView.tsx` already has `chipActive`, `chipInactive`, `filterLabel`, `filterActiveText`, `text1`, `text2`, `text3`. No new tokens needed — the new design reuses existing tokens.

Since CSS transitions (not FM) handle border color changes, no split is needed. The existing `t.chipActive` / `t.chipInactive` objects can keep `border` as a shorthand — CSS `transition` handles shorthands fine. No token changes required.

## Files

| File | Change |
|------|--------|
| `src/components/ranking/RankingView.tsx` | Replace filter bar section (lines ~843–1021) with new compact pill row + AnimatePresence for institution pill + updated summary text |
| `src/index.css` | Add `@keyframes pill-shimmer` and `[data-shimmer="1"]::before` rule |
| `src/components/ranking/RankingView.test.tsx` | No changes needed — filter bar is not tested at snapshot level; existing tests continue to pass |

## Out of Scope

- No changes to filter logic (`rankingComparison`, `segmentFilter` state, handlers)
- No changes to caller files (`RankingPage.tsx`, `AdminRankingPreviewPage.tsx`)
- No changes to `rankingApi.ts` or any hooks
- No restructuring of token object `t` beyond splitting the border shorthand for Framer Motion compatibility

## Acceptance Criteria

1. Filter bar renders as a single horizontal row with group labels and vertical divider
2. "Filtrar ranking" header is gone
3. Institution pill is absent from DOM when specialty is not active; appears with slide-in spring animation when specialty is activated
4. Clicking any pill triggers spring animation (overshoot on activate, quick scale-down on deactivate)
5. Shimmer passes through pill on activation in both light and dark mode
6. Icon scales 1.15× on hover
7. PRO pill retains purple color in inactive state; turns wine gradient when active
8. Active filter summary shows correct copy for each state; no Lucide icons; bullet dot is wine color
9. Light mode and dark mode both look correct (same token system as rest of component)
10. All existing `RankingView` tests continue to pass
