# Pre-Exam Dark Arena Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Pronto para começar?" PremiumCard in `SimuladoDetailPage` with a premium dark immersive card featuring a wine-gradient background, SVG-icon checklist grid, progress bar, and a CTA that lights up when all items are confirmed.

**Architecture:** Single-file change to `src/pages/SimuladoDetailPage.tsx` plus a new keyframe in `tailwind.config.ts`. The `PremiumCard variant="hero"` in the `isOnboardingComplete` branch (lines 199–330) is replaced by a plain `<div>` with inline dark styles. All existing state logic (`checkedItems`, `toggleCheck`, `allChecked`, `isVeteran`, `showFullChecklist`) is preserved unchanged.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4 (arbitrary values), Framer Motion (existing outer wrapper preserved), lucide-react

---

## Files

| Action | Path |
|---|---|
| **Create** | `src/pages/SimuladoDetailPage.test.tsx` |
| **Modify** | `src/pages/SimuladoDetailPage.tsx` |
| **Modify** | `tailwind.config.ts` |

---

## Task 1: Write failing tests

Create the test file with all mocks. Tests cover checklist interaction, CTA state, veteran mode, and `available_late`.

**Files:**
- Create: `src/pages/SimuladoDetailPage.test.tsx`

- [ ] **Step 1.1: Create the test file with mock setup**

```typescript
// src/pages/SimuladoDetailPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SimuladoDetailPage from "./SimuladoDetailPage";

// ── Framer Motion ────────────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, style: _s, initial: _i, animate: _a, transition: _tr, ...rest }: any) =>
          (({ div: <div {...rest}>{children}</div> } as any)[tag] ?? (
            <div {...rest}>{children}</div>
          )),
    }
  ),
  useReducedMotion: () => false,
}));

// ── react-router-dom — keep real MemoryRouter, stub useNavigate ──────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Hooks ────────────────────────────────────────────────────────────────────
vi.mock("@/hooks/useSimuladoDetail");
vi.mock("@/hooks/useSimulados");
vi.mock("@/contexts/UserContext");

import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import { useSimulados } from "@/hooks/useSimulados";
import { useUser } from "@/contexts/UserContext";

// ── Shared fixtures ──────────────────────────────────────────────────────────
const baseSimulado = {
  id: "sim-8",
  title: "Simulado Teste",
  description: "Desc",
  sequenceNumber: 8,
  status: "available" as const,
  questionsCount: 100,
  estimatedDuration: "5h",
  resultsReleaseAt: "2026-04-15T12:00:00Z",
  executionWindowStart: "2026-04-01T08:00:00Z",
  executionWindowEnd: "2026-04-01T18:00:00Z",
  userState: { started: false, finished: false },
};

function setupMocks(overrides: { simulado?: any; simulados?: any[]; onboarding?: boolean } = {}) {
  vi.mocked(useSimuladoDetail).mockReturnValue({
    simulado: overrides.simulado ?? baseSimulado,
    questions: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);
  vi.mocked(useSimulados).mockReturnValue({
    simulados: overrides.simulados ?? [],
    loading: false,
  } as any);
  vi.mocked(useUser).mockReturnValue({
    isOnboardingComplete: overrides.onboarding ?? true,
    profile: null,
    onboarding: null,
    isLoading: false,
  } as any);
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/simulados/sim-8"]}>
      <Routes>
        <Route path="/simulados/:id" element={<SimuladoDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}
```

- [ ] **Step 1.2: Add the test cases**

Append to the same file:

```typescript
// ── Tests ────────────────────────────────────────────────────────────────────
describe("SimuladoDetailPage — Dark Arena card", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setupMocks();
  });

  it("renders all 5 checklist items for a first-time user", () => {
    renderPage();
    expect(screen.getByText("Duração da prova")).toBeInTheDocument();
    expect(screen.getByText("Sem pausa")).toBeInTheDocument();
    expect(screen.getByText("Conexão estável")).toBeInTheDocument();
    expect(screen.getByText("Ambiente adequado")).toBeInTheDocument();
    expect(screen.getByText("Prova em tela cheia")).toBeInTheDocument();
  });

  it("shows progress counter starting at 0", () => {
    renderPage();
    expect(screen.getByText(/0/)).toBeInTheDocument();
    expect(screen.getByText(/5 itens confirmados/)).toBeInTheDocument();
  });

  it("CTA button is disabled with 0/5 items checked", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).toBeDisabled();
  });

  it("clicking a checklist item marks it checked and updates counter", () => {
    renderPage();
    fireEvent.click(screen.getByText("Duração da prova").closest("button")!);
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it("clicking a checked item unchecks it", () => {
    renderPage();
    const item = screen.getByText("Duração da prova").closest("button")!;
    fireEvent.click(item);
    fireEvent.click(item);
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it("CTA becomes enabled when all 5 items are checked", () => {
    renderPage();
    [
      "Duração da prova",
      "Sem pausa",
      "Conexão estável",
      "Ambiente adequado",
      "Prova em tela cheia",
    ].forEach((title) =>
      fireEvent.click(screen.getByText(title).closest("button")!)
    );
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).not.toBeDisabled();
  });

  it("active CTA navigates to the exam", () => {
    renderPage();
    [
      "Duração da prova",
      "Sem pausa",
      "Conexão estável",
      "Ambiente adequado",
      "Prova em tela cheia",
    ].forEach((title) =>
      fireEvent.click(screen.getByText(title).closest("button")!)
    );
    fireEvent.click(screen.getByRole("button", { name: /iniciar simulado/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulados/sim-8/prova");
  });
});

describe("SimuladoDetailPage — Veteran mode", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    // veteran = has at least one finished simulado
    setupMocks({
      simulados: [{ ...baseSimulado, userState: { started: true, finished: true } }],
    });
  });

  it("veteran CTA is immediately enabled (no checklist required)", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /iniciar simulado/i })
    ).not.toBeDisabled();
  });

  it("veteran can toggle to show full checklist", () => {
    renderPage();
    expect(screen.queryByText("Duração da prova")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/ver detalhes/i));
    expect(screen.getByText("Duração da prova")).toBeInTheDocument();
  });
});

describe("SimuladoDetailPage — available_late mode", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    setupMocks({
      simulado: { ...baseSimulado, status: "available_late" as const },
    });
  });

  it("shows 6 checklist items including ranking disclaimer", () => {
    renderPage();
    expect(screen.getByText("Entendi sobre o ranking")).toBeInTheDocument();
    // total count shows 6
    expect(screen.getByText(/6 itens confirmados/)).toBeInTheDocument();
  });

  it("renders the available_late info banner", () => {
    renderPage();
    expect(
      screen.getByText(/janela oficial encerrou/i)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 1.3: Run tests and confirm they fail for the right reasons**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: tests about "Dark Arena" fail because the card doesn't exist yet. Tests about checklist interaction may already pass (logic unchanged). The veteran and available_late tests may partially pass. Any unexpected errors mean the mock setup needs adjusting — fix before continuing.

- [ ] **Step 1.4: Commit the test file**

```bash
git add src/pages/SimuladoDetailPage.test.tsx
git commit -m "test(simulado-detail): add dark arena checklist interaction tests"
```

---

## Task 2: Add `blink` keyframe + update icon imports

**Files:**
- Modify: `tailwind.config.ts` (keyframes + animation)
- Modify: `src/pages/SimuladoDetailPage.tsx` (imports + CHECKLIST_BASE + buildChecklistItems)

- [ ] **Step 2.1: Add `blink` keyframe to `tailwind.config.ts`**

In `tailwind.config.ts`, add to `keyframes`:

```typescript
"blink": {
  "0%, 100%": { opacity: "1" },
  "50%": { opacity: "0.35" },
},
```

And to `animation`:

```typescript
"blink": "blink 2s ease-in-out infinite",
```

Result — the relevant sections of `tailwind.config.ts` become:

```typescript
keyframes: {
  "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
  "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
  "glow-pulse": { "0%, 100%": { opacity: "0.12" }, "50%": { opacity: "0.18" } },
  "blink": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
},
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "glow-pulse": "glow-pulse 6s ease-in-out infinite",
  "blink": "blink 2s ease-in-out infinite",
},
```

- [ ] **Step 2.2: Update lucide-react imports in `SimuladoDetailPage.tsx`**

Replace the current lucide import line (line 23–26):

```typescript
// BEFORE
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, Square, CheckSquare,
  CalendarPlus, Maximize2,
} from "lucide-react";
```

```typescript
// AFTER
import {
  Clock, Play, Zap, FileText, Trophy, Check,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles,
  CalendarPlus, Maximize2,
} from "lucide-react";
```

Removed: `AlertTriangle`, `Square`, `CheckSquare`  
Added: `Zap`, `FileText`, `Trophy`, `Check`

- [ ] **Step 2.3: Update `CHECKLIST_BASE` — replace `AlertTriangle` with `Zap`**

Change the `noPause` entry:

```typescript
// BEFORE
{ key: "noPause", icon: AlertTriangle, title: "Sem pausa", getDesc: () => "O cronômetro não pode ser pausado após iniciar." },

// AFTER
{ key: "noPause", icon: Zap, title: "Sem pausa", getDesc: () => "O cronômetro não pode ser pausado após iniciar." },
```

- [ ] **Step 2.4: Update `buildChecklistItems` — replace `CheckCircle2` with `Trophy` for rankingNational**

```typescript
// BEFORE
base.push({
  key: "rankingNational",
  icon: CheckCircle2,
  title: "Entendi sobre o ranking nacional",
  getDesc: () => "Confirmo que esta realização não conta para o ranking nacional, pois a janela oficial encerrou.",
});

// AFTER
base.push({
  key: "rankingNational",
  icon: Trophy,
  title: "Entendi sobre o ranking",
  getDesc: () => "Esta realização não conta para o ranking nacional — a janela oficial encerrou.",
});
```

- [ ] **Step 2.5: Run tests — icon changes should not break anything**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: same failures as before (dark card not yet implemented), no new errors.

- [ ] **Step 2.6: Commit**

```bash
git add tailwind.config.ts src/pages/SimuladoDetailPage.tsx
git commit -m "feat(simulado-detail): add blink keyframe, swap icons for dark arena"
```

---

## Task 3: Replace the card shell + top section

Replace the `<PremiumCard variant="hero">` block (lines 199–330) with the dark card. Do this in parts — shell first, then content.

**Files:**
- Modify: `src/pages/SimuladoDetailPage.tsx`

- [ ] **Step 3.1: Replace `<PremiumCard variant="hero">` opening and closing tags with dark `<div>`**

The current structure (inside the `isOnboardingComplete` else branch) is:

```tsx
) : (
  <PremiumCard variant="hero">
    {/* ... all content ... */}
  </PremiumCard>
)}
```

Change to:

```tsx
) : (
  <div
    data-testid="arena-card"
    className="relative overflow-hidden rounded-[22px] px-10 pt-14 pb-12 md:px-16"
    style={{
      background: [
        "radial-gradient(ellipse 400px 320px at 96% 12%, rgba(140,32,64,0.22) 0%, transparent 68%)",
        "radial-gradient(ellipse 300px 300px at 4% 88%, rgba(100,18,44,0.14) 0%, transparent 65%)",
        "linear-gradient(155deg, #0e0810 0%, #1c0a14 50%, #2e1222 100%)",
      ].join(", "),
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow:
        "0 0 100px -24px rgba(140,32,64,0.4), 0 32px 80px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
    }}
  >
    {/* grain texture */}
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.35,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    />
    <div className="relative z-10">
      {/* content goes here */}
    </div>
  </div>
)}
```

Keep all existing inner content inside `<div className="relative z-10">` for now — it will be replaced in subsequent steps.

- [ ] **Step 3.2: Replace the top section**

Inside `<div className="relative z-10">`, replace the old `<div className="text-center mb-6">` block (which contained the Play icon circle, h2, available_late banner, and description) with:

```tsx
{/* ── Top section ── */}
<div className="text-center mb-9">
  {/* Eyebrow */}
  <div
    className="inline-flex items-center gap-1.5 mb-3.5"
    style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}
  >
    <span className="w-1.5 h-1.5 rounded-full animate-blink" style={{ background: "hsl(345,65%,62%)" }} />
    Simulado #{simulado.sequenceNumber} · ENAMED 2026
  </div>

  {/* Headline */}
  <h2
    className="font-extrabold text-white text-center mb-3.5"
    style={{ fontSize: "52px", letterSpacing: "-0.045em", lineHeight: "0.95" }}
  >
    {isVeteran ? "Tudo" : "Pronto para"}
    <br />
    <em className="not-italic" style={{ color: "hsl(345,62%,65%)" }}>
      {isVeteran ? "pronto?" : "começar?"}
    </em>
  </h2>

  {/* Description — only for non-veterans */}
  {!isVeteran && (
    <p
      className="text-[15px] leading-relaxed max-w-[480px] mx-auto mb-6"
      style={{ color: "rgba(255,255,255,0.38)" }}
    >
      Confirme os itens abaixo antes de entrar. A prova não pode ser pausada.
    </p>
  )}

  {/* available_late info banner */}
  {simulado.status === "available_late" && (
    <div
      className="inline-flex items-start gap-3 px-4 py-3 rounded-xl mb-5 max-w-lg text-left"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <Sparkles
        className="h-4 w-4 shrink-0 mt-0.5"
        style={{ color: "hsl(345,65%,65%)" }}
        aria-hidden
      />
      <span className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
        Você faz agora o mesmo simulado completo da preparação nacional.{" "}
        <strong style={{ color: "rgba(255,255,255,0.8)" }}>
          Sua nota não entra no ranking nacional
        </strong>{" "}
        porque a janela oficial encerrou — resultado e gabarito seguem valendo para o seu estudo.
      </span>
    </div>
  )}

  {/* Meta chips */}
  <div className="flex items-center justify-center gap-2 flex-wrap">
    {[
      { icon: Clock, label: simulado.estimatedDuration },
      { icon: FileText, label: `${simulado.questionsCount} questões` },
      ...(simulado.status !== "available_late"
        ? [{ icon: Trophy, label: "Conta no ranking nacional" }]
        : []),
    ].map(({ icon: Icon, label }) => (
      <div
        key={label}
        className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.62)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3.3: Add horizontal divider after the top section**

```tsx
{/* Divider */}
<div
  className="w-full h-px mb-7"
  style={{
    background:
      "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)",
  }}
/>
```

- [ ] **Step 3.4: Run tests**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: no regressions. The dark card renders now so `data-testid="arena-card"` exists. Checklist tests still pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/pages/SimuladoDetailPage.tsx
git commit -m "feat(simulado-detail): dark arena card shell and top section"
```

---

## Task 4: Progress bar + checklist grid

**Files:**
- Modify: `src/pages/SimuladoDetailPage.tsx`

This step replaces the old `grid grid-cols-1 sm:grid-cols-2` checklist block and adds the progress bar before it. Keep it inside the `{(!isVeteran || showFullChecklist) && (...)}` conditional as before.

- [ ] **Step 4.1: Replace the old checklist block with progress bar + new grid**

Inside `{(!isVeteran || showFullChecklist) && ( <> ... </> )}`, replace everything between the `<>` tags with:

```tsx
{/* ── Progress bar ── */}
<div className="mb-5">
  <div className="flex items-center justify-between mb-2.5">
    <span
      className="text-[10px] font-bold uppercase tracking-[0.16em]"
      style={{ color: "rgba(255,255,255,0.3)" }}
    >
      Checklist de confirmação
    </span>
    <span
      className="text-[12px] font-bold tabular-nums"
      style={{ color: "rgba(255,255,255,0.4)" }}
    >
      <span style={{ color: "hsl(345,65%,65%)" }}>{checkedItems.size}</span>
      {" "}de {checklistItems.length} itens confirmados
    </span>
  </div>
  <div
    className="w-full h-[3px] rounded-full overflow-hidden"
    style={{ background: "rgba(255,255,255,0.08)" }}
  >
    <div
      className="h-full rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        width: `${checklistItems.length > 0 ? (checkedItems.size / checklistItems.length) * 100 : 0}%`,
        background: "linear-gradient(90deg, hsl(345,60%,38%), hsl(345,65%,58%))",
        boxShadow: "0 0 10px hsl(345 65% 52% / 0.55)",
      }}
    />
  </div>
</div>

{/* ── Checklist grid ── */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
  {checklistItems.map((item, index) => {
    const checked = checkedItems.has(item.key);
    const isLastOdd =
      checklistItems.length % 2 === 1 && index === checklistItems.length - 1;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => toggleCheck(item.key)}
        className={cn(
          "flex items-start gap-3.5 text-left transition-all duration-200 rounded-[14px]",
          "hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isLastOdd && "sm:col-span-2 sm:mx-auto sm:w-1/2"
        )}
        style={{
          padding: "18px 20px",
          background: checked ? "rgba(196,90,114,0.09)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${checked ? "rgba(196,90,114,0.3)" : "rgba(255,255,255,0.07)"}`,
        }}
      >
        {/* Icon */}
        <div
          className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{
            background: checked ? "rgba(196,90,114,0.16)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${checked ? "rgba(196,90,114,0.36)" : "rgba(255,255,255,0.08)"}`,
            color: checked ? "hsl(345,65%,72%)" : "rgba(255,255,255,0.5)",
          }}
        >
          <item.icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-bold leading-[1.2] mb-0.5 transition-colors"
            style={{ color: checked ? "#fff" : "rgba(255,255,255,0.72)" }}
          >
            {item.title}
          </p>
          <p
            className="text-[12px] leading-[1.4] transition-colors"
            style={{ color: checked ? "rgba(255,255,255,0.48)" : "rgba(255,255,255,0.3)" }}
          >
            {item.getDesc(simulado)}
          </p>
        </div>

        {/* Checkbox */}
        <div
          className="w-[18px] h-[18px] rounded-[6px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-all duration-200"
          style={{
            background: checked ? "hsl(345,65%,55%)" : "transparent",
            border: `1.5px solid ${checked ? "hsl(345,65%,55%)" : "rgba(255,255,255,0.18)"}`,
          }}
        >
          {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </div>
      </button>
    );
  })}
</div>
```

- [ ] **Step 4.2: Run tests**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: all checklist interaction tests now pass (renders items, toggle, counter, CTA enabled). The two CTA tests may still need the next task.

- [ ] **Step 4.3: Commit**

```bash
git add src/pages/SimuladoDetailPage.tsx
git commit -m "feat(simulado-detail): progress bar and dark checklist grid"
```

---

## Task 5: CTA button + footer

Replace the old CTA `<div className="text-center">` block that follows the checklist grid.

**Files:**
- Modify: `src/pages/SimuladoDetailPage.tsx`

- [ ] **Step 5.1: Replace the old CTA + hint block**

Inside `{(!isVeteran || showFullChecklist) && ( <> ... </> )}`, after the checklist grid, replace the old CTA block with:

```tsx
{/* ── CTA ── */}
<div className="text-center">
  <button
    type="button"
    onClick={() => navigate(`/simulados/${id}/prova`)}
    disabled={!isVeteran && !allChecked}
    className={cn(
      "inline-flex items-center gap-2.5 rounded-[14px] font-bold transition-all duration-300",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      isVeteran || allChecked ? "hover:-translate-y-0.5" : "cursor-not-allowed"
    )}
    style={{
      padding: "17px 56px",
      fontSize: "16px",
      letterSpacing: "0.02em",
      background:
        isVeteran || allChecked
          ? "linear-gradient(135deg, hsl(345,65%,38%) 0%, hsl(345,65%,26%) 100%)"
          : "rgba(255,255,255,0.06)",
      color: isVeteran || allChecked ? "#fff" : "rgba(255,255,255,0.25)",
      border: `1.5px solid ${isVeteran || allChecked ? "transparent" : "rgba(255,255,255,0.1)"}`,
      boxShadow:
        isVeteran || allChecked
          ? "0 10px 40px hsl(345 65% 32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
          : "none",
    }}
  >
    <Play className="h-4 w-4 fill-current" />
    Iniciar Simulado
  </button>
  <p
    className="text-[11.5px] mt-3 transition-colors"
    style={{
      color:
        isVeteran || allChecked ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)",
    }}
  >
    {isVeteran || allChecked
      ? "Tudo certo — boa prova! 🎯"
      : "Confirme todos os itens acima para continuar"}
  </p>
</div>
```

- [ ] **Step 5.2: Replace the old result footer**

Replace the old `<p className="text-caption text-muted-foreground text-center mt-6">` (which was inside PremiumCard) with:

```tsx
{/* ── Footer ── */}
<p
  className="text-center mt-6 uppercase tracking-[0.05em]"
  style={{ fontSize: "11px", color: "rgba(255,255,255,0.18)" }}
>
  Resultado liberado em {formatDate(simulado.resultsReleaseAt)}
</p>
```

Place this after the `{(!isVeteran || showFullChecklist) && (...)}` conditional, still inside `<div className="relative z-10">`.

- [ ] **Step 5.3: Run tests**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/pages/SimuladoDetailPage.tsx
git commit -m "feat(simulado-detail): dark arena CTA button and footer"
```

---

## Task 6: Veteran mode — dark compact row

Replace the old veteran compact row (`isVeteran && (...)` block) with dark-themed version.

**Files:**
- Modify: `src/pages/SimuladoDetailPage.tsx`

- [ ] **Step 6.1: Replace the veteran compact block**

Replace the current `{isVeteran && ( <div className="max-w-2xl mx-auto mb-6"> ... </div> )}` block with:

```tsx
{/* ── Veteran compact row ── */}
{isVeteran && (
  <div className="text-center mb-7">
    {/* Compact info pills */}
    <div
      className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-3 rounded-xl mb-5"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span
        className="flex items-center gap-1.5 text-[12px] font-semibold"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <Clock className="h-3.5 w-3.5" />
        {simulado.questionsCount} questões · {simulado.estimatedDuration}
      </span>
      <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
      <span
        className="flex items-center gap-1.5 text-[12px] font-semibold"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <Zap className="h-3.5 w-3.5" />
        Sem pausa
      </span>
      <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
      <span
        className="flex items-center gap-1.5 text-[12px] font-semibold"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Tela cheia
      </span>
    </div>

    {/* Veteran CTA — immediately active */}
    <div>
      <button
        type="button"
        onClick={() => navigate(`/simulados/${id}/prova`)}
        className="inline-flex items-center gap-2.5 rounded-[14px] font-bold transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          padding: "17px 56px",
          fontSize: "16px",
          letterSpacing: "0.02em",
          background: "linear-gradient(135deg, hsl(345,65%,38%) 0%, hsl(345,65%,26%) 100%)",
          color: "#fff",
          border: "1.5px solid transparent",
          boxShadow:
            "0 10px 40px hsl(345 65% 32% / 0.6), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        <Play className="h-4 w-4 fill-current" />
        Iniciar Simulado
      </button>
    </div>

    {/* Toggle to show/hide full checklist */}
    <button
      type="button"
      onClick={() => setShowFullChecklist((v) => !v)}
      className="text-[11px] mt-3 underline underline-offset-2 transition-colors"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      {showFullChecklist ? "ocultar detalhes ↑" : "ver detalhes ↓"}
    </button>
  </div>
)}
```

- [ ] **Step 6.2: Run all tests**

```bash
npm run test -- SimuladoDetailPage --reporter=verbose
```

Expected: all tests pass including veteran mode tests.

- [ ] **Step 6.3: Run the full test suite to check for regressions**

```bash
npm run test
```

Expected: all suites pass.

- [ ] **Step 6.4: Commit**

```bash
git add src/pages/SimuladoDetailPage.tsx
git commit -m "feat(simulado-detail): dark arena veteran compact mode"
```

---

## Task 7: Visual check + lint

- [ ] **Step 7.1: Run the dev server and visually verify the design**

```bash
npm run dev
```

Navigate to a simulado detail page (status: `available`, not started). Verify:
- Dark gradient card renders
- Eyebrow pulsing dot animates
- Chips show duration, questions, ranking
- Progress bar starts empty and fills wine as items are checked
- Each checked item gets wine icon tint and checkbox fill
- 5th item is centered in its own row
- CTA is locked (grey) until 5/5, then lights up with wine glow
- Hint text changes to "Tudo certo — boa prova! 🎯"
- Footer shows result release date in faint uppercase

Also verify veteran mode (user with a finished attempt): compact dark row + immediate CTA.

- [ ] **Step 7.2: Run lint**

```bash
npm run lint
```

Fix any errors before continuing. Common issues: unused imports (verify `AlertTriangle`, `Square`, `CheckSquare` are fully removed), `any` casts if TypeScript complains.

- [ ] **Step 7.3: Final commit**

```bash
git add -A
git commit -m "feat(simulado-detail): complete Dark Arena pre-exam redesign"
```
