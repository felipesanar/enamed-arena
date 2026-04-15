

# Fix PDF Layout Issues

## Problems

1. **Cover page blank**: The SVG gradient background renders but the content (title, card, stats) doesn't appear over it — likely the absolute-positioned SVG covers the content layer, or `flex: 1` + `justifyContent: space-between` breaks in react-pdf.

2. **Content split across 2 pages**: The cover card (name, score, stats) and the area bars end up on a second page with very low contrast (pink on white instead of on the dark background). These should be one unified cover page.

3. **Comments overflow/cut off**: `wrap={false}` on the entire `QuestionBlock` (line 230) prevents page breaks within any question. Long explanations (like the ones in the screenshots) exceed the page boundary and get clipped.

## Plan

### 1. Fix Cover Page — merge everything into one page

**File:** `src/lib/pdf/ProvaRevisadaDocument.tsx`

- Remove the SVG gradient approach (it's not layering properly with content)
- Use a simple `backgroundColor` on the Page style instead: `backgroundColor: '#421424'`
- Put all cover content (title, subtitle, white card with score/stats, area bars, footer text) in a single View with proper spacing — no `flex: 1` / `space-between` which causes content to be pushed off-page
- Use compact spacing to ensure everything fits on one A4 page

### 2. Fix Question Blocks — allow wrapping for long explanations

- Remove `wrap={false}` from the outer `<View>` in `QuestionBlock` (line 230)
- Add `wrap={false}` only to individual sub-sections that must stay together: the header row, each option row
- The explanation `<View style={s.explBox}>` must NOT have `wrap={false}` — long professor comments need to flow across pages
- Add `minPresenceAhead={40}` on the explBox to avoid orphaned title

### 3. Improve cover contrast

- Area bars on cover: use white/light text on dark background (already using `C.wineLight` but bars are `#fca5a5` which is low contrast on white — fix to only show on dark bg)
- Keep the white card for score/stats section for contrast

### Files affected

| File | Change |
|------|--------|
| `src/lib/pdf/ProvaRevisadaDocument.tsx` | Fix cover layout, fix wrap behavior |

