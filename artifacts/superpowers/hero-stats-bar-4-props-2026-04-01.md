# Hero stats bar — 4 value props (2026-04-01)

## Done

- `src/components/landing/LandingHero.tsx`: constant `HERO_VALUE_PROPS` with four product messages; stats `motion.div` uses `flex items-stretch`, `min-w-0`, smaller semibold text, vertical dividers, `role="list"` / `listitem`, `aria-label` with joined copy.
- `src/components/landing/LandingHero.test.tsx`: regression test for two phrases.

## Verification

- `npm run test -- --run LandingHero` — 9 passed.
- `npx eslint src/components/landing/LandingHero.tsx src/components/landing/LandingHero.test.tsx` — clean (run locally).

## Review

- **Blocker:** none.
- **Major:** none.
- **Minor:** `npm run lint` still fails on pre-existing issues elsewhere in the repo.
- **Nit:** jsdom logs "Not implemented: navigation" during LandingHero tests (pre-existing behavior).
