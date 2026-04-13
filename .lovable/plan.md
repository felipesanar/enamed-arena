

# Fix: Build errors + CORS manifest warning

## Problems

### 1. Build errors in test files

**`CutoffScoreModal.test.tsx`** (lines 34, 41, 52, 63): The `wrapper` function signature `{ children: React.ReactNode }` requires `children`, but `React.createElement(wrapper, {})` passes empty props. Fix: change `wrapper` to accept optional children or pass children correctly via JSX-style createElement.

**`RankingView.test.tsx`** (line 15): Mock function `() => null` lacks return type annotation, causing implicit `any`. Fix: add explicit return type `(): null => null`.

**`RankingView.test.tsx`** (line 38): `props` variable has implicit complex type. Fix: add explicit type annotation or use `as const` assertion.

### 2. CORS manifest error (preview-only)

The `site.webmanifest` file exists at `public/site.webmanifest`. The CORS error happens because the Lovable preview proxy redirects the manifest fetch to `lovable.dev/auth-bridge`, which strips CORS headers. This is a known preview environment limitation and does not affect production. No code fix needed — but we can add `crossorigin="use-credentials"` to the manifest link tag in `index.html` to suppress the warning.

## Plan

### Step 1: Fix `CutoffScoreModal.test.tsx`
- Change all `React.createElement(wrapper, {}, ...)` calls to properly pass children as the third argument (they already do — the issue is TypeScript inferring `{}` for the second arg). Fix by typing the wrapper properly or casting.

### Step 2: Fix `RankingView.test.tsx`
- Add return type to the CutoffScoreModal mock: `CutoffScoreModal: (): null => null`
- Add explicit type annotation to `props` in `renderView`

### Step 3: Add `crossorigin` to manifest link in `index.html`
- Change `<link rel="manifest" href="/site.webmanifest" />` to `<link rel="manifest" href="/site.webmanifest" crossorigin="use-credentials" />` — this won't fully fix the preview proxy issue but is the correct HTML practice.

### Files to edit
| File | Change |
|------|--------|
| `src/components/ranking/CutoffScoreModal.test.tsx` | Fix wrapper createElement typing |
| `src/components/ranking/RankingView.test.tsx` | Add return types + explicit prop type |
| `index.html` | Add crossorigin to manifest link |

