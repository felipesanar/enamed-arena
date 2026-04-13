

# Fix: DesempenhoPage full-width (remove outer padding)

## Problem

The `DashboardLayout` wraps all page content in a `<main>` with `px-4 md:px-8 py-6 md:py-8` padding (line 91). This creates the white borders visible in the screenshot. The DesempenhoPage needs to be treated as a "full-bleed" route like the arena/exam routes.

## Solution

### File: `src/components/premium/DashboardLayout.tsx`

Add a `isFullBleedRoute` check that matches `/desempenho` (and potentially `/comparativo`). When active, the `<main>` gets `p-0` instead of the default padding — same pattern already used for `isArenaRoute`.

```tsx
const isFullBleedRoute = useMemo(
  () => /^\/(desempenho|comparativo)(?:\/|$)/.test(location.pathname),
  [location.pathname]
);
```

Then update the `<main>` className (line 91):

```tsx
isExamRoute ? "p-0 overflow-hidden"
  : isArenaRoute || isFullBleedRoute ? "p-0"
  : "px-4 md:px-8 py-6 md:py-8"
```

Mobile top/bottom padding still applies via the existing mobile block — no change needed there, but we should also skip the mobile top/bottom padding for full-bleed routes to avoid gaps on mobile:

Update the mobile padding condition (line 92-100) to also exclude `isFullBleedRoute`.

### File: `src/components/desempenho/DesempenhoSimuladoPanel.tsx`

The white body section (line 89) already has its own `px-4 py-5 md:px-5 md:py-6`. This stays as-is — it provides internal content padding within the full-bleed container. No changes needed here.

### File: `src/pages/DesempenhoPage.tsx`

The skeleton/empty states currently have no outer wrapper. Add mobile-safe top padding to the skeleton and empty states so they don't hide under the mobile header:

```tsx
<div className="px-4 md:px-8 py-6 md:py-8">
  {/* skeleton or empty state content */}
</div>
```

## Summary

| File | Change |
|------|--------|
| `DashboardLayout.tsx` | Add `isFullBleedRoute` for `/desempenho`; apply `p-0` to `<main>` |
| `DesempenhoPage.tsx` | Wrap skeleton/empty states in padding div |

