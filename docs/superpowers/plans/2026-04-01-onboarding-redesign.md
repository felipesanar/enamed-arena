# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the onboarding flow's light UI with a full dark, premium, wine-accented design — atmospheric glows, glass panel, cinematic step glyphs, dot progress, mobile swipe — without touching any business logic.

**Architecture:** The shell (`OnboardingPage`) owns the dark canvas, atmospheric glows, dot progress, glass panel wrapper, swipe gesture, and bottom nav. Each step component (`SpecialtyStep`, `InstitutionStep`, `ConfirmationStep`) owns its own glyph area and restyled form elements. CSS keyframes live in `src/index.css`.

**Tech Stack:** React 18, TypeScript, Framer Motion 12, Tailwind CSS 3.4, Lucide React, Vitest 3 + Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/index.css` | Modify | Add 3 keyframes + 3 CSS classes for glyph/dot animations |
| `src/pages/OnboardingPage.tsx` | Rewrite | Dark canvas, per-step glow blobs, scanlines, brand header, dot progress, glass panel, swipe gesture, bottom nav |
| `src/components/onboarding/SpecialtyStep.tsx` | Rewrite JSX | Dark glyph area, dark search input, dark chip grid |
| `src/components/onboarding/InstitutionStep.tsx` | Rewrite JSX | Dark glyph area, dark institution UI (ENARE toggle, UF accordion, selected chips) |
| `src/components/onboarding/ConfirmationStep.tsx` | Rewrite JSX | Dark glyph area, dark confirmation cards |
| `src/components/onboarding/__tests__/SpecialtyStep.test.tsx` | Create | Smoke tests |
| `src/components/onboarding/__tests__/InstitutionStep.test.tsx` | Create | Smoke tests |
| `src/components/onboarding/__tests__/ConfirmationStep.test.tsx` | Create | Smoke tests |
| `src/pages/__tests__/OnboardingPage.test.tsx` | Create | Smoke tests |

---

## Task 1: CSS Keyframes

**Files:**
- Modify: `src/index.css` (append after existing keyframes near the end of the file)

- [ ] **Step 1: Append keyframes to index.css**

Find the end of the existing animation section in `src/index.css` (after `.sim-dot-pulse`) and append:

```css
/* ── Onboarding animations ───────────────────────────────────────── */
@keyframes onboarding-glyph-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.025); }
}

@keyframes onboarding-glyph-glow {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}

@keyframes onboarding-dot-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(232, 56, 98, 0.4), 0 0 4px rgba(232, 56, 98, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(232, 56, 98, 0.6), 0 0 8px rgba(232, 56, 98, 0.65);
  }
}

.onboarding-glyph-box {
  animation: onboarding-glyph-breathe 3.5s ease-in-out infinite;
}

.onboarding-glyph-glow {
  animation: onboarding-glyph-glow 3.5s ease-in-out infinite;
}

.onboarding-dot-active {
  animation: onboarding-dot-pulse 2.5s ease-in-out infinite;
}
```

- [ ] **Step 2: Verify dev server compiles without errors**

Run: `npm run dev`
Expected: no CSS parse errors in terminal

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(onboarding): add dark glyph and dot animation keyframes"
```

---

## Task 2: OnboardingPage — Dark Shell

**Files:**
- Rewrite: `src/pages/OnboardingPage.tsx`
- Create: `src/pages/__tests__/OnboardingPage.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/pages/__tests__/OnboardingPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../OnboardingPage";

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { segment: "pro" },
    onboarding: null,
    isOnboardingComplete: false,
    saveOnboarding: vi.fn(),
    onboardingEditLocked: false,
    onboardingNextEditableAt: null,
  }),
}));
vi.mock("@/components/onboarding/SpecialtyStep", () => ({
  SpecialtyStep: () => <div data-testid="specialty-step">SpecialtyStep</div>,
}));
vi.mock("@/components/onboarding/InstitutionStep", () => ({
  InstitutionStep: () => <div data-testid="institution-step">InstitutionStep</div>,
}));
vi.mock("@/components/onboarding/ConfirmationStep", () => ({
  ConfirmationStep: () => <div data-testid="confirmation-step">ConfirmationStep</div>,
}));
vi.mock("@/hooks/usePersistedState", () => ({
  usePersistedState: (_key: string, initial: unknown) => [initial, vi.fn()],
  clearPersistedStateByPrefix: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/brand/BrandMark", () => ({
  BrandIcon: () => <span>B</span>,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

it("renders brand header and step 0 by default", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByText("PRO: ENAMED")).toBeInTheDocument();
  expect(screen.getByTestId("specialty-step")).toBeInTheDocument();
});

it("renders Continuar button on step 0", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -- --run OnboardingPage.test
```
Expected: FAIL (tests import the existing light-themed component — it renders but assertions about `data-testid` on mocked components might pass; the important thing is no TypeScript/import errors)

- [ ] **Step 3: Rewrite OnboardingPage.tsx**

Replace the entire file contents of `src/pages/OnboardingPage.tsx` with:

```tsx
import { useState, useCallback, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { usePersistedState, clearPersistedStateByPrefix } from "@/hooks/usePersistedState";
import { trackEvent } from "@/lib/analytics";
import { BrandIcon } from "@/components/brand/BrandMark";
import { SpecialtyStep } from "@/components/onboarding/SpecialtyStep";
import { InstitutionStep } from "@/components/onboarding/InstitutionStep";
import { ConfirmationStep } from "@/components/onboarding/ConfirmationStep";
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";

const STEPS = ["Especialidade", "Instituições", "Confirmação"] as const;

const STEP_GLOWS: Array<Array<React.CSSProperties>> = [
  [
    { top: -70, left: -50, width: 280, height: 280, background: "radial-gradient(circle, rgba(232,56,98,.16) 0%, transparent 65%)" },
    { bottom: -30, right: -30, width: 180, height: 180, background: "radial-gradient(circle, rgba(90,21,48,.14) 0%, transparent 65%)" },
  ],
  [
    { top: -50, right: -50, width: 260, height: 260, background: "radial-gradient(circle, rgba(180,40,80,.16) 0%, transparent 65%)" },
    { bottom: 60, left: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(120,20,55,.12) 0%, transparent 65%)" },
  ],
  [
    { top: -50, left: "50%", width: 320, height: 260, transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(200,50,80,.14) 0%, transparent 65%)" },
    { bottom: -30, left: "50%", width: 240, height: 180, transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(90,21,48,.1) 0%, transparent 65%)" },
  ],
];

export default function OnboardingPage() {
  const prefersReducedMotion = useReducedMotion();
  const {
    profile,
    onboarding,
    isOnboardingComplete,
    saveOnboarding,
    onboardingEditLocked,
    onboardingNextEditableAt,
  } = useUser();
  const navigate = useNavigate();
  const segment = profile?.segment ?? "guest";

  const [step, setStep] = usePersistedState("onboarding:step", 0);
  const [selectedSpecialty, setSelectedSpecialty] = usePersistedState("onboarding:specialty", "");
  const [selectedInstitutions, setSelectedInstitutions] = usePersistedState<string[]>("onboarding:institutions", []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditingBlocked = isOnboardingComplete && onboardingEditLocked;

  const nextEditableText = onboardingNextEditableAt
    ? new Date(onboardingNextEditableAt).toLocaleString("pt-BR")
    : null;

  const canProceed = () => {
    switch (step) {
      case 0: return selectedSpecialty !== "";
      case 1: return selectedInstitutions.length >= 1;
      case 2: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (isEditingBlocked) return;
    setError("");
    if (!canProceed()) {
      if (step === 0) setError("Selecione uma especialidade para continuar.");
      if (step === 1) setError('Selecione ao menos 1 instituição ou marque "Ainda não sei".');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (isEditingBlocked) return;
    setError("");
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (isEditingBlocked) {
      setError("Seu perfil só pode ser editado entre janelas de execução.");
      return;
    }
    if (!canProceed()) return;
    setIsSaving(true);
    setError("");
    try {
      await saveOnboarding({
        specialty: selectedSpecialty,
        targetInstitutions: selectedInstitutions,
      });
      trackEvent("onboarding_completed", {
        segment,
        specialty: selectedSpecialty,
        institutionsCount: selectedInstitutions.length,
      });
      clearPersistedStateByPrefix("onboarding:");
      navigate("/");
    } catch (e) {
      console.error("[OnboardingPage] Error saving onboarding:", e);
      setError("Erro ao salvar seus dados. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInstitution = useCallback(
    (inst: string) => {
      setSelectedInstitutions((prev) =>
        prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
      );
    },
    [setSelectedInstitutions]
  );

  // Horizontal swipe detection (pointer events — doesn't conflict with inner scroll)
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && canProceed() && step < STEPS.length - 1) handleNext();
    if (dx > 0 && step > 0) handleBack();
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{
        background: "linear-gradient(145deg, #160610 0%, #0a0508 55%, #120208 100%)",
      }}
    >
      {/* Per-step atmospheric glow blobs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          {STEP_GLOWS[step].map((style, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{ ...style, filter: "blur(70px)" } as React.CSSProperties}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Scanline texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 20%, transparent 75%)",
        }}
        aria-hidden
      />

      {/* Brand header */}
      <div className="relative z-10 flex flex-col items-center pt-9 pb-0 gap-1.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
          style={{
            background:
              "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.35) 100%)",
            border: "1px solid rgba(232,56,98,.28)",
            boxShadow:
              "0 3px 12px rgba(232,56,98,.18), inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <BrandIcon size="sm" className="h-8 w-8" alt="" />
        </div>
        <span
          className="text-[9px] uppercase tracking-[.18em] font-bold"
          style={{ color: "rgba(255,255,255,.28)" }}
        >
          sanarflix
        </span>
        <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,.65)" }}>
          PRO: ENAMED
        </p>
      </div>

      {/* Progress dots */}
      <div className="relative z-10 flex items-center justify-center px-14 pt-5">
        {([0, 1, 2] as const).map((i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div
                className="flex-1 max-w-16 min-w-4 h-px mx-1.5 transition-colors duration-500"
                style={{
                  background:
                    i <= step
                      ? "rgba(74,222,128,.3)"
                      : "rgba(255,255,255,.09)",
                }}
              />
            )}
            <div
              className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold transition-all duration-300${i === step ? " onboarding-dot-active" : ""}`}
              style={
                i < step
                  ? {
                      background: "rgba(74,222,128,.12)",
                      border: "2px solid rgba(74,222,128,.5)",
                      color: "#4ade80",
                    }
                  : i === step
                  ? {
                      background: "rgba(232,56,98,.2)",
                      border: "2px solid #e83862",
                      color: "#e83862",
                    }
                  : {
                      background: "rgba(255,255,255,.03)",
                      border: "2px solid rgba(255,255,255,.13)",
                      color: "rgba(255,255,255,.25)",
                    }
              }
            >
              {i < step ? (
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
              ) : (
                i + 1
              )}
            </div>
          </Fragment>
        ))}
      </div>

      {/* Step labels */}
      <div className="relative z-10 flex justify-between px-7 pt-1.5">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className="text-[9px] font-semibold uppercase tracking-[.07em] flex-1 text-center transition-colors duration-300"
            style={{
              color:
                i < step
                  ? "rgba(74,222,128,.5)"
                  : i === step
                  ? "rgba(232,56,98,.85)"
                  : "rgba(255,255,255,.18)",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Edit-locked banner */}
      {isEditingBlocked && onboarding && (
        <div
          className="relative z-10 mx-3.5 mt-3 p-3.5 rounded-xl"
          style={{
            background: "rgba(251,191,36,.08)",
            border: "1px solid rgba(251,191,36,.2)",
            color: "rgba(251,191,36,.9)",
          }}
        >
          <p className="text-[13px] font-semibold">
            Edição temporariamente bloqueada
          </p>
          <p className="text-[11px] mt-1 opacity-80">
            Durante janela de execução você não pode alterar
            especialidade/instituições.
            {nextEditableText
              ? ` Próxima janela de edição: ${nextEditableText}.`
              : ""}
          </p>
        </div>
      )}

      {/* Glass panel */}
      <div
        className="relative z-10 mx-3.5 mt-4 mb-4 flex flex-col flex-1"
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
          className="flex items-center gap-2.5 px-4 pb-7 pt-3.5 flex-shrink-0"
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
  );
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- --run OnboardingPage.test
```
Expected: PASS — both assertions pass

- [ ] **Step 5: Verify dev server visually**

Run `npm run dev`, navigate to `/onboarding`. Expected: dark canvas with glow blobs, dot progress, glass panel, bottom nav with wine CTA. Step components still render (even if light-styled — those change in later tasks).

- [ ] **Step 6: Commit**

```bash
git add src/pages/OnboardingPage.tsx src/pages/__tests__/OnboardingPage.test.tsx
git commit -m "feat(onboarding): dark shell, glow blobs, dot progress, glass panel, swipe"
```

---

## Task 3: SpecialtyStep Dark Styles

**Files:**
- Rewrite: `src/components/onboarding/SpecialtyStep.tsx`
- Create: `src/components/onboarding/__tests__/SpecialtyStep.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/components/onboarding/__tests__/SpecialtyStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SpecialtyStep } from "../SpecialtyStep";

vi.mock("@/hooks/useEnamedData", () => ({
  useEnamedSpecialties: () => ({
    data: [{ name: "Clínica Médica" }, { name: "Cirurgia Geral" }],
    isLoading: false,
    isError: false,
  }),
}));

it("renders heading and search input", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  expect(
    screen.getByText("Qual sua especialidade desejada?")
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Buscar especialidade...")
  ).toBeInTheDocument();
});

it("renders specialty options from data", () => {
  render(<SpecialtyStep specialty="" onSelect={vi.fn()} />);
  expect(screen.getByText("Clínica Médica")).toBeInTheDocument();
  expect(screen.getByText("Cirurgia Geral")).toBeInTheDocument();
});

it("calls onSelect when a specialty is clicked", async () => {
  const onSelect = vi.fn();
  render(<SpecialtyStep specialty="" onSelect={onSelect} />);
  screen.getByText("Clínica Médica").click();
  expect(onSelect).toHaveBeenCalledWith("Clínica Médica");
});
```

- [ ] **Step 2: Run test to confirm it passes against existing component**

```bash
npm run test -- --run SpecialtyStep.test
```
Expected: PASS (tests are behavior-only, not style-dependent)

- [ ] **Step 3: Rewrite SpecialtyStep.tsx**

Replace the entire file `src/components/onboarding/SpecialtyStep.tsx`:

```tsx
import { useState, useMemo } from "react";
import { Search, X, CheckCircle2, ChevronRight, GraduationCap } from "lucide-react";
import { useEnamedSpecialties } from "@/hooks/useEnamedData";

const AINDA_NAO_SEI = "Ainda não sei";

interface Props {
  specialty: string;
  onSelect: (s: string) => void;
}

export function SpecialtyStep({ specialty, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const { data: specialties, isLoading, isError } = useEnamedSpecialties();

  const allOptions = useMemo(
    () => [AINDA_NAO_SEI, ...(specialties?.map((s) => s.name) ?? [])],
    [specialties]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    return allOptions.filter((s) =>
      s.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, allOptions]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-5">
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,.5)" }}>
          Erro ao carregar especialidades.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-[12px] underline"
          style={{ color: "#e83862" }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Glyph area */}
      <div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
        <div className="relative mb-4">
          <div
            className="pointer-events-none absolute inset-[-10px] rounded-full onboarding-glyph-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div
            className="relative w-16 h-16 rounded-[20px] flex items-center justify-center onboarding-glyph-box"
            style={{
              background:
                "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
              border: "1px solid rgba(232,56,98,.32)",
              boxShadow: "0 6px 24px rgba(232,56,98,.22)",
            }}
          >
            <GraduationCap
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2
          className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5"
        >
          Qual sua especialidade desejada?
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-5"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          Usaremos essa informação para comparar seu desempenho com candidatos
          da mesma área.
        </p>
      </div>

      {/* Search + chips */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2">
        {/* Search input */}
        <div className="relative mb-3 shrink-0">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "rgba(255,255,255,.3)" }}
          />
          <input
            type="text"
            placeholder="Buscar especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[42px] pl-10 pr-10 rounded-[13px] text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#e83862]/35 transition-all"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.09)",
              color: "rgba(255,255,255,.85)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,.3)" }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Chips grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-[13px] animate-pulse"
                style={{ background: "rgba(255,255,255,.06)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {filtered.map((spec) => {
              const isSelected = specialty === spec;
              const isUndecided = spec === AINDA_NAO_SEI;
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => onSelect(spec)}
                  className={`flex items-center justify-between p-3.5 rounded-[13px] transition-all duration-150 text-left group${
                    isUndecided ? " sm:col-span-2" : ""
                  }`}
                  style={
                    isSelected
                      ? {
                          background: "rgba(232,56,98,.12)",
                          border: "1px solid rgba(232,56,98,.38)",
                        }
                      : isUndecided
                      ? {
                          background: "rgba(255,255,255,.025)",
                          border: "1px dashed rgba(255,255,255,.1)",
                        }
                      : {
                          background: "rgba(255,255,255,.035)",
                          border: "1px solid rgba(255,255,255,.07)",
                        }
                  }
                >
                  <span
                    className={`text-[12px] transition-colors${
                      isUndecided ? " italic" : ""
                    }`}
                    style={{
                      color: isSelected
                        ? "#e83862"
                        : isUndecided
                        ? "rgba(255,255,255,.3)"
                        : "rgba(255,255,255,.6)",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {spec}
                  </span>
                  {isSelected ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: "#e83862" }}
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "rgba(255,255,255,.3)" }}
                    />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p
                className="col-span-2 text-center text-[12px] py-8"
                style={{ color: "rgba(255,255,255,.35)" }}
              >
                Nenhuma especialidade encontrada para &quot;{search}&quot;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- --run SpecialtyStep.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/SpecialtyStep.tsx src/components/onboarding/__tests__/SpecialtyStep.test.tsx
git commit -m "feat(onboarding): dark styles for SpecialtyStep"
```

---

## Task 4: InstitutionStep Dark Styles

**Files:**
- Rewrite: `src/components/onboarding/InstitutionStep.tsx`
- Create: `src/components/onboarding/__tests__/InstitutionStep.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/components/onboarding/__tests__/InstitutionStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { InstitutionStep } from "../InstitutionStep";

vi.mock("@/hooks/useEnamedData", () => ({
  useInstitutionsBySpecialty: () => ({
    grouped: {
      SP: [
        {
          id: "1",
          name: "USP — Faculdade de Medicina",
          uf: "SP",
          vagas: 12,
          cenario_pratica: "Hospital das Clínicas",
        },
      ],
    },
    flat: [
      {
        id: "1",
        name: "USP — Faculdade de Medicina",
        uf: "SP",
        vagas: 12,
        cenario_pratica: null,
      },
    ],
  }),
}));

it("renders heading", () => {
  render(
    <InstitutionStep
      selected={[]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  expect(
    screen.getByText("Quais instituições você deseja?")
  ).toBeInTheDocument();
});

it("shows undecided option", () => {
  render(
    <InstitutionStep
      selected={[]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  expect(screen.getByText("Ainda não sei")).toBeInTheDocument();
});

it("shows selected institution chip when selected", () => {
  render(
    <InstitutionStep
      selected={["USP — Faculdade de Medicina"]}
      onToggle={vi.fn()}
      selectedSpecialty="Clínica Médica"
    />
  );
  // Selected chip appears at top
  const chips = screen.getAllByText("USP — Faculdade de Medicina");
  expect(chips.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to confirm it passes against existing component**

```bash
npm run test -- --run InstitutionStep.test
```
Expected: PASS

- [ ] **Step 3: Rewrite InstitutionStep.tsx**

Replace the entire file `src/components/onboarding/InstitutionStep.tsx`:

```tsx
import { useState, useMemo } from "react";
import {
  Search,
  X,
  CheckCircle2,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useInstitutionsBySpecialty } from "@/hooks/useEnamedData";

const AINDA_NAO_SEI = "Ainda não sei";
const MAX_INSTITUTIONS = 3;

interface Props {
  selected: string[];
  onToggle: (inst: string) => void;
  selectedSpecialty: string;
}

export function InstitutionStep({ selected, onToggle, selectedSpecialty }: Props) {
  const [search, setSearch] = useState("");
  const [enareExpanded, setEnareExpanded] = useState(false);
  const [expandedUfs, setExpandedUfs] = useState<Set<string>>(new Set());

  const isUndecided = selected.includes(AINDA_NAO_SEI);
  const { grouped, flat } = useInstitutionsBySpecialty(selectedSpecialty);
  const isLoading =
    !grouped && selectedSpecialty && selectedSpecialty !== AINDA_NAO_SEI;

  const filteredGrouped = useMemo(() => {
    if (!grouped) return null;
    if (!search.trim()) return grouped;
    const result: Record<string, typeof flat> = {};
    for (const [uf, insts] of Object.entries(grouped)) {
      const matches = insts.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.uf.toLowerCase().includes(search.toLowerCase())
      );
      if (matches.length > 0) result[uf] = matches;
    }
    return result;
  }, [grouped, search]);

  const totalVagas = useMemo(() => {
    if (!flat) return 0;
    return flat.reduce((sum, i) => sum + i.vagas, 0);
  }, [flat]);

  const totalInstitutions = flat?.length ?? 0;

  const handleToggleUndecided = () => {
    if (isUndecided) {
      onToggle(AINDA_NAO_SEI);
    } else {
      selected.forEach((inst) => onToggle(inst));
      onToggle(AINDA_NAO_SEI);
    }
  };

  const handleToggleInstitution = (instName: string) => {
    if (isUndecided) onToggle(AINDA_NAO_SEI);
    const realSelected = selected.filter((s) => s !== AINDA_NAO_SEI);
    const alreadySelected = realSelected.includes(instName);
    if (!alreadySelected && realSelected.length >= MAX_INSTITUTIONS) return;
    onToggle(instName);
  };

  const toggleUf = (uf: string) => {
    setExpandedUfs((prev) => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  };

  const realSelected = selected.filter((s) => s !== AINDA_NAO_SEI);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Glyph area */}
      <div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
        <div className="relative mb-4">
          <div
            className="pointer-events-none absolute inset-[-10px] rounded-full onboarding-glyph-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div
            className="relative w-16 h-16 rounded-[20px] flex items-center justify-center onboarding-glyph-box"
            style={{
              background:
                "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
              border: "1px solid rgba(232,56,98,.32)",
              boxShadow: "0 6px 24px rgba(232,56,98,.22)",
            }}
          >
            <Building2
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2 className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5">
          Quais instituições você deseja?
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-4"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          Selecione até {MAX_INSTITUTIONS} instituições do ENARE onde pretende
          prestar residência.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2 gap-2.5">
        {/* "Ainda não sei" */}
        <button
          type="button"
          onClick={handleToggleUndecided}
          className="w-full p-3.5 rounded-[13px] text-left flex items-center justify-between shrink-0 transition-all duration-150"
          style={
            isUndecided
              ? {
                  background: "rgba(232,56,98,.12)",
                  border: "1px solid rgba(232,56,98,.38)",
                }
              : {
                  background: "rgba(255,255,255,.025)",
                  border: "1px dashed rgba(255,255,255,.1)",
                }
          }
        >
          <span
            className="text-[12px] italic"
            style={{
              color: isUndecided ? "#e83862" : "rgba(255,255,255,.3)",
              fontWeight: isUndecided ? 600 : 400,
            }}
          >
            {AINDA_NAO_SEI}
          </span>
          {isUndecided && (
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#e83862" }} />
          )}
        </button>

        {!isUndecided && (
          <>
            {/* ENARE toggle */}
            <button
              type="button"
              onClick={() => setEnareExpanded(!enareExpanded)}
              className="w-full p-4 rounded-[15px] text-left transition-all duration-200 shrink-0"
              style={{
                border: enareExpanded
                  ? "1.5px solid rgba(232,56,98,.35)"
                  : "1.5px solid rgba(232,56,98,.22)",
                background: enareExpanded
                  ? "rgba(232,56,98,.07)"
                  : "rgba(232,56,98,.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="text-[13.5px] font-bold"
                    style={{ color: "rgba(255,255,255,.75)" }}
                  >
                    ENARE
                  </span>
                  <span
                    className="text-[10.5px] ml-2"
                    style={{ color: "rgba(255,255,255,.35)" }}
                  >
                    {totalInstitutions} inst. · {totalVagas} vagas
                  </span>
                </div>
                {enareExpanded ? (
                  <ChevronUp
                    className="h-5 w-5"
                    style={{ color: "rgba(232,56,98,.7)" }}
                  />
                ) : (
                  <ChevronDown
                    className="h-5 w-5"
                    style={{ color: "rgba(255,255,255,.3)" }}
                  />
                )}
              </div>
              {!enareExpanded && (
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "rgba(255,255,255,.3)" }}
                >
                  Clique para ver as instituições de{" "}
                  <strong style={{ color: "rgba(255,255,255,.45)" }}>
                    {selectedSpecialty}
                  </strong>
                </p>
              )}
            </button>

            {enareExpanded && (
              <>
                {/* Selected chips */}
                {realSelected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {realSelected.map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => onToggle(inst)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11px] font-semibold transition-opacity hover:opacity-80"
                        style={{
                          background: "rgba(232,56,98,.12)",
                          border: "1px solid rgba(232,56,98,.25)",
                          color: "#e83862",
                        }}
                      >
                        {inst}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Search + counter */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "rgba(255,255,255,.3)" }}
                    />
                    <input
                      type="text"
                      placeholder="Buscar instituição..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-[42px] pl-10 pr-4 rounded-[13px] text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#e83862]/35 transition-all"
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.09)",
                        color: "rgba(255,255,255,.85)",
                      }}
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: "rgba(255,255,255,.3)" }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div
                    className="text-[11px] font-semibold px-3 py-2 rounded-[10px] shrink-0 tabular-nums"
                    style={
                      realSelected.length > 0
                        ? {
                            background: "rgba(74,222,128,.1)",
                            color: "rgba(74,222,128,.9)",
                          }
                        : {
                            background: "rgba(251,191,36,.1)",
                            color: "rgba(251,191,36,.8)",
                          }
                    }
                  >
                    {realSelected.length}/{MAX_INSTITUTIONS}
                  </div>
                </div>

                {/* UF groups */}
                {isLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 rounded-[13px] animate-pulse"
                        style={{ background: "rgba(255,255,255,.05)" }}
                      />
                    ))}
                  </div>
                ) : filteredGrouped &&
                  Object.keys(filteredGrouped).length > 0 ? (
                  <div className="overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                    {Object.entries(filteredGrouped).map(([uf, insts]) => {
                      const isExpanded =
                        expandedUfs.has(uf) || !!search.trim();
                      const ufVagas = insts.reduce(
                        (s, i) => s + i.vagas,
                        0
                      );
                      return (
                        <div
                          key={uf}
                          className="rounded-[13px] overflow-hidden"
                          style={{ border: "1px solid rgba(255,255,255,.06)" }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleUf(uf)}
                            className="w-full flex items-center justify-between p-3 transition-colors"
                            style={{ background: "rgba(255,255,255,.03)" }}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin
                                className="h-3.5 w-3.5"
                                style={{ color: "rgba(255,255,255,.3)" }}
                              />
                              <span
                                className="text-[11.5px] font-bold"
                                style={{ color: "rgba(255,255,255,.6)" }}
                              >
                                {uf}
                              </span>
                              <span
                                className="text-[10px]"
                                style={{ color: "rgba(255,255,255,.28)" }}
                              >
                                {insts.length} inst. · {ufVagas} vagas
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp
                                className="h-4 w-4"
                                style={{ color: "rgba(255,255,255,.28)" }}
                              />
                            ) : (
                              <ChevronDown
                                className="h-4 w-4"
                                style={{ color: "rgba(255,255,255,.28)" }}
                              />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="p-1.5 flex flex-col gap-0.5">
                              {insts.map((inst) => {
                                const isSelected = realSelected.includes(
                                  inst.name
                                );
                                const isMaxReached =
                                  !isSelected &&
                                  realSelected.length >= MAX_INSTITUTIONS;
                                return (
                                  <button
                                    key={inst.id}
                                    type="button"
                                    onClick={() =>
                                      handleToggleInstitution(inst.name)
                                    }
                                    disabled={isMaxReached}
                                    className="w-full flex items-center justify-between p-2.5 rounded-[10px] transition-all text-left disabled:cursor-not-allowed"
                                    style={
                                      isSelected
                                        ? {
                                            background:
                                              "rgba(232,56,98,.07)",
                                            border:
                                              "1px solid rgba(232,56,98,.1)",
                                          }
                                        : isMaxReached
                                        ? { opacity: 0.35 }
                                        : {}
                                    }
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className="text-[11.5px] truncate"
                                        style={{
                                          color: isSelected
                                            ? "#e83862"
                                            : "rgba(255,255,255,.65)",
                                          fontWeight: isSelected ? 600 : 400,
                                        }}
                                      >
                                        {inst.name}
                                      </p>
                                      <p
                                        className="text-[10px]"
                                        style={{
                                          color: "rgba(255,255,255,.28)",
                                        }}
                                      >
                                        {inst.vagas} vaga
                                        {inst.vagas !== 1 ? "s" : ""}
                                        {inst.cenario_pratica &&
                                          ` · ${inst.cenario_pratica}`}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2
                                        className="h-4 w-4 shrink-0 ml-2"
                                        style={{ color: "#e83862" }}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    className="text-center text-[12px] py-8"
                    style={{ color: "rgba(255,255,255,.35)" }}
                  >
                    {search
                      ? `Nenhuma instituição encontrada para "${search}"`
                      : "Nenhuma instituição oferta esta especialidade no ENARE."}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- --run InstitutionStep.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/InstitutionStep.tsx src/components/onboarding/__tests__/InstitutionStep.test.tsx
git commit -m "feat(onboarding): dark styles for InstitutionStep"
```

---

## Task 5: ConfirmationStep Dark Styles

**Files:**
- Rewrite: `src/components/onboarding/ConfirmationStep.tsx`
- Create: `src/components/onboarding/__tests__/ConfirmationStep.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/components/onboarding/__tests__/ConfirmationStep.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ConfirmationStep } from "../ConfirmationStep";

it("renders confirmation heading", () => {
  render(
    <ConfirmationStep
      segment="pro"
      specialty="Clínica Médica"
      institutions={["USP", "UNIFESP"]}
    />
  );
  expect(screen.getByText("Tudo pronto!")).toBeInTheDocument();
});

it("shows specialty and institutions", () => {
  render(
    <ConfirmationStep
      segment="pro"
      specialty="Clínica Médica"
      institutions={["USP", "UNIFESP"]}
    />
  );
  expect(screen.getByText("Clínica Médica")).toBeInTheDocument();
  expect(screen.getByText("USP")).toBeInTheDocument();
  expect(screen.getByText("UNIFESP")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test against existing component**

```bash
npm run test -- --run ConfirmationStep.test
```
Expected: PASS

- [ ] **Step 3: Rewrite ConfirmationStep.tsx**

Replace entire file `src/components/onboarding/ConfirmationStep.tsx`:

```tsx
import { Sparkles } from "lucide-react";
import { SEGMENT_LABELS } from "@/types";
import type { UserSegment } from "@/types";

interface Props {
  segment: string;
  specialty: string;
  institutions: string[];
}

export function ConfirmationStep({ segment, specialty, institutions }: Props) {
  const segmentLabel = SEGMENT_LABELS[segment as UserSegment] ?? segment;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Glyph area */}
      <div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
        <div className="relative mb-4">
          <div
            className="pointer-events-none absolute inset-[-10px] rounded-full onboarding-glyph-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div
            className="relative w-16 h-16 rounded-[20px] flex items-center justify-center onboarding-glyph-box"
            style={{
              background:
                "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
              border: "1px solid rgba(232,56,98,.32)",
              boxShadow: "0 6px 24px rgba(232,56,98,.22)",
            }}
          >
            <Sparkles
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2 className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5">
          Tudo pronto!
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-5"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          Confira suas informações antes de começar. Você poderá editar esses
          dados entre as janelas de simulado.
        </p>
      </div>

      {/* Confirmation cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-3">
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
          </p>
          <p
            className="text-[13.5px] font-semibold"
            style={{ color: "rgba(255,255,255,.82)" }}
          >
            {segmentLabel}
          </p>
          <p className="text-[10.5px]" style={{ color: "rgba(255,255,255,.28)" }}>
            Definido pela sua assinatura
          </p>
        </div>

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
          </p>
          <p
            className="text-[13.5px] font-semibold"
            style={{ color: "rgba(255,255,255,.82)" }}
          >
            {specialty}
          </p>
        </div>

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
          </p>
          <div className="flex flex-wrap gap-1.5">
            {institutions.map((inst) => (
              <span
                key={inst}
                className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium"
                style={{
                  background: "rgba(255,255,255,.055)",
                  border: "1px solid rgba(255,255,255,.09)",
                  color: "rgba(255,255,255,.55)",
                }}
              >
                {inst}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- --run ConfirmationStep.test
```
Expected: PASS

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --run
```
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/ConfirmationStep.tsx src/components/onboarding/__tests__/ConfirmationStep.test.tsx
git commit -m "feat(onboarding): dark styles for ConfirmationStep"
```

---

## Final Verification

- [ ] Run `npm run dev` and navigate to `/onboarding`
- [ ] Verify step 0: dark canvas, wine glow blobs, scanlines, brand header, dot progress, glass panel, GraduationCap glyph with glow/breathe animation, dark chip grid, wine bottom nav
- [ ] Click a specialty and advance to step 1: glow blobs cross-fade, dot 1 shows checkmark, Building2 glyph, dark ENARE toggle, UF accordion with dark styles
- [ ] Advance to step 2: dot 2 shows checkmark, Sparkles glyph, dark confirmation cards
- [ ] Test back button: dot reverts, step slides back
- [ ] Test mobile (DevTools responsive mode): layout fits, bottom nav stays fixed, swipe left/right changes step
- [ ] Run `npm run lint` — no errors

```bash
git add -A
git commit -m "feat(onboarding): complete dark premium redesign"
```
