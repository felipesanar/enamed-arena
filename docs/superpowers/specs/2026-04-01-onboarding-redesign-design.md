# Onboarding Redesign — Design Spec

**Date:** 2026-04-01
**Visual reference:** `.superpowers/brainstorm/1676-1775085361/content/onboarding-design.html`

## Overview

Rewrite the visual layer of the 3-step onboarding flow (Especialidade → Instituições → Confirmação) to deliver a full dark, premium, immersive experience. All business logic, routing, API calls, and copy are preserved. Only CSS/layout/styling changes.

## Design Decisions

### Background & Atmosphere
- Full-screen dark canvas: `background: linear-gradient(145deg, #160610 0%, #0a0508 55%, #120208 100%)`
- Per-step atmospheric glow blobs (absolute, `filter: blur(70px)`, pointer-events none):
  - Step 0: wine blob top-left `rgba(232,56,98,.16)` + small blob bottom-right `rgba(90,21,48,.14)`
  - Step 1: cooler wine top-right `rgba(180,40,80,.16)` + small blob bottom-left `rgba(120,20,55,.12)`
  - Step 2: wine center-top `rgba(200,50,80,.14)` + soft blob bottom-center `rgba(90,21,48,.1)`
- Scanline grid texture: `opacity: .035`, masked radial gradient, `pointer-events: none`

### Color Palette
Single accent color throughout all 3 steps: `#e83862` (wine). No per-step color switching.

- Active progress dot: border `#e83862`, bg `rgba(232,56,98,.2)`, glow pulse animation
- Completed dot: border `rgba(74,222,128,.5)`, bg `rgba(74,222,128,.12)`, color `#4ade80`, checkmark
- Pending dot: border `rgba(255,255,255,.13)`, bg `rgba(255,255,255,.03)`, dim

### Glass Panel
Wraps glyph + step content + bottom nav. Nearly invisible — its purpose is z-depth for the complex InstitutionStep.
- `background: rgba(255,255,255,.022)`
- `border: 1px solid rgba(255,255,255,.06)`
- `box-shadow: inset 0 1px 0 rgba(255,255,255,.055)`
- `border-radius: 28px`

### Step Glyph (per step component)
64×64px icon box + radial glow ring (separate div):
- Box: `background: linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)`, `border: 1px solid rgba(232,56,98,.32)`, `box-shadow: 0 6px 24px rgba(232,56,98,.22)`, `border-radius: 20px`
- Icon: Lucide SVG at 30×30, `color: #e83862`, `strokeWidth: 1.75`
- Glow ring: sibling div, absolute, `inset: -10px`, `border-radius: 50%`, `radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)`
- Animations: `onboarding-glyph-box` (scale breathe), `onboarding-glyph-glow` (opacity pulse)
- Glyphs: Step 0 = GraduationCap, Step 1 = Building2, Step 2 = Sparkles

### Progress Dots
- 28×28px circles with `h-px` connector lines (`max-w-16`, wine/green when filled)
- Active dot: CSS class `onboarding-dot-active` (glow pulse keyframe)
- Labels row below: 9px, `rgba(232,56,98,.85)` active, `rgba(74,222,128,.5)` completed, `rgba(255,255,255,.18)` pending

### Bottom Nav (inside glass panel)
- `background: linear-gradient(to top, rgba(10,5,8,.96) 0%, rgba(10,5,8,.65) 100%)`
- `border-top: 1px solid rgba(255,255,255,.055)`, `padding: 13px 18px 26px`
- Back: `rgba(255,255,255,.055)` bg, `opacity:0 pointer-events:none` on step 0
- Next/Start: `background: #e83862`, `box-shadow: 0 3px 16px rgba(232,56,98,.32)`, `flex: 1`
- Finish: `background: linear-gradient(135deg, #e83862 0%, #b52240 100%)`, wine glow shadow

### Dark Form Elements

**Search input:**
- `background: rgba(255,255,255,.05)`, `border: 1px solid rgba(255,255,255,.09)`, text `rgba(255,255,255,.85)`, placeholder `rgba(255,255,255,.3)`, icon `rgba(255,255,255,.3)`
- Focus ring: `rgba(232,56,98,.35)`

**Specialty chips:**
- Default: `background: rgba(255,255,255,.035)`, `border: 1px solid rgba(255,255,255,.07)`, text `rgba(255,255,255,.6)`
- Selected: `background: rgba(232,56,98,.12)`, `border: rgba(232,56,98,.38)`, color `#e83862`, weight 600
- Undecided: `border: 1px dashed rgba(255,255,255,.1)`, bg transparent, text `rgba(255,255,255,.3)` italic

**Institution selected chips (at top):**
- `background: rgba(232,56,98,.12)`, `border: 1px solid rgba(232,56,98,.25)`, color `#e83862`

**ENARE toggle:**
- `border: 1.5px solid rgba(232,56,98,.22)`, `background: rgba(232,56,98,.05)`

**UF accordion group:**
- Outer: `border: 1px solid rgba(255,255,255,.06)`, `border-radius: 13px`
- Header: `background: rgba(255,255,255,.03)`, text `rgba(255,255,255,.55)`
- Row hover: `background: rgba(255,255,255,.04)`
- Row selected: `background: rgba(232,56,98,.07)`, border-top `rgba(232,56,98,.1)`

**Confirmation cards:**
- `background: rgba(255,255,255,.028)`, `border: 1px solid rgba(255,255,255,.07)`
- Tags: `background: rgba(255,255,255,.055)`, `border: rgba(255,255,255,.09)`, text `rgba(255,255,255,.55)`

**Edit blocked banner:**
- `background: rgba(251,191,36,.08)`, `border: rgba(251,191,36,.2)`, text `rgba(251,191,36,.9)`

**Error message:**
- `background: rgba(232,56,98,.1)`, `border: rgba(232,56,98,.2)`, text `rgba(255,255,255,.8)`

### Mobile Swipe Gesture
Implemented via `onPointerDown`/`onPointerUp` on the glass panel (avoids Framer Motion drag conflicts with internal scroll):
- Track `startX` and `startY` on pointerdown
- On pointerup: if `|dx| > 50` and `|dx| > |dy| * 1.5` (horizontal dominant):
  - `dx < 0` → `handleNext()` (if canProceed)
  - `dx > 0` → `handleBack()` (if step > 0)
- No visual drag/snap — purely gesture detection, animation handled by AnimatePresence

### CSS Keyframes (src/index.css)
```
@keyframes onboarding-glyph-breathe  — scale 1→1.025→1, 3.5s ease-in-out infinite
@keyframes onboarding-glyph-glow     — opacity 1→0.55→1, 3.5s ease-in-out infinite
@keyframes onboarding-dot-pulse      — box-shadow wine glow 12→20px, 2.5s ease-in-out infinite
```
Classes: `.onboarding-glyph-box`, `.onboarding-glyph-glow`, `.onboarding-dot-active`

## Files Changed
1. `src/index.css` — 3 keyframes + 3 animation classes
2. `src/pages/OnboardingPage.tsx` — dark canvas, glows, dot progress, glass panel, swipe gesture, dark nav
3. `src/components/onboarding/SpecialtyStep.tsx` — dark glyph + dark form elements
4. `src/components/onboarding/InstitutionStep.tsx` — dark glyph + dark form elements
5. `src/components/onboarding/ConfirmationStep.tsx` — dark glyph + dark confirmation cards

## Preserved (No Changes)
- All state logic in OnboardingPage (usePersistedState, canProceed, handleNext, handleBack, handleFinish)
- All API calls (saveOnboarding, trackEvent, clearPersistedStateByPrefix)
- All data fetching in step components (useEnamedSpecialties, useInstitutionsBySpecialty)
- All copy (titles, subtitles, labels, button text)
- All business rules (max 3 institutions, "Ainda não sei" exclusivity, edit lock)
- All routes and navigation (navigate("/"))
- All accessibility (focus-visible rings, aria attributes)
