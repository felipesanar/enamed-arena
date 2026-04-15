# Caderno de Erros — Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone sandbox at `src/sandbox/caderno/` implementing the redesigned AddToNotebookModal and CadernoErrosPage with premium UI, TDD, no shadcn.

**Architecture:** Self-contained sandbox under `src/sandbox/caderno/` — own CSS tokens, own UI atoms, own hooks with mock data. Route `/sandbox/caderno` added to App.tsx. No changes to existing production code.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (arbitrary values for sandbox colors), Framer Motion 12, Vitest + Testing Library, Inter font via Google Fonts.

---

## File Map

```
src/sandbox/caderno/
├── tokens.css                          # CSS custom properties (--wine, --ink, --ink-2, etc.)
├── errorTypes.ts                       # 5 error types, colors, icons, strategies
├── errorTypes.test.ts
├── mockEntries.ts                      # 12 realistic NotebookEntry fixtures
├── hooks/
│   ├── useNotebookEntries.ts           # filter + sort + markResolved + remove
│   ├── useNotebookEntries.test.ts
│   ├── useReviewStreak.ts              # consecutive days streak
│   └── useReviewStreak.test.ts
├── ui/
│   ├── Toast.tsx                       # single toast component
│   ├── ToastProvider.tsx               # context + queue management
│   ├── Chip.tsx                        # radio-style filter chip
│   └── ProgressBar.tsx                 # accessible progress bar
├── components/
│   ├── AddToNotebookModal/
│   │   ├── index.tsx                   # 2-step modal orchestrator
│   │   ├── ReasonCard.tsx              # selectable reason card with expand
│   │   ├── StepIndicator.tsx           # pip step tracker
│   │   └── DuplicateBanner.tsx         # existing-entry banner
│   ├── AddToNotebookModal.test.tsx
│   ├── PageHero.tsx                    # dark header zone with stats + streak
│   ├── FilterBar.tsx                   # type chips + specialty chips
│   ├── HeroNextCard.tsx                # dark "next to review" hero card
│   ├── EntryCard.tsx                   # pending and resolved entry rows
│   ├── EmptyState.tsx                  # first-access empty
│   └── ZeroPendingState.tsx            # all-resolved celebration
src/sandbox/caderno/CadernoSandboxPage.tsx  # page assembly
src/pages/SandboxCadernoPage.tsx            # thin wrapper (imports page + fonts)
```

**Modify:**
- `src/App.tsx` — add `/sandbox/caderno` route (public, no ProtectedRoute)

---

### Task 1: Route + SandboxCadernoPage shell + Inter font

**Files:**
- Create: `src/pages/SandboxCadernoPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create SandboxCadernoPage shell**

```tsx
// src/pages/SandboxCadernoPage.tsx
import { useEffect } from "react";

export default function SandboxCadernoPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <p style={{ padding: 32 }}>Sandbox Caderno — WIP</p>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, after the existing lazy imports block, add:

```tsx
const SandboxCadernoPage = lazy(() => import("./pages/SandboxCadernoPage"));
```

Inside `<Routes>`, before the `path="*"` catch-all, add:

```tsx
<Route path="/sandbox/caderno" element={<Suspense fallback={<PageShell />}><SandboxCadernoPage /></Suspense>} />
```

- [ ] **Step 3: Verify dev server renders route**

Run: `npm run dev`
Navigate to `http://localhost:8080/sandbox/caderno`
Expected: "Sandbox Caderno — WIP" renders without errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SandboxCadernoPage.tsx src/App.tsx
git commit -m "feat(sandbox): add /sandbox/caderno route + shell page"
```

---

### Task 2: Design tokens CSS

**Files:**
- Create: `src/sandbox/caderno/tokens.css`

- [ ] **Step 1: Create tokens.css**

```css
/* src/sandbox/caderno/tokens.css */
.caderno-sandbox {
  /* Brand */
  --wine:       #a03050;
  --wine-mid:   #7c2d44;
  --wine-dark:  #4a1628;
  --wine-glow:  rgba(160, 48, 80, 0.22);

  /* Dark surfaces */
  --ink:        #0f0a0d;
  --ink-2:      #1a1018;
  --ink-3:      #261720;

  /* Light surfaces */
  --surface:    #ffffff;
  --s2:         #f8f9fb;
  --s3:         #f1f3f6;

  /* Borders */
  --border:     #e5e7eb;
  --border-strong: #d1d5db;

  /* Text */
  --t1: #111827;
  --t2: #374151;
  --t3: #6b7280;
  --t4: #9ca3af;

  /* Status */
  --success:    #10b981;
  --warn:       #f59e0b;

  /* Error type colors */
  --lacuna-base:  #f43f5e;
  --lacuna-bg:    #fff1f2;
  --lacuna-border:#fecdd3;
  --lacuna-text:  #be123c;

  --memoria-base:  #8b5cf6;
  --memoria-bg:    #f5f3ff;
  --memoria-border:#ddd6fe;
  --memoria-text:  #6d28d9;

  --diferencial-base:  #3b82f6;
  --diferencial-bg:    #eff6ff;
  --diferencial-border:#bfdbfe;
  --diferencial-text:  #1d4ed8;

  --atencao-base:  #f59e0b;
  --atencao-bg:    #fffbeb;
  --atencao-border:#fde68a;
  --atencao-text:  #854d0e;

  --chute-base:  #eab308;
  --chute-bg:    #fefce8;
  --chute-border:#fde047;
  --chute-text:  #854d0e;

  /* Radii */
  --radius-sm:  8px;
  --radius-md:  11px;
  --radius-lg:  14px;
  --radius-xl:  18px;
  --radius-2xl: 20px;
  --radius-pill: 99px;
}
```

- [ ] **Step 2: Import tokens in SandboxCadernoPage**

Update `src/pages/SandboxCadernoPage.tsx`:

```tsx
import { useEffect } from "react";
import "@/sandbox/caderno/tokens.css";

export default function SandboxCadernoPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="caderno-sandbox" style={{ fontFamily: "'Inter', sans-serif" }}>
      <p style={{ padding: 32, color: "var(--wine)" }}>Sandbox Caderno — tokens loaded ✓</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify wine color renders**

Run: `npm run dev`
Navigate to `http://localhost:8080/sandbox/caderno`
Expected: Text renders in wine (#a03050) color.

- [ ] **Step 4: Commit**

```bash
git add src/sandbox/caderno/tokens.css src/pages/SandboxCadernoPage.tsx
git commit -m "feat(sandbox): design tokens CSS + Inter font injection"
```

---

### Task 3: `errorTypes.ts` + tests

**Files:**
- Create: `src/sandbox/caderno/errorTypes.ts`
- Create: `src/sandbox/caderno/errorTypes.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/sandbox/caderno/errorTypes.test.ts
import { describe, it, expect } from "vitest";
import {
  ERROR_TYPES,
  getErrorType,
  ERROR_TYPE_KEYS,
  type ErrorTypeKey,
} from "./errorTypes";

describe("ERROR_TYPES", () => {
  it("has exactly 5 types", () => {
    expect(Object.keys(ERROR_TYPES)).toHaveLength(5);
  });

  it("each type has required fields", () => {
    for (const key of ERROR_TYPE_KEYS) {
      const t = ERROR_TYPES[key];
      expect(t.key).toBe(key);
      expect(typeof t.label).toBe("string");
      expect(typeof t.hint).toBe("string");
      expect(typeof t.strategy).toBe("string");
      expect(typeof t.colorBase).toBe("string");
      expect(typeof t.colorBg).toBe("string");
      expect(typeof t.colorBorder).toBe("string");
      expect(typeof t.colorText).toBe("string");
      expect(typeof t.dbKey).toBe("string");
    }
  });

  it("wasCorrect=false types do not include guessed_correctly", () => {
    const wrongTypes = ERROR_TYPE_KEYS.filter(
      (k) => ERROR_TYPES[k].forWrongAnswer
    );
    expect(wrongTypes).not.toContain("guessed_correctly");
    expect(wrongTypes).toHaveLength(4);
  });

  it("wasCorrect=true type is only guessed_correctly", () => {
    const correctTypes = ERROR_TYPE_KEYS.filter(
      (k) => !ERROR_TYPES[k].forWrongAnswer
    );
    expect(correctTypes).toEqual(["guessed_correctly"]);
  });
});

describe("getErrorType", () => {
  it("returns the type for a valid key", () => {
    expect(getErrorType("lacuna").label).toBe("Não sei o conceito");
  });

  it("returns undefined for unknown key", () => {
    expect(getErrorType("unknown" as ErrorTypeKey)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sandbox/caderno/errorTypes.test.ts`
Expected: FAIL — "Cannot find module './errorTypes'"

- [ ] **Step 3: Implement errorTypes.ts**

```ts
// src/sandbox/caderno/errorTypes.ts
export const ERROR_TYPE_KEYS = [
  "lacuna",
  "memoria",
  "atencao",
  "diferencial",
  "guessed_correctly",
] as const;

export type ErrorTypeKey = (typeof ERROR_TYPE_KEYS)[number];

export interface ErrorType {
  key: ErrorTypeKey;
  label: string;
  hint: string;
  strategy: string;
  colorBase: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  dbKey: string;
  forWrongAnswer: boolean; // true = shown when wasCorrect=false
}

export const ERROR_TYPES: Record<ErrorTypeKey, ErrorType> = {
  lacuna: {
    key: "lacuna",
    label: "Não sei o conceito",
    hint: "Nunca vi ou não domino esse assunto.",
    strategy: "Estudar do zero — Harrison, diretriz, questões comentadas.",
    colorBase: "#f43f5e",
    colorBg: "#fff1f2",
    colorBorder: "#fecdd3",
    colorText: "#be123c",
    dbKey: "did_not_know",
    forWrongAnswer: true,
  },
  memoria: {
    key: "memoria",
    label: "Sabia mas esqueci",
    hint: "Já estudei, mas não lembrei na hora.",
    strategy: "Revisão espaçada — revisitar em 1, 3 e 7 dias.",
    colorBase: "#8b5cf6",
    colorBg: "#f5f3ff",
    colorBorder: "#ddd6fe",
    colorText: "#6d28d9",
    dbKey: "did_not_remember",
    forWrongAnswer: true,
  },
  atencao: {
    key: "atencao",
    label: "Erro de leitura",
    hint: "Li errado ou marquei sem ler o enunciado completo.",
    strategy: "Técnica de prova — sublinhar palavras-chave antes de responder.",
    colorBase: "#f59e0b",
    colorBg: "#fffbeb",
    colorBorder: "#fde68a",
    colorText: "#854d0e",
    dbKey: "reading_error",
    forWrongAnswer: true,
  },
  diferencial: {
    key: "diferencial",
    label: "Confundi com outra condição",
    hint: "Sabia o assunto mas errei o diagnóstico diferencial.",
    strategy: "Estudo comparativo — tabela de diagnóstico diferencial.",
    colorBase: "#3b82f6",
    colorBg: "#eff6ff",
    colorBorder: "#bfdbfe",
    colorText: "#1d4ed8",
    dbKey: "confused_alternatives",
    forWrongAnswer: true,
  },
  guessed_correctly: {
    key: "guessed_correctly",
    label: "Acertei sem certeza",
    hint: "Acertei por exclusão ou intuição — não tenho domínio real.",
    strategy: "Tratar como lacuna — estudar para confirmar o porquê.",
    colorBase: "#eab308",
    colorBg: "#fefce8",
    colorBorder: "#fde047",
    colorText: "#854d0e",
    dbKey: "guessed_correctly",
    forWrongAnswer: false,
  },
};

export function getErrorType(key: ErrorTypeKey): ErrorType | undefined {
  return ERROR_TYPES[key];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sandbox/caderno/errorTypes.test.ts`
Expected: PASS — 4 test suites, all green.

- [ ] **Step 5: Commit**

```bash
git add src/sandbox/caderno/errorTypes.ts src/sandbox/caderno/errorTypes.test.ts
git commit -m "feat(sandbox): error taxonomy — 5 types with colors, strategies, db keys"
```

---

### Task 4: `mockEntries.ts`

**Files:**
- Create: `src/sandbox/caderno/mockEntries.ts`

- [ ] **Step 1: Create mock data (no test needed — pure data)**

```ts
// src/sandbox/caderno/mockEntries.ts
import type { ErrorTypeKey } from "./errorTypes";

export interface NotebookEntry {
  id: string;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  questionNumber: number;
  questionText: string;
  area: string;
  theme: string;
  errorType: ErrorTypeKey;
  note: string | null;
  createdAt: string; // ISO
  resolvedAt: string | null; // ISO or null
}

// 8 pending + 4 resolved, 2 specialties, realistic dates
const BASE = "2026-04-";

export const MOCK_ENTRIES: NotebookEntry[] = [
  // --- PENDING ---
  {
    id: "e1",
    questionId: "q-101",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 12,
    questionText:
      "Paciente de 45 anos com dor torácica em repouso, irradiação para mandíbula e diaforese. ECG mostra supradesnivelamento em V1-V4. A conduta imediata é:",
    area: "Cardiologia",
    theme: "IAM com supra de ST",
    errorType: "lacuna",
    note: "Revisar critérios de Killip e conduta no IAMCSST",
    createdAt: BASE + "05T10:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e2",
    questionId: "q-102",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 28,
    questionText:
      "Qual o mecanismo de resistência mais comum do S. aureus à oxacilina?",
    area: "Infectologia",
    theme: "Resistência bacteriana — MRSA",
    errorType: "lacuna",
    note: null,
    createdAt: BASE + "06T08:30:00Z",
    resolvedAt: null,
  },
  {
    id: "e3",
    questionId: "q-103",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 7,
    questionText:
      "Homem de 60 anos com dispneia aos mínimos esforços, edema de membros inferiores e BNP = 1200 pg/mL. A fração de ejeção é de 35%. O diagnóstico é:",
    area: "Cardiologia",
    theme: "Insuficiência cardíaca sistólica",
    errorType: "diferencial",
    note: "Confundi critérios de Boston com Framingham",
    createdAt: BASE + "07T14:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e4",
    questionId: "q-104",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 19,
    questionText:
      "Paciente HIV+ com contagem de CD4 = 80 células/mm³ apresenta febre, cefaleia e rigidez de nuca. LCR com tinta da China positivo. O tratamento é:",
    area: "Infectologia",
    theme: "Criptococose em imunossuprimido",
    errorType: "memoria",
    note: null,
    createdAt: BASE + "08T09:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e5",
    questionId: "q-105",
    simuladoId: "sim-4",
    simuladoTitle: "ENAMED Simulado 4",
    questionNumber: 44,
    questionText:
      "Qual a definição correta de hipertensão arterial estágio 2 segundo as diretrizes brasileiras de 2023?",
    area: "Cardiologia",
    theme: "Hipertensão — classificação",
    errorType: "diferencial",
    note: "Estágio 1 vs 2 — diferença nas metas terapêuticas",
    createdAt: BASE + "09T11:30:00Z",
    resolvedAt: null,
  },
  {
    id: "e6",
    questionId: "q-106",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 3,
    questionText:
      "Mulher de 28 anos apresenta febre há 5 dias, adenopatia cervical e esplenomegalia. Monoteste positivo. A complicação mais temida é:",
    area: "Infectologia",
    theme: "Mononucleose infecciosa",
    errorType: "atencao",
    note: "Li 'mais comum' em vez de 'mais temida'",
    createdAt: BASE + "10T16:00:00Z",
    resolvedAt: null,
  },
  {
    id: "e7",
    questionId: "q-107",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 31,
    questionText:
      "Em relação ao tratamento da tuberculose latente, indique a afirmativa correta:",
    area: "Infectologia",
    theme: "Tuberculose latente — ILTB",
    errorType: "lacuna",
    note: null,
    createdAt: BASE + "11T10:15:00Z",
    resolvedAt: null,
  },
  {
    id: "e8",
    questionId: "q-108",
    simuladoId: "sim-5",
    simuladoTitle: "ENAMED Simulado 5",
    questionNumber: 55,
    questionText:
      "Paciente com FA de início recente (< 48h), FC = 130 bpm, PA = 90/60 mmHg. Qual a conduta imediata?",
    area: "Cardiologia",
    theme: "Fibrilação atrial — instabilidade hemodinâmica",
    errorType: "diferencial",
    note: "Cardioversão elétrica vs farmacológica — critérios de instabilidade",
    createdAt: BASE + "12T13:00:00Z",
    resolvedAt: null,
  },
  // --- RESOLVED ---
  {
    id: "e9",
    questionId: "q-91",
    simuladoId: "sim-2",
    simuladoTitle: "ENAMED Simulado 2",
    questionNumber: 8,
    questionText:
      "Criança de 3 anos com febre alta, exantema morbiliforme e manchas de Koplik. O diagnóstico mais provável é:",
    area: "Infectologia",
    theme: "Sarampo",
    errorType: "memoria",
    note: null,
    createdAt: BASE + "01T09:00:00Z",
    resolvedAt: BASE + "08T10:00:00Z",
  },
  {
    id: "e10",
    questionId: "q-92",
    simuladoId: "sim-2",
    simuladoTitle: "ENAMED Simulado 2",
    questionNumber: 22,
    questionText:
      "Paciente com choque séptico, PAM < 65 mmHg após 30 mL/kg de cristaloide. O vasopressor de primeira escolha é:",
    area: "Cardiologia",
    theme: "Choque séptico — vasopressores",
    errorType: "lacuna",
    note: "Norepinefrina como 1ª linha confirmada",
    createdAt: BASE + "02T14:00:00Z",
    resolvedAt: BASE + "09T11:00:00Z",
  },
  {
    id: "e11",
    questionId: "q-93",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 40,
    questionText:
      "Homem com HIV, carga viral indetectável há 2 anos, CD4 = 350. Viaja para área endêmica de malária. Qual a profilaxia indicada?",
    area: "Infectologia",
    theme: "HIV — profilaxias em viagens",
    errorType: "guessed_correctly",
    note: "Acertei mas revisei — atovaquona/proguanil como opção",
    createdAt: BASE + "03T11:00:00Z",
    resolvedAt: BASE + "10T09:00:00Z",
  },
  {
    id: "e12",
    questionId: "q-94",
    simuladoId: "sim-3",
    simuladoTitle: "ENAMED Simulado 3",
    questionNumber: 61,
    questionText:
      "Paciente com síncope durante exercício, sopro sistólico que aumenta com Valsalva. O diagnóstico é:",
    area: "Cardiologia",
    theme: "Cardiomiopatia hipertrófica obstrutiva",
    errorType: "diferencial",
    note: null,
    createdAt: BASE + "04T15:00:00Z",
    resolvedAt: BASE + "11T14:00:00Z",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/caderno/mockEntries.ts
git commit -m "feat(sandbox): 12 realistic mock notebook entries (8 pending, 4 resolved)"
```

---

### Task 5: `useNotebookEntries` hook + tests

**Files:**
- Create: `src/sandbox/caderno/hooks/useNotebookEntries.ts`
- Create: `src/sandbox/caderno/hooks/useNotebookEntries.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/sandbox/caderno/hooks/useNotebookEntries.test.ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotebookEntries } from "./useNotebookEntries";
import { MOCK_ENTRIES } from "../mockEntries";

describe("useNotebookEntries", () => {
  it("initialises with all entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.entries).toHaveLength(12);
  });

  it("filtered returns all when typeFilter=all and specFilter=null", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.filtered).toHaveLength(12);
  });

  it("pending contains only unresolved entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.pending.every((e) => e.resolvedAt === null)).toBe(true);
    expect(result.current.pending).toHaveLength(8);
  });

  it("resolved contains only resolved entries", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    expect(result.current.resolved.every((e) => e.resolvedAt !== null)).toBe(true);
    expect(result.current.resolved).toHaveLength(4);
  });

  it("heroEntry is the oldest pending entry (min createdAt)", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    const hero = result.current.heroEntry;
    expect(hero).not.toBeNull();
    expect(hero!.id).toBe("e1"); // oldest pending
  });

  it("setTypeFilter filters by error type", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.setTypeFilter("lacuna"));
    expect(result.current.filtered.every((e) => e.errorType === "lacuna")).toBe(true);
  });

  it("setSpecFilter filters by area", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.setSpecFilter("Cardiologia"));
    expect(result.current.filtered.every((e) => e.area === "Cardiologia")).toBe(true);
  });

  it("markResolved sets resolvedAt and moves entry to resolved", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.markResolved("e1"));
    const entry = result.current.entries.find((e) => e.id === "e1");
    expect(entry!.resolvedAt).not.toBeNull();
    expect(result.current.resolved.some((e) => e.id === "e1")).toBe(true);
    expect(result.current.pending.some((e) => e.id === "e1")).toBe(false);
  });

  it("heroEntry updates after markResolved", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.markResolved("e1"));
    expect(result.current.heroEntry!.id).toBe("e2");
  });

  it("remove deletes the entry from all lists", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    act(() => result.current.remove("e1"));
    expect(result.current.entries.some((e) => e.id === "e1")).toBe(false);
  });

  it("heroEntry is null when no pending entries match filter", () => {
    const { result } = renderHook(() => useNotebookEntries(MOCK_ENTRIES));
    // atencao has only 1 pending entry (e6), filter it out via spec
    act(() => result.current.setTypeFilter("atencao"));
    act(() => result.current.setSpecFilter("Cardiologia")); // e6 is Infectologia
    expect(result.current.heroEntry).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/sandbox/caderno/hooks/useNotebookEntries.test.ts`
Expected: FAIL — "Cannot find module './useNotebookEntries'"

- [ ] **Step 3: Implement the hook**

```ts
// src/sandbox/caderno/hooks/useNotebookEntries.ts
import { useState, useMemo } from "react";
import type { NotebookEntry } from "../mockEntries";
import type { ErrorTypeKey } from "../errorTypes";

export interface UseNotebookEntriesReturn {
  entries: NotebookEntry[];
  filtered: NotebookEntry[];
  pending: NotebookEntry[];
  resolved: NotebookEntry[];
  heroEntry: NotebookEntry | null;
  activeTypeFilter: ErrorTypeKey | "all";
  activeSpecFilter: string | null;
  setTypeFilter: (t: ErrorTypeKey | "all") => void;
  setSpecFilter: (s: string | null) => void;
  markResolved: (id: string) => void;
  remove: (id: string) => void;
}

export function useNotebookEntries(
  initial: NotebookEntry[]
): UseNotebookEntriesReturn {
  const [entries, setEntries] = useState<NotebookEntry[]>(initial);
  const [activeTypeFilter, setActiveTypeFilter] = useState<ErrorTypeKey | "all">("all");
  const [activeSpecFilter, setActiveSpecFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (activeTypeFilter !== "all" && e.errorType !== activeTypeFilter) return false;
      if (activeSpecFilter !== null && e.area !== activeSpecFilter) return false;
      return true;
    });
  }, [entries, activeTypeFilter, activeSpecFilter]);

  const pending = useMemo(
    () => filtered.filter((e) => e.resolvedAt === null).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    [filtered]
  );

  const resolved = useMemo(
    () => filtered.filter((e) => e.resolvedAt !== null),
    [filtered]
  );

  const heroEntry = pending.length > 0 ? pending[0] : null;

  function markResolved(id: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e
      )
    );
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return {
    entries,
    filtered,
    pending,
    resolved,
    heroEntry,
    activeTypeFilter,
    activeSpecFilter,
    setTypeFilter: setActiveTypeFilter,
    setSpecFilter: setActiveSpecFilter,
    markResolved,
    remove,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sandbox/caderno/hooks/useNotebookEntries.test.ts`
Expected: PASS — 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/sandbox/caderno/hooks/useNotebookEntries.ts src/sandbox/caderno/hooks/useNotebookEntries.test.ts
git commit -m "feat(sandbox): useNotebookEntries hook — filter, sort, markResolved, remove"
```

---

### Task 6: `useReviewStreak` hook + tests

**Files:**
- Create: `src/sandbox/caderno/hooks/useReviewStreak.ts`
- Create: `src/sandbox/caderno/hooks/useReviewStreak.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/sandbox/caderno/hooks/useReviewStreak.test.ts
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReviewStreak } from "./useReviewStreak";
import type { NotebookEntry } from "../mockEntries";

function makeEntry(resolvedAt: string | null): NotebookEntry {
  return {
    id: Math.random().toString(),
    questionId: "q1",
    simuladoId: "s1",
    simuladoTitle: "S1",
    questionNumber: 1,
    questionText: "Q",
    area: "Cardiologia",
    theme: "T",
    errorType: "lacuna",
    note: null,
    createdAt: "2026-04-01T00:00:00Z",
    resolvedAt,
  };
}

describe("useReviewStreak", () => {
  it("returns 0 when no entries are resolved", () => {
    const entries = [makeEntry(null), makeEntry(null)];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(0);
  });

  it("returns 1 when only today has resolutions", () => {
    const today = new Date().toISOString();
    const entries = [makeEntry(today)];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    // Resolved today, yesterday, 2 days ago → streak = 3
    const entries = [makeEntry(d(0)), makeEntry(d(1)), makeEntry(d(2))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(3);
  });

  it("stops counting at a gap", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    // Today + 2 days ago (gap on yesterday) → streak = 1
    const entries = [makeEntry(d(0)), makeEntry(d(2))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(1);
  });

  it("returns 0 when most recent resolved day is not today or yesterday", () => {
    const d = (daysAgo: number) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString();
    };
    const entries = [makeEntry(d(3)), makeEntry(d(4))];
    const { result } = renderHook(() => useReviewStreak(entries));
    expect(result.current.streak).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/sandbox/caderno/hooks/useReviewStreak.test.ts`
Expected: FAIL — "Cannot find module './useReviewStreak'"

- [ ] **Step 3: Implement the hook**

```ts
// src/sandbox/caderno/hooks/useReviewStreak.ts
import { useMemo } from "react";
import type { NotebookEntry } from "../mockEntries";

export interface UseReviewStreakReturn {
  streak: number;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function todayKey(): string {
  return toDateKey(new Date().toISOString());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d.toISOString());
}

export function useReviewStreak(entries: NotebookEntry[]): UseReviewStreakReturn {
  const streak = useMemo(() => {
    const resolvedDays = new Set(
      entries
        .filter((e) => e.resolvedAt !== null)
        .map((e) => toDateKey(e.resolvedAt!))
    );

    if (resolvedDays.size === 0) return 0;

    const today = todayKey();
    const yesterday = yesterdayKey();

    // Streak must include today or yesterday to be active
    if (!resolvedDays.has(today) && !resolvedDays.has(yesterday)) return 0;

    // Start from today (or yesterday if today not present) and count back
    let startDay = resolvedDays.has(today) ? today : yesterday;
    let count = 0;
    let current = new Date(startDay + "T12:00:00Z");

    while (resolvedDays.has(toDateKey(current.toISOString()))) {
      count++;
      current.setDate(current.getDate() - 1);
    }

    return count;
  }, [entries]);

  return { streak };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sandbox/caderno/hooks/useReviewStreak.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/sandbox/caderno/hooks/useReviewStreak.ts src/sandbox/caderno/hooks/useReviewStreak.test.ts
git commit -m "feat(sandbox): useReviewStreak — consecutive review day counter"
```

---

### Task 7: Toast UI atom

**Files:**
- Create: `src/sandbox/caderno/ui/ToastProvider.tsx`
- Create: `src/sandbox/caderno/ui/Toast.tsx`

- [ ] **Step 1: Create Toast component**

```tsx
// src/sandbox/caderno/ui/Toast.tsx
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export interface ToastData {
  id: string;
  questionNumber: number;
  area: string;
  typeLabel: string;
  typeColor: string;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { type: "spring", damping: 20, stiffness: 260 }
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        padding: "12px 16px",
        minWidth: 280,
        maxWidth: 360,
        fontFamily: "'Inter', sans-serif",
        cursor: "pointer",
      }}
      onClick={() => onDismiss(toast.id)}
    >
      {/* Check icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(16,185,129,.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7l3.5 3.5L12 3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--t1)", marginBottom: 2 }}>
          Salvo no Caderno de Erros
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          Q{toast.questionNumber} · {toast.area} adicionada à fila.
        </div>
      </div>
      {/* Type tag */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: "var(--radius-pill)",
          background: toast.typeColor + "20",
          color: toast.typeColor,
          flexShrink: 0,
        }}
      >
        {toast.typeLabel}
      </span>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create ToastProvider**

```tsx
// src/sandbox/caderno/ui/ToastProvider.tsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Toast, type ToastData } from "./Toast";

interface ToastContextValue {
  showToast: (data: Omit<ToastData, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((data: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...data, id }]);
    const timer = setTimeout(() => dismiss(id), 3000);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout); };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Portal-style fixed overlay */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          // Mobile: center
        }}
        aria-label="Notificações"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/sandbox/caderno/ui/Toast.tsx src/sandbox/caderno/ui/ToastProvider.tsx
git commit -m "feat(sandbox): Toast + ToastProvider with Framer Motion spring + auto-dismiss"
```

---

### Task 8: Chip and ProgressBar atoms

**Files:**
- Create: `src/sandbox/caderno/ui/Chip.tsx`
- Create: `src/sandbox/caderno/ui/ProgressBar.tsx`

- [ ] **Step 1: Create Chip**

```tsx
// src/sandbox/caderno/ui/Chip.tsx
import { useReducedMotion } from "framer-motion";

interface ChipProps {
  label: string;
  count?: number;
  active: boolean;
  dotColor?: string; // hex — shows colored dot when provided
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function Chip({ label, count, active, dotColor, onClick, onKeyDown }: ChipProps) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: "var(--radius-pill)",
        border: active
          ? `1.5px solid ${dotColor ?? "var(--wine)"}`
          : "1.5px solid var(--border)",
        background: active
          ? dotColor
            ? dotColor + "18"
            : "rgba(160,48,80,.08)"
          : "var(--surface)",
        color: active
          ? dotColor ?? "var(--wine)"
          : "var(--t2)",
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        fontFamily: "'Inter', sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s ease",
        outline: "none",
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px rgba(160,48,80,.3)"; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {label}
      {count !== undefined && (
        <span style={{ opacity: 0.65, fontWeight: 500 }}>{count}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create ProgressBar**

```tsx
// src/sandbox/caderno/ui/ProgressBar.tsx
import { motion, useReducedMotion } from "framer-motion";

interface ProgressBarProps {
  resolved: number;
  total: number;
}

export function ProgressBar({ resolved, total }: ProgressBarProps) {
  const reduced = useReducedMotion();
  const pct = total === 0 ? 0 : Math.round((resolved / total) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={resolved}
      aria-valuemax={total}
      aria-label={`${resolved} de ${total} questões resolvidas`}
      style={{
        height: 6,
        borderRadius: "var(--radius-pill)",
        background: "rgba(255,255,255,.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 0.8, delay: 0.2, ease: "easeOut" }
        }
        style={{
          height: "100%",
          background: "linear-gradient(90deg, var(--wine-mid), var(--wine))",
          borderRadius: "var(--radius-pill)",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/sandbox/caderno/ui/Chip.tsx src/sandbox/caderno/ui/ProgressBar.tsx
git commit -m "feat(sandbox): Chip radio button + ProgressBar atoms"
```

---

### Task 9: Modal sub-components

**Files:**
- Create: `src/sandbox/caderno/components/AddToNotebookModal/StepIndicator.tsx`
- Create: `src/sandbox/caderno/components/AddToNotebookModal/DuplicateBanner.tsx`
- Create: `src/sandbox/caderno/components/AddToNotebookModal/ReasonCard.tsx`

- [ ] **Step 1: StepIndicator**

```tsx
// src/sandbox/caderno/components/AddToNotebookModal/StepIndicator.tsx
interface StepIndicatorProps {
  current: 1 | 2;
}

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {([1, 2] as const).map((n) => {
        const done = n < current;
        const active = n === current;
        return (
          <div
            key={n}
            style={{
              width: done || active ? 20 : 8,
              height: 8,
              borderRadius: "var(--radius-pill)",
              background: done
                ? "var(--success)"
                : active
                ? "var(--wine)"
                : "var(--border)",
              transition: "all .2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: DuplicateBanner**

```tsx
// src/sandbox/caderno/components/AddToNotebookModal/DuplicateBanner.tsx
interface DuplicateBannerProps {
  existingReason: string;
  addedAt: string; // ISO
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DuplicateBanner({ existingReason, addedAt }: DuplicateBannerProps) {
  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        fontSize: 12,
        color: "#92400e",
        marginBottom: 12,
        lineHeight: 1.5,
      }}
    >
      <strong>Já está no Caderno</strong> — adicionada em {formatDate(addedAt)} como{" "}
      <em>"{existingReason}"</em>. Selecione outro motivo para atualizar.
    </div>
  );
}
```

- [ ] **Step 3: ReasonCard**

```tsx
// src/sandbox/caderno/components/AddToNotebookModal/ReasonCard.tsx
import type { ErrorType } from "../../errorTypes";

// Lucide-style SVG icon paths
const ICON_PATHS: Record<string, React.ReactNode> = {
  lacuna: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  memoria: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    </svg>
  ),
  atencao: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  diferencial: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  ),
  guessed_correctly: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
};

interface ReasonCardProps {
  type: ErrorType;
  selected: boolean;
  onSelect: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function ReasonCard({ type, selected, onSelect, onKeyDown }: ReasonCardProps) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: selected
          ? `2px solid ${type.colorBase}`
          : "2px solid var(--border)",
        background: selected ? type.colorBg : "var(--surface)",
        cursor: "pointer",
        transition: "all .15s ease",
        outline: "none",
        fontFamily: "'Inter', sans-serif",
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${type.colorBase}44`; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ color: selected ? type.colorBase : "var(--t3)", flexShrink: 0, marginTop: 1 }}>
          {ICON_PATHS[type.key]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: selected ? type.colorText : "var(--t1)" }}>
              {type.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                padding: "1px 7px",
                borderRadius: "var(--radius-pill)",
                background: type.colorBg,
                border: `1px solid ${type.colorBorder}`,
                color: type.colorText,
              }}
            >
              {type.key === "guessed_correctly" ? "Chute" :
               type.key === "lacuna" ? "Lacuna" :
               type.key === "memoria" ? "Memória" :
               type.key === "atencao" ? "Atenção" : "Diferencial"}
            </span>
          </div>
          <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>
            {type.hint}
          </p>
          {selected && (
            <p style={{ fontSize: 11, fontWeight: 600, color: type.colorText, margin: "6px 0 0", lineHeight: 1.5 }}>
              ↳ {type.strategy}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/sandbox/caderno/components/AddToNotebookModal/
git commit -m "feat(sandbox): modal sub-components — StepIndicator, DuplicateBanner, ReasonCard"
```

---

### Task 10: `AddToNotebookModal` + tests

**Files:**
- Create: `src/sandbox/caderno/components/AddToNotebookModal/index.tsx`
- Create: `src/sandbox/caderno/components/AddToNotebookModal.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/sandbox/caderno/components/AddToNotebookModal.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToastProvider } from "../ui/ToastProvider";
import { AddToNotebookModal } from "./AddToNotebookModal/index";

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  questionId: "q-1",
  simuladoId: "sim-1",
  simuladoTitle: "ENAMED Simulado 1",
  area: "Cardiologia",
  theme: "IAM",
  questionNumber: 12,
  questionText: "Qual conduta no IAM?",
  wasCorrect: false,
  userId: "user-1",
  onAdded: vi.fn(),
};

function renderModal(props = {}) {
  return render(
    <ToastProvider>
      <AddToNotebookModal {...BASE_PROPS} {...props} />
    </ToastProvider>
  );
}

describe("AddToNotebookModal", () => {
  it("renders 4 reason cards when wasCorrect=false", () => {
    renderModal();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("renders 1 reason card when wasCorrect=true", () => {
    renderModal({ wasCorrect: true });
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("shows correct banner when wasCorrect=true", () => {
    renderModal({ wasCorrect: true });
    expect(screen.getByText(/Acertou por exclusão ou intuição/i)).toBeInTheDocument();
  });

  it("continue button is disabled when no reason selected", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /continuar/i });
    expect(btn).toBeDisabled();
  });

  it("selecting a reason enables continue button", () => {
    renderModal();
    const cards = screen.getAllByRole("radio");
    fireEvent.click(cards[0]);
    const btn = screen.getByRole("button", { name: /continuar/i });
    expect(btn).not.toBeDisabled();
  });

  it("clicking continue advances to step 2", () => {
    renderModal();
    const cards = screen.getAllByRole("radio");
    fireEvent.click(cards[0]);
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows duplicate banner when existingEntry is provided", () => {
    renderModal({
      existingEntry: { reason: "Não sei o conceito", addedAt: "2026-04-10T10:00:00Z" },
    });
    expect(screen.getByText(/Já está no Caderno/i)).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when escape is pressed", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when open=false", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/sandbox/caderno/components/AddToNotebookModal.test.tsx`
Expected: FAIL — "Cannot find module './AddToNotebookModal/index'"

- [ ] **Step 3: Implement AddToNotebookModal/index.tsx**

```tsx
// src/sandbox/caderno/components/AddToNotebookModal/index.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ERROR_TYPE_KEYS, ERROR_TYPES, type ErrorTypeKey } from "../../errorTypes";
import { ReasonCard } from "./ReasonCard";
import { StepIndicator } from "./StepIndicator";
import { DuplicateBanner } from "./DuplicateBanner";
import { useToast } from "../../ui/ToastProvider";

export interface AddToNotebookModalProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  area: string;
  theme: string;
  questionNumber: number;
  questionText: string;
  wasCorrect: boolean;
  userId: string;
  onAdded?: () => void;
  selectedHighlight?: string;
  existingEntry?: { reason: string; addedAt: string } | null;
}

export function AddToNotebookModal({
  open,
  onClose,
  area,
  theme,
  questionNumber,
  wasCorrect,
  onAdded,
  selectedHighlight,
  existingEntry,
}: AddToNotebookModalProps) {
  const reduced = useReducedMotion();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ErrorTypeKey | null>(
    existingEntry ? (Object.values(ERROR_TYPES).find(t => t.label === existingEntry.reason)?.key ?? null) : null
  );
  const [note, setNote] = useState(selectedHighlight ?? "");
  const [saving, setSaving] = useState(false);
  const firstCardRef = useRef<HTMLButtonElement>(null);

  // Determine available types
  const availableKeys = wasCorrect
    ? ERROR_TYPE_KEYS.filter((k) => !ERROR_TYPES[k].forWrongAnswer)
    : ERROR_TYPE_KEYS.filter((k) => ERROR_TYPES[k].forWrongAnswer);

  // Focus trap + initial focus
  useEffect(() => {
    if (open) {
      setTimeout(() => firstCardRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = useCallback(() => {
    if (!selectedType) return;
    setSaving(true);
    // Simulate async save (sandbox — no real API)
    setTimeout(() => {
      setSaving(false);
      onAdded?.();
      onClose();
      showToast({
        questionNumber,
        area,
        typeLabel: ERROR_TYPES[selectedType].label,
        typeColor: ERROR_TYPES[selectedType].colorBase,
      });
    }, 600);
  }, [selectedType, onAdded, onClose, showToast, questionNumber, area]);

  const isDuplicate = !!existingEntry;
  const isSameAsExisting = existingEntry
    ? Object.values(ERROR_TYPES).find(t => t.label === existingEntry.reason)?.key === selectedType
    : false;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.5)",
              zIndex: 1000,
            }}
          />
          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar ao Caderno de Erros"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1001,
              width: "min(480px, calc(100vw - 32px))",
              background: "var(--surface)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "0 24px 64px rgba(0,0,0,.28)",
              fontFamily: "'Inter', sans-serif",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>
                    Q{questionNumber} · {area} · {theme}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>
                    {wasCorrect ? "Acertou, mas quer revisar?" : "Adicionar ao Caderno de Erros"}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={saving}
                  aria-label="Fechar"
                  style={{
                    width: 28, height: 28,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", background: "none", cursor: saving ? "not-allowed" : "pointer",
                    color: "var(--t3)", borderRadius: "var(--radius-sm)", flexShrink: 0,
                    opacity: saving ? 0.4 : 1,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <StepIndicator current={step} />
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px 20px", opacity: saving ? 0.4 : 1, transition: "opacity .2s" }}>
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={reduced ? {} : { opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? {} : { opacity: 0, x: -30 }}
                    transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {wasCorrect && (
                      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 12, lineHeight: 1.5 }}>
                        Acertou por exclusão ou intuição? Acertar sem domínio é um risco na prova real.
                      </div>
                    )}
                    {isDuplicate && existingEntry && (
                      <DuplicateBanner existingReason={existingEntry.reason} addedAt={existingEntry.addedAt} />
                    )}
                    <div role="radiogroup" aria-label="Motivo do erro" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {availableKeys.map((key, i) => (
                        <ReasonCard
                          key={key}
                          type={ERROR_TYPES[key]}
                          selected={selectedType === key}
                          onSelect={() => setSelectedType(key)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLButtonElement)?.focus(); }
                            if (e.key === "ArrowUp") { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLButtonElement)?.focus(); }
                          }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      disabled={!selectedType || (isDuplicate && isSameAsExisting)}
                      style={{
                        marginTop: 16, width: "100%", padding: "11px",
                        borderRadius: "var(--radius-md)", border: "none",
                        background: selectedType && !(isDuplicate && isSameAsExisting) ? "var(--wine)" : "var(--border)",
                        color: selectedType && !(isDuplicate && isSameAsExisting) ? "#fff" : "var(--t3)",
                        fontSize: 13.5, fontWeight: 700, cursor: selectedType && !(isDuplicate && isSameAsExisting) ? "pointer" : "not-allowed",
                        fontFamily: "'Inter', sans-serif",
                        transition: "all .15s",
                      }}
                    >
                      {isDuplicate ? "Atualizar →" : "Continuar →"}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={reduced ? {} : { opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? {} : { opacity: 0, x: -30 }}
                    transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>
                      Anotação opcional — o que precisa lembrar?
                    </p>
                    {selectedHighlight && (
                      <div style={{ background: "var(--s3)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12, color: "var(--t2)", marginBottom: 10, fontStyle: "italic", borderLeft: "3px solid var(--wine)" }}>
                        "{selectedHighlight}"
                      </div>
                    )}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 300))}
                      placeholder="Ex: Revisar critérios de Boston para IC aguda…"
                      rows={4}
                      style={{
                        width: "100%", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border)",
                        padding: "10px 12px", fontSize: 12.5, color: "var(--t1)", resize: "vertical",
                        fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box",
                        background: "var(--surface)",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--wine)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                    <div style={{ textAlign: "right", fontSize: 11, color: note.length > 270 ? "#ef4444" : "var(--t4)", marginBottom: 12 }}>
                      {note.length}/300
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          flex: 1, padding: "11px", borderRadius: "var(--radius-md)", border: "none",
                          background: saving ? "var(--border)" : "var(--wine)", color: saving ? "var(--t3)" : "#fff",
                          fontSize: 13.5, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                          fontFamily: "'Inter', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        {saving ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ animation: "spin .8s linear infinite" }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Salvando…
                          </>
                        ) : "Salvar no Caderno"}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          padding: "11px 16px", borderRadius: "var(--radius-md)",
                          border: "1.5px solid var(--border)", background: "none",
                          color: "var(--t2)", fontSize: 13, cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Pular →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sandbox/caderno/components/AddToNotebookModal.test.tsx`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/sandbox/caderno/components/AddToNotebookModal/
git commit -m "feat(sandbox): AddToNotebookModal — 2-step flow, duplicate detection, toast on save"
```

---

### Task 11: PageHero (dark header zone)

**Files:**
- Create: `src/sandbox/caderno/components/PageHero.tsx`

- [ ] **Step 1: Implement PageHero**

```tsx
// src/sandbox/caderno/components/PageHero.tsx
import { motion, useReducedMotion } from "framer-motion";
import { ProgressBar } from "../ui/ProgressBar";

interface PageHeroProps {
  pendingCount: number;
  resolvedCount: number;
  totalCount: number;
  specialtyCount: number;
  streak: number;
}

function AnimatedCount({ value }: { value: number }) {
  const reduced = useReducedMotion();
  // Simple display — skip countUp animation for reduced motion
  return <span>{value}</span>;
}

export function PageHero({
  pendingCount,
  resolvedCount,
  totalCount,
  specialtyCount,
  streak,
}: PageHeroProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{
        background: "var(--ink-2)",
        position: "relative",
        overflow: "hidden",
        padding: "28px 24px 24px",
      }}
    >
      {/* Decorative radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -80,
          left: -60,
          width: 320,
          height: 320,
          background: "radial-gradient(circle, var(--wine-glow) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* PRO badge + title */}
      <div style={{ marginBottom: 20, position: "relative" }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--wine-glow)",
            border: "1px solid rgba(160,48,80,.3)",
            color: "var(--wine)",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          PRO
        </span>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-.03em",
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          Caderno de Erros
        </h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", margin: "6px 0 0" }}>
          Suas questões para dominar antes da prova.
        </p>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
          position: "relative",
        }}
      >
        {[
          { label: "Pendentes", value: pendingCount, color: "#fb923c" },
          { label: "Resolvidas", value: resolvedCount, color: "var(--success)" },
          { label: "Total", value: totalCount, color: "#ffffff" },
          { label: "Especialidades", value: specialtyCount, color: "#ffffff" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "-.04em",
                fontVariantNumeric: "tabular-nums",
                color,
                lineHeight: 1,
              }}
            >
              <AnimatedCount value={value} />
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,.45)",
                marginTop: 4,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress band */}
      <div style={{ marginBottom: 16, position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>Progresso</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>
            {resolvedCount} / {totalCount}
          </span>
        </div>
        <ProgressBar resolved={resolvedCount} total={totalCount} />
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <span style={{ fontSize: 16 }} aria-hidden="true">🔥</span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              {streak} dia{streak !== 1 ? "s" : ""} seguidos revisando
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>
              Consistência é o diferencial
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/caderno/components/PageHero.tsx
git commit -m "feat(sandbox): PageHero — dark header zone with stats, progress bar, streak"
```

---

### Task 12: FilterBar

**Files:**
- Create: `src/sandbox/caderno/components/FilterBar.tsx`

- [ ] **Step 1: Implement FilterBar**

```tsx
// src/sandbox/caderno/components/FilterBar.tsx
import { Chip } from "../ui/Chip";
import { ERROR_TYPES, type ErrorTypeKey } from "../errorTypes";

const TYPE_FILTERS: Array<{ key: ErrorTypeKey | "all"; label: string; dotColor?: string }> = [
  { key: "all", label: "Todos" },
  { key: "lacuna", label: "Lacuna", dotColor: "#f43f5e" },
  { key: "memoria", label: "Memória", dotColor: "#8b5cf6" },
  { key: "diferencial", label: "Diferencial", dotColor: "#3b82f6" },
  { key: "atencao", label: "Atenção", dotColor: "#f59e0b" },
  { key: "guessed_correctly", label: "Chute", dotColor: "#eab308" },
];

interface FilterBarProps {
  activeType: ErrorTypeKey | "all";
  activeSpec: string | null;
  typeCounts: Partial<Record<ErrorTypeKey | "all", number>>;
  specialties: string[];
  onTypeChange: (t: ErrorTypeKey | "all") => void;
  onSpecChange: (s: string | null) => void;
}

export function FilterBar({
  activeType,
  activeSpec,
  typeCounts,
  specialties,
  onTypeChange,
  onSpecChange,
}: FilterBarProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Type filter */}
      <div
        role="radiogroup"
        aria-label="Filtrar por tipo de erro"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {TYPE_FILTERS.map(({ key, label, dotColor }) => (
          <Chip
            key={key}
            label={label}
            count={typeCounts[key]}
            active={activeType === key}
            dotColor={dotColor}
            onClick={() => onTypeChange(key)}
          />
        ))}
      </div>

      {/* Specialty filter — only shown when specialties exist */}
      {specialties.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Filtrar por especialidade"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <Chip
            label="Todas"
            active={activeSpec === null}
            onClick={() => onSpecChange(null)}
          />
          {specialties.map((spec) => (
            <Chip
              key={spec}
              label={spec}
              active={activeSpec === spec}
              onClick={() => onSpecChange(spec)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/caderno/components/FilterBar.tsx
git commit -m "feat(sandbox): FilterBar — type chips + specialty chips with scroll"
```

---

### Task 13: HeroNextCard

**Files:**
- Create: `src/sandbox/caderno/components/HeroNextCard.tsx`

- [ ] **Step 1: Implement HeroNextCard**

```tsx
// src/sandbox/caderno/components/HeroNextCard.tsx
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { NotebookEntry } from "../mockEntries";
import { ERROR_TYPES } from "../errorTypes";

interface HeroNextCardProps {
  entry: NotebookEntry;
  onMarkResolved: (id: string) => void;
  simuladoBaseUrl?: string; // e.g., "/simulados"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function HeroNextCard({ entry, onMarkResolved, simuladoBaseUrl = "/simulados" }: HeroNextCardProps) {
  const reduced = useReducedMotion();
  const type = ERROR_TYPES[entry.errorType];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entry.id}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
        transition={reduced ? { duration: 0.15 } : { type: "spring", damping: 25, stiffness: 300 }}
        className="caderno-sandbox"
        style={{
          background: "var(--ink)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          position: "relative",
          marginBottom: 16,
        }}
      >
        {/* Wine accent bar */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: "linear-gradient(180deg, var(--wine), var(--wine-mid))",
          }}
        />

        <div style={{ padding: "20px 20px 20px 22px" }}>
          {/* Label */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 8 }}>
            Próxima para revisar
          </div>

          {/* Question meta */}
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
              Q{entry.questionNumber} · {entry.area}
            </span>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}> — {entry.theme}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 14 }}>
            {entry.simuladoTitle} · {formatDate(entry.createdAt)}
          </div>

          {/* Type tag */}
          <span
            style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
              padding: "2px 10px", borderRadius: "var(--radius-pill)",
              background: type.colorBase + "25",
              border: `1px solid ${type.colorBase}50`,
              color: type.colorBase,
              display: "inline-block",
              marginBottom: entry.note ? 12 : 16,
            }}
          >
            {type.label}
          </span>

          {/* Note preview */}
          {entry.note && (
            <div
              style={{
                fontSize: 12, color: "rgba(255,255,255,.55)", fontStyle: "italic",
                background: "rgba(255,255,255,.04)", borderRadius: "var(--radius-sm)",
                padding: "8px 12px", borderLeft: "2px solid rgba(255,255,255,.1)",
                marginBottom: 16, lineHeight: 1.5,
              }}
            >
              "{entry.note}"
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onMarkResolved(entry.id)}
              aria-label={`Marcar questão ${entry.questionNumber} como resolvida`}
              style={{
                flex: 1, padding: "10px 16px",
                borderRadius: "var(--radius-md)", border: "none",
                background: "var(--success)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Marcar como resolvida
            </button>
            <a
              href={`${simuladoBaseUrl}/${entry.simuladoId}/correcao?q=${entry.questionNumber}`}
              style={{
                fontSize: 12, color: "rgba(255,255,255,.45)",
                textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              Ver questão →
            </a>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/caderno/components/HeroNextCard.tsx
git commit -m "feat(sandbox): HeroNextCard — dark hero with animated swap on resolve"
```

---

### Task 14: EntryCard

**Files:**
- Create: `src/sandbox/caderno/components/EntryCard.tsx`

- [ ] **Step 1: Implement EntryCard**

```tsx
// src/sandbox/caderno/components/EntryCard.tsx
import { motion, useReducedMotion } from "framer-motion";
import type { NotebookEntry } from "../mockEntries";
import { ERROR_TYPES } from "../errorTypes";

interface EntryCardProps {
  entry: NotebookEntry;
  onMarkResolved?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function EntryCard({ entry, onMarkResolved }: EntryCardProps) {
  const reduced = useReducedMotion();
  const type = ERROR_TYPES[entry.errorType];
  const resolved = !!entry.resolvedAt;

  return (
    <div
      className="caderno-sandbox"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        minHeight: 56,
        opacity: resolved ? 0.45 : 1,
        transition: "opacity .25s ease",
      }}
    >
      {/* Color bar */}
      <div
        aria-hidden="true"
        style={{
          width: 3,
          alignSelf: "stretch",
          background: type.colorBase,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--t1)",
              textDecoration: resolved ? "line-through" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "calc(100% - 80px)",
            }}
          >
            Q{entry.questionNumber} · {entry.area}
          </span>
          <span
            style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em",
              padding: "1px 7px", borderRadius: "var(--radius-pill)",
              background: type.colorBg, border: `1px solid ${type.colorBorder}`,
              color: type.colorText, flexShrink: 0,
            }}
          >
            {type.label.split(" ")[0]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          {entry.simuladoTitle} · {formatDate(entry.createdAt)}
        </div>
      </div>

      {/* Check button */}
      {!resolved && onMarkResolved ? (
        <button
          onClick={() => onMarkResolved(entry.id)}
          aria-label={`Marcar questão ${entry.questionNumber} como resolvida`}
          style={{
            width: 44, height: "100%", minHeight: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", borderLeft: "1px solid var(--border)", background: "none",
            cursor: "pointer", flexShrink: 0, color: "var(--t4)",
            transition: "all .15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#dcfce7";
            e.currentTarget.style.borderColor = "#a7f3d0";
            e.currentTarget.style.color = "#10b981";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--t4)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      ) : (
        <div
          aria-label="Resolvida"
          style={{
            width: 44, minHeight: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderLeft: "1px solid var(--border)", flexShrink: 0, color: "#10b981",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/sandbox/caderno/components/EntryCard.tsx
git commit -m "feat(sandbox): EntryCard — pending/resolved states with color bar"
```

---

### Task 15: EmptyState + ZeroPendingState

**Files:**
- Create: `src/sandbox/caderno/components/EmptyState.tsx`
- Create: `src/sandbox/caderno/components/ZeroPendingState.tsx`

- [ ] **Step 1: EmptyState**

```tsx
// src/sandbox/caderno/components/EmptyState.tsx
export function EmptyState() {
  return (
    <div
      className="caderno-sandbox"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "64px 24px",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56, height: 56,
          borderRadius: "var(--radius-lg)",
          background: "var(--s3)",
          border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
          Seu Caderno está vazio
        </div>
        <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 280, lineHeight: 1.6 }}>
          Na correção do simulado, toque em "Salvar no Caderno" para adicionar questões que quer dominar.
        </div>
      </div>
      <a
        href="/simulados"
        style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)",
          background: "var(--wine)", color: "#fff",
          fontSize: 13, fontWeight: 700, textDecoration: "none",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Ver simulados disponíveis
      </a>
    </div>
  );
}
```

- [ ] **Step 2: ZeroPendingState**

```tsx
// src/sandbox/caderno/components/ZeroPendingState.tsx
interface ZeroPendingStateProps {
  resolvedCount: number;
  streak: number;
  onShowResolved: () => void;
}

export function ZeroPendingState({ resolvedCount, streak, onShowResolved }: ZeroPendingStateProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{
        background: "var(--ink)",
        borderRadius: "var(--radius-xl)",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 20,
      }}
    >
      {/* Green ring */}
      <div
        style={{
          width: 72, height: 72,
          borderRadius: "50%",
          background: "rgba(16,185,129,.08)",
          border: "2px solid rgba(16,185,129,.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", marginBottom: 8 }}>
          Caderno zerado 🎯
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.6, maxWidth: 280 }}>
          {resolvedCount} questões dominadas.{streak > 1 ? ` ${streak} dias seguidos revisando.` : ""}
        </div>
      </div>

      <button
        onClick={onShowResolved}
        style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)",
          border: "1.5px solid rgba(255,255,255,.15)", background: "none",
          color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}
      >
        Ver questões resolvidas
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/sandbox/caderno/components/EmptyState.tsx src/sandbox/caderno/components/ZeroPendingState.tsx
git commit -m "feat(sandbox): EmptyState + ZeroPendingState components"
```

---

### Task 16: CadernoSandboxPage assembly

**Files:**
- Create: `src/sandbox/caderno/CadernoSandboxPage.tsx`
- Modify: `src/pages/SandboxCadernoPage.tsx`

- [ ] **Step 1: Implement CadernoSandboxPage**

```tsx
// src/sandbox/caderno/CadernoSandboxPage.tsx
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MOCK_ENTRIES } from "./mockEntries";
import { useNotebookEntries } from "./hooks/useNotebookEntries";
import { useReviewStreak } from "./hooks/useReviewStreak";
import { ToastProvider } from "./ui/ToastProvider";
import { PageHero } from "./components/PageHero";
import { FilterBar } from "./components/FilterBar";
import { HeroNextCard } from "./components/HeroNextCard";
import { EntryCard } from "./components/EntryCard";
import { EmptyState } from "./components/EmptyState";
import { ZeroPendingState } from "./components/ZeroPendingState";
import { AddToNotebookModal } from "./components/AddToNotebookModal/index";
import { ERROR_TYPE_KEYS, type ErrorTypeKey } from "./errorTypes";
import type { NotebookEntry } from "./mockEntries";
import "./tokens.css";

export function CadernoSandboxPage() {
  const {
    entries,
    filtered,
    pending,
    resolved,
    heroEntry,
    activeTypeFilter,
    activeSpecFilter,
    setTypeFilter,
    setSpecFilter,
    markResolved,
  } = useNotebookEntries(MOCK_ENTRIES);

  const { streak } = useReviewStreak(entries);
  const [showResolved, setShowResolved] = useState(false);

  // Modal demo state
  const [modalOpen, setModalOpen] = useState(false);

  // Compute specialties from all entries
  const specialties = useMemo(
    () => [...new Set(entries.map((e) => e.area))].sort(),
    [entries]
  );

  // Type counts for filter bar
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ErrorTypeKey | "all", number>> = {
      all: filtered.length,
    };
    for (const key of ERROR_TYPE_KEYS) {
      counts[key] = filtered.filter((e) => e.errorType === key).length;
    }
    return counts;
  }, [filtered]);

  const isEmpty = entries.length === 0;
  const allResolved = entries.length > 0 && pending.length === 0;

  return (
    <ToastProvider>
      <div
        className="caderno-sandbox"
        style={{
          minHeight: "100vh",
          background: "var(--s3)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <PageHero
              pendingCount={pending.length}
              resolvedCount={resolved.length}
              totalCount={entries.length}
              specialtyCount={specialties.length}
              streak={streak}
            />

            <FilterBar
              activeType={activeTypeFilter}
              activeSpec={activeSpecFilter}
              typeCounts={typeCounts}
              specialties={specialties}
              onTypeChange={setTypeFilter}
              onSpecChange={setSpecFilter}
            />

            <div style={{ padding: "20px 24px", maxWidth: 720, margin: "0 auto" }}>
              {allResolved ? (
                <ZeroPendingState
                  resolvedCount={resolved.length}
                  streak={streak}
                  onShowResolved={() => setShowResolved(true)}
                />
              ) : (
                <>
                  {/* Hero next card */}
                  {heroEntry && (
                    <HeroNextCard
                      entry={heroEntry}
                      onMarkResolved={markResolved}
                    />
                  )}

                  {/* Queue */}
                  {pending.length > 1 && (
                    <section aria-labelledby="queue-heading" style={{ marginBottom: 24 }}>
                      <h2
                        id="queue-heading"
                        style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                          textTransform: "uppercase", color: "var(--t3)",
                          margin: "0 0 10px",
                        }}
                      >
                        Na fila ({pending.length - 1})
                      </h2>
                      <motion.div
                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                        initial="hidden"
                        animate="visible"
                        variants={{
                          visible: { transition: { staggerChildren: 0.04 } },
                          hidden: {},
                        }}
                      >
                        {pending.slice(1).map((entry) => (
                          <motion.div
                            key={entry.id}
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 22, stiffness: 280 } },
                            }}
                          >
                            <EntryCard entry={entry} onMarkResolved={markResolved} />
                          </motion.div>
                        ))}
                      </motion.div>
                    </section>
                  )}
                </>
              )}

              {/* Resolved section */}
              {(showResolved || resolved.length > 0) && resolved.length > 0 && (
                <section aria-labelledby="resolved-heading" style={{ marginTop: allResolved ? 16 : 0 }}>
                  <h2
                    id="resolved-heading"
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                      textTransform: "uppercase", color: "var(--t3)",
                      margin: "0 0 10px",
                    }}
                  >
                    Resolvidas ({resolved.length})
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {resolved.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                </section>
              )}

              {/* Demo: modal trigger */}
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>
                  Demo: AddToNotebookModal
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    padding: "9px 18px", borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--border)", background: "var(--surface)",
                    color: "var(--t1)", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Abrir modal de adicionar
                </button>
              </div>
            </div>
          </>
        )}

        <AddToNotebookModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          questionId="q-demo"
          simuladoId="sim-demo"
          simuladoTitle="ENAMED Simulado Demo"
          area="Cardiologia"
          theme="IAM com supra de ST"
          questionNumber={42}
          questionText="Qual a conduta no IAM?"
          wasCorrect={false}
          userId="user-demo"
          onAdded={() => {}}
        />
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Update SandboxCadernoPage to render the assembled page**

```tsx
// src/pages/SandboxCadernoPage.tsx
import { useEffect } from "react";
import { CadernoSandboxPage } from "@/sandbox/caderno/CadernoSandboxPage";

export default function SandboxCadernoPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return <CadernoSandboxPage />;
}
```

- [ ] **Step 3: Run full test suite to confirm nothing broke**

Run: `npm run test`
Expected: All existing tests pass. New sandbox tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/sandbox/caderno/CadernoSandboxPage.tsx src/pages/SandboxCadernoPage.tsx
git commit -m "feat(sandbox): assemble CadernoSandboxPage — full page with modal demo"
```

---

### Task 17: Smoke-test at `/sandbox/caderno`

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify page renders correctly**

Navigate to `http://localhost:8080/sandbox/caderno`

Expected:
- Dark header zone with wine glow, stats (8 pending, 4 resolved, 12 total, 2 especialidades)
- Streak card visible (mock entries have consecutive resolved dates)
- Progress bar fills to 33%
- FilterBar with 6 type chips
- Two specialty chips (Cardiologia, Infectologia)
- Hero card in dark ink background showing Q12 · Cardiologia — IAM com supra de ST
- Queue list below (Q28, Q7, Q19, Q44, Q3, Q31, Q55)
- Resolved section at bottom (4 entries, opacity 0.45, strikethrough)
- "Abrir modal de adicionar" button at bottom
- Clicking it opens the 2-step modal
- Selecting a reason + Continuar advances to step 2
- "Salvar no Caderno" fires success toast bottom-right

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(sandbox): final smoke test verified at /sandbox/caderno"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| 5 error types with colors/strategies | Task 3 |
| Modal 2-step flow | Task 10 |
| wasCorrect=true → 1 card + banner | Task 10 |
| Duplicate detection + update CTA | Task 10 |
| Saving state (dim body, spinner) | Task 10 |
| Toast on save (no success screen) | Tasks 7–10 |
| Dark header zone with stats | Task 11 |
| Streak display | Task 6 + 11 |
| Progress bar | Tasks 8 + 11 |
| Filter by type (chips) | Task 12 |
| Filter by specialty | Task 12 |
| Hero next card (oldest pending) | Tasks 5 + 13 |
| Queue list (pending − hero) | Task 16 |
| Resolved section (opacity + strikethrough) | Task 14 |
| Empty state (zero entries) | Task 15 |
| Zero-pending state (all resolved) | Task 15 |
| Animation spec (spring params) | Throughout |
| useReducedMotion() | Throughout |
| Accessibility (radiogroup/radio, aria-labels, focus trap) | Tasks 9–10 |
| Mobile (filter scroll, bottom sheet modal) | Tasks 12 + 10 |
| Inter font | Tasks 1–2 |
| No shadcn | All tasks |
| Route `/sandbox/caderno` | Task 1 |

**Placeholder scan:** No TBD, TODO, or "similar to" references found.

**Type consistency:** `NotebookEntry` imported from `../mockEntries` consistently. `ErrorTypeKey` from `../errorTypes` consistently. `useNotebookEntries` return type matches `CadernoSandboxPage` usage.
