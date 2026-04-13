

# Fix: ResultadoPage UI — better sizing, centering, and responsiveness

## Problems
1. **Card too wide** — no `max-width`, stretches to full container width (can be 900px+)
2. **Not centered** — content fills available space without centering
3. **Ring too small relative to card** — at full width the 140px ring looks lost
4. **Stat cards only 3 columns** — spec had 4 (with "Respondidas"), but even 3 cols stretch too wide
5. **No vertical centering** — page doesn't feel like a "moment" screen
6. **Mobile: padding and proportions** — card padding too large on small screens

## Plan

### Step 1: Constrain and center the hero card
- Wrap the entire content in a centered container: `max-w-md mx-auto` (448px max)
- This makes the card feel intentional and focused, matching the emotional "reveal" moment

### Step 2: Responsive padding
- Card inner padding: `px-5 pt-7 pb-5 sm:px-7 sm:pt-9 sm:pb-7`
- CTA footer: adjust negative margins to match

### Step 3: Ring sizing
- Keep 140px on desktop, reduce to 120px on mobile via responsive classes

### Step 4: Stat cards grid
- Keep 3 columns but they'll look proportional within the narrower card
- Reduce gap slightly on mobile

### Step 5: CTA section
- Adjust negative margins for responsive padding changes

### Step 6: Add "Voltar" link below the card
- Subtle back link to `/simulados` below the card for navigation

## File to edit
| File | Change |
|------|--------|
| `src/pages/ResultadoPage.tsx` | Add max-width wrapper, responsive padding, ring sizing |

