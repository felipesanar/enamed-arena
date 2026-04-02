# Onboarding Desktop Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive 2-column desktop layout to the onboarding flow at `lg` (1024px+): a 280px context panel on the left (glyph + title + tips) and the existing form on the right, while leaving the mobile experience completely unchanged.

**Architecture:** Additive Tailwind `lg:` classes only — no new files, no logic changes. `OnboardingPage` gains `STEP_META`, `DESKTOP_TIPS`, and an inline `DesktopTips` component; its glass panel is restructured into a 2-column flex at `lg+`. The three step components each get `lg:hidden` on their glyph areas plus minor layout tweaks.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, Framer Motion 12, Lucide React

---

### Task 1: OnboardingPage — step metadata, DesktopTips, and 2-column shell

**Files:**
- Modify: `src/pages/OnboardingPage.tsx`
- Modify: `src/pages/__tests__/OnboardingPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add inside `src/pages/__tests__/OnboardingPage.test.tsx` (after the existing `describe` block):

```tsx
describe("OnboardingPage — desktop left column", () => {
  it("renders step 0 title text in the DOM (left column)", () => {
    render(<OnboardingPage />);
    // STEP_META[0].title is rendered by the left column — always in DOM even if hidden via CSS
    const els = screen.getAllByText("Qual sua especialidade desejada?");
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it("renders step 0 desktop tips in the DOM", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByText("Aparece no seu ranking e comparativos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Editável entre janelas de prova")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/pages/__tests__/OnboardingPage.test.tsx
```

Expected: FAIL — `getByText("Aparece no seu ranking e comparativos")` not found.

- [ ] **Step 3: Extend the lucide-react import**

In `src/pages/OnboardingPage.tsx`, line 11:

```tsx
// Before:
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";

// After:
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2, GraduationCap, Building2 } from "lucide-react";
```

- [ ] **Step 4: Add STEP_META, DESKTOP_TIPS, and DesktopTips after the STEP_GLOWS array**

Insert after the closing `];` of `STEP_GLOWS` (after line 28) and before `export default function OnboardingPage()`:

```tsx
const STEP_META = [
  {
    icon: GraduationCap,
    title: "Qual sua especialidade desejada?",
    description:
      "Usaremos essa informação para comparar seu desempenho com candidatos da mesma área.",
  },
  {
    icon: Building2,
    title: "Quais instituições você deseja?",
    description:
      "Selecione até 3 instituições do ENARE onde pretende prestar residência.",
  },
  {
    icon: Sparkles,
    title: "Tudo pronto!",
    description:
      "Confira suas informações antes de começar. Editável entre janelas de simulado.",
  },
] as const;

const DESKTOP_TIPS: Record<number, string[]> = {
  0: ["Aparece no seu ranking e comparativos", "Editável entre janelas de prova"],
  1: ["Comparativo com inscritos nessas vagas", "Máximo 3 instituições do ENARE"],
};

function DesktopTips({ step }: { step: number }) {
  const tips = DESKTOP_TIPS[step];
  if (!tips) return null;
  return (
    <div className="flex flex-col gap-2 mt-2">
      {tips.map((tip) => (
        <div
          key={tip}
          className="rounded-[9px] px-3 py-2 flex items-start gap-2"
          style={{
            background: "rgba(255,255,255,.028)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]"
            style={{ background: "rgba(232,56,98,.5)" }}
          />
          <span
            className="text-[10.5px] leading-relaxed"
            style={{ color: "rgba(255,255,255,.38)" }}
          >
            {tip}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Add StepIcon variable before the return statement**

Inside `OnboardingPage()`, just before `return (` (currently after line 133), add:

```tsx
const StepIcon = STEP_META[step].icon;
```

- [ ] **Step 6: Restructure the glass panel to 2-column layout**

Replace the entire glass panel block (lines 293–431, from `{/* Glass panel */}` through the closing `</div>` of the component's outer div) with the following:

```tsx
      {/* Glass panel */}
      <div
        className="relative z-10 mx-3.5 mt-4 mb-4 lg:mx-auto lg:mt-5 lg:mb-8 lg:max-w-[900px] lg:w-full flex flex-col flex-1"
        style={{
          borderRadius: 28,
          background: "rgba(255,255,255,.022)",
          border: "1px solid rgba(255,255,255,.06)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.055), 0 16px 48px -16px rgba(0,0,0,.4)",
          overflow: "hidden",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Card body: 2-column on desktop */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Left column — desktop only */}
          <div
            className="hidden lg:flex lg:w-[280px] lg:flex-shrink-0 flex-col relative lg:border-r lg:border-white/[.055] lg:px-6 lg:py-7"
            style={{ background: "rgba(255,255,255,.012)" }}
          >
            {/* Subtle radial glow */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(232,56,98,.07) 0%, transparent 65%)",
              }}
              aria-hidden
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.35,
                  ease: "easeInOut",
                }}
                className="flex flex-col gap-4 relative z-10"
              >
                {/* Glyph box */}
                <div className="relative" style={{ width: 56, height: 56 }}>
                  <div
                    className="pointer-events-none absolute inset-[-8px] rounded-full onboarding-glyph-glow"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
                    }}
                    aria-hidden
                  />
                  <div
                    className="relative flex items-center justify-center rounded-[16px] onboarding-glyph-box"
                    style={{
                      width: 56,
                      height: 56,
                      background:
                        "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
                      border: "1px solid rgba(232,56,98,.32)",
                      boxShadow: "0 6px 24px rgba(232,56,98,.22)",
                    }}
                  >
                    <StepIcon
                      className="w-[26px] h-[26px]"
                      style={{ color: "#e83862" }}
                      strokeWidth={1.75}
                    />
                  </div>
                </div>

                {/* Wine accent rule */}
                <div
                  className="w-7 h-0.5 rounded-full"
                  style={{ background: "rgba(232,56,98,.45)" }}
                />

                {/* Step title */}
                <p
                  className="text-[17px] font-extrabold leading-snug"
                  style={{ color: "rgba(255,255,255,.88)" }}
                >
                  {STEP_META[step].title}
                </p>

                {/* Step description */}
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,.38)" }}
                >
                  {STEP_META[step].description}
                </p>

                {/* Contextual tips */}
                <DesktopTips step={step} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right column */}
          <div className="flex-1 overflow-hidden flex flex-col lg:px-6 lg:py-5 lg:pb-0">
            {/* Step content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -40 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full"
                >
                  {step === 0 && (
                    <SpecialtyStep
                      specialty={selectedSpecialty}
                      onSelect={setSelectedSpecialty}
                    />
                  )}
                  {step === 1 && (
                    <InstitutionStep
                      selected={selectedInstitutions}
                      onToggle={toggleInstitution}
                      selectedSpecialty={selectedSpecialty}
                    />
                  )}
                  {step === 2 && (
                    <ConfirmationStep
                      segment={segment}
                      specialty={selectedSpecialty}
                      institutions={selectedInstitutions}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-1 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-center"
              style={{
                background: "rgba(232,56,98,.1)",
                border: "1px solid rgba(232,56,98,.2)",
                color: "rgba(255,255,255,.8)",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom nav */}
        <div
          className="flex items-center gap-2.5 px-4 lg:px-6 pb-7 pt-3.5 flex-shrink-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,5,8,.96) 0%, rgba(10,5,8,.65) 100%)",
            borderTop: "1px solid rgba(255,255,255,.055)",
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[13px] text-[12.5px] font-medium transition-opacity disabled:opacity-0 disabled:pointer-events-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{
              background: "rgba(255,255,255,.055)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.45)",
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Voltar
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isEditingBlocked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[13px] text-[13.5px] font-bold transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e83862]/40"
              style={{
                background: "#e83862",
                color: "#fff",
                boxShadow: "0 3px 16px rgba(232,56,98,.32)",
              }}
            >
              Continuar
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isSaving || isEditingBlocked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[13px] text-[13.5px] font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e83862]/40"
              style={{
                background:
                  "linear-gradient(135deg, #e83862 0%, #b52240 100%)",
                color: "#fff",
                boxShadow: "0 3px 20px rgba(232,56,98,.38)",
              }}
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Começar
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm run test -- --run src/pages/__tests__/OnboardingPage.test.tsx
```

Expected: All 4 tests PASS (2 existing + 2 new).

- [ ] **Step 8: Commit**

```bash
git add src/pages/OnboardingPage.tsx src/pages/__tests__/OnboardingPage.test.tsx
git commit -m "feat(onboarding): add desktop 2-column shell with left context panel"
```

---

### Task 2: SpecialtyStep — hide glyph on desktop, 3-col chip grid

**Files:**
- Modify: `src/components/onboarding/SpecialtyStep.tsx`
- Modify: `src/components/onboarding/__tests__/SpecialtyStep.test.tsx`

- [ ] **Step 1: Write failing test**

Add to the bottom of `src/components/onboarding/__tests__/SpecialtyStep.test.tsx`:

```tsx
it("glyph area has lg:hidden class", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  // The glyph area div is hidden on lg+ via Tailwind class lg:hidden
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/components/onboarding/__tests__/SpecialtyStep.test.tsx
```

Expected: FAIL — querySelector returns null.

- [ ] **Step 3: Apply desktop adjustments**

In `src/components/onboarding/SpecialtyStep.tsx`:

**Change 1** — root wrapper, line 46: add `lg:pt-4`
```tsx
// Before:
<div className="flex flex-col h-full overflow-hidden">
// After:
<div className="flex flex-col h-full overflow-hidden lg:pt-4">
```

**Change 2** — glyph area div, line 48: add `lg:hidden`
```tsx
// Before:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
// After:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0 lg:hidden">
```

**Change 3** — loading skeleton grid, line 119: add `lg:grid-cols-3`
```tsx
// Before:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
// After:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
```

**Change 4** — loaded chips grid, line 129: add `lg:grid-cols-3`
```tsx
// Before:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-0.5">
// After:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-0.5">
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/components/onboarding/__tests__/SpecialtyStep.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/SpecialtyStep.tsx src/components/onboarding/__tests__/SpecialtyStep.test.tsx
git commit -m "feat(onboarding): SpecialtyStep desktop — hide glyph, 3-col chip grid"
```

---

### Task 3: InstitutionStep — hide glyph on desktop

**Files:**
- Modify: `src/components/onboarding/InstitutionStep.tsx`
- Modify: `src/components/onboarding/__tests__/InstitutionStep.test.tsx`

- [ ] **Step 1: Write failing test**

Add to the bottom of `src/components/onboarding/__tests__/InstitutionStep.test.tsx`:

```tsx
it("glyph area has lg:hidden class", () => {
  render(
    <InstitutionStep selected={[]} onToggle={vi.fn()} selectedSpecialty="Clínica Médica" />
  );
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/components/onboarding/__tests__/InstitutionStep.test.tsx
```

Expected: FAIL — querySelector returns null.

- [ ] **Step 3: Apply desktop adjustment**

In `src/components/onboarding/InstitutionStep.tsx`:

**Change 1** — root wrapper, line 85: add `lg:pt-4`
```tsx
// Before:
<div className="flex flex-col h-full overflow-hidden">
// After:
<div className="flex flex-col h-full overflow-hidden lg:pt-4">
```

**Change 2** — glyph area div, line 87: add `lg:hidden`
```tsx
// Before:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
// After:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0 lg:hidden">
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/components/onboarding/__tests__/InstitutionStep.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/InstitutionStep.tsx src/components/onboarding/__tests__/InstitutionStep.test.tsx
git commit -m "feat(onboarding): InstitutionStep desktop — hide glyph on lg+"
```

---

### Task 4: ConfirmationStep — hide glyph, horizontal card grid on desktop

**Files:**
- Modify: `src/components/onboarding/ConfirmationStep.tsx`
- Modify: `src/components/onboarding/__tests__/ConfirmationStep.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `src/components/onboarding/__tests__/ConfirmationStep.test.tsx`:

```tsx
it("glyph area has lg:hidden class", () => {
  render(
    <ConfirmationStep segment="standard" specialty="Clínica Médica" institutions={["USP"]} />
  );
  const glyphArea = document.querySelector(".shrink-0.lg\\:hidden");
  expect(glyphArea).toBeInTheDocument();
});

it("cards container has lg:grid-cols-3 class", () => {
  render(
    <ConfirmationStep segment="standard" specialty="Clínica Médica" institutions={["USP"]} />
  );
  const cardsContainer = document.querySelector(".lg\\:grid-cols-3");
  expect(cardsContainer).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/components/onboarding/__tests__/ConfirmationStep.test.tsx
```

Expected: Both new tests FAIL.

- [ ] **Step 3: Apply desktop adjustments**

In `src/components/onboarding/ConfirmationStep.tsx`:

**Change 1** — root wrapper, line 15: add `lg:pt-4`
```tsx
// Before:
<div className="flex flex-col h-full overflow-hidden">
// After:
<div className="flex flex-col h-full overflow-hidden lg:pt-4">
```

**Change 2** — glyph area div, line 17: add `lg:hidden`
```tsx
// Before:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
// After:
<div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0 lg:hidden">
```

**Change 3** — cards container, line 56: add desktop grid classes and clear padding
```tsx
// Before:
<div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-3">
// After:
<div className="flex-1 overflow-y-auto px-4 pb-2 lg:px-0 lg:pb-0 flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:content-start">
```

**Change 4** — "Seu plano" card, line 58: add `lg:h-fit`
```tsx
// Before:
<div
  className="p-4 rounded-[15px] flex flex-col gap-1"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Seu plano
// After:
<div
  className="p-4 rounded-[15px] flex flex-col gap-1 lg:h-fit"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Seu plano
```

**Change 5** — "Especialidade desejada" card, line 82: add `lg:h-fit`
```tsx
// Before:
<div
  className="p-4 rounded-[15px] flex flex-col gap-1"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Especialidade desejada
// After:
<div
  className="p-4 rounded-[15px] flex flex-col gap-1 lg:h-fit"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Especialidade desejada
```

**Change 6** — "Instituições desejadas" card, line 102: add `lg:h-fit`
```tsx
// Before:
<div
  className="p-4 rounded-[15px] flex flex-col gap-2"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Instituições desejadas
// After:
<div
  className="p-4 rounded-[15px] flex flex-col gap-2 lg:h-fit"
  style={{
    background: "rgba(255,255,255,.028)",
    border: "1px solid rgba(255,255,255,.07)",
  }}
>
  <p
    className="text-[9px] font-bold uppercase tracking-[.1em]"
    style={{ color: "rgba(255,255,255,.28)" }}
  >
    Instituições desejadas
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/components/onboarding/__tests__/ConfirmationStep.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/ConfirmationStep.tsx src/components/onboarding/__tests__/ConfirmationStep.test.tsx
git commit -m "feat(onboarding): ConfirmationStep desktop — hide glyph, horizontal card grid"
```

---

### Task 5: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full onboarding test suite**

```bash
npm run test -- --run src/pages/__tests__/OnboardingPage.test.tsx src/components/onboarding/__tests__/SpecialtyStep.test.tsx src/components/onboarding/__tests__/InstitutionStep.test.tsx src/components/onboarding/__tests__/ConfirmationStep.test.tsx
```

Expected: All tests PASS across all 4 files.

- [ ] **Step 2: TypeScript build check**

```bash
npm run build 2>&1 | head -60
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Dev server visual check**

```bash
npm run dev
```

Open http://localhost:8080/onboarding. Check at 1280px viewport:
- 2-column glass card appears (left 280px + right flex-1)
- Left column: glyph box + wine rule + title + description + tips
- Left column fades smoothly when navigating steps
- Right column: form content
- Step components' glyph areas are hidden
- SpecialtyStep chips render in 3 columns
- ConfirmationStep shows 3 cards horizontally
- Bottom nav spans full card width

Shrink viewport to 900px:
- Reverts to single-column mobile layout
- Glyph areas reappear in step components
- All mobile behaviour unchanged
