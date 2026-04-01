# Desempenho Page — UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the visual layer of `DesempenhoPage.tsx` to a premium Blend B+C design — dark wine hero banner + white editorial body — keeping all data logic, hooks, and copy unchanged.

**Architecture:** Single-file rebuild of `src/pages/DesempenhoPage.tsx`. All sub-elements (hero, area card, theme accordion, summary, evo bars) are inlined as private JSX functions at the bottom of the file. No new files. No logic changes.

**Tech Stack:** React 18, TypeScript, Framer Motion 12, Tailwind CSS 3.4, React Router 6 Link, existing hooks (`useSimulados`, `useSimuladoDetail`, `useExamResult`, `useUserPerformance`), `computePerformanceBreakdown` from `@/lib/resultHelpers`, `cn` from `@/lib/utils`.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `src/pages/DesempenhoPage.tsx` | Full visual rebuild |
| **Create** | `src/pages/DesempenhoPage.test.tsx` | Render + interaction tests |

---

## Task 1: Test harness

**Files:**
- Create: `src/pages/DesempenhoPage.test.tsx`

- [ ] **Step 1.1 — Write failing tests**

Create `src/pages/DesempenhoPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DesempenhoPage from "./DesempenhoPage";

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a, whileHover: _wh,
         transition: _tr, variants: _v, exit: _e, ...rest }: any) =>
        (({ div: <div {...rest}>{children}</div>,
           section: <section {...rest}>{children}</section>,
         } as any)[tag] ?? <div {...rest}>{children}</div>),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Hook mocks ──────────────────────────────────────────────────────────────
const mockSimulados = [
  {
    id: "sim-1",
    title: "Simulado #1 — Fundamentos",
    status: "completed",
    executionWindowStart: "2026-03-01T00:00:00Z",
    executionWindowEnd: "2026-03-01T23:59:00Z",
    userState: { finished: true, score: 72 },
  },
];

vi.mock("@/hooks/useSimulados", () => ({
  useSimulados: () => ({ simulados: mockSimulados, loading: false }),
}));

vi.mock("@/hooks/useUserPerformance", () => ({
  useUserPerformance: () => ({ history: [], summary: null, loading: false }),
}));

const mockQuestions = [
  { id: "q1", area: "Clínica Médica", theme: "HAS", number: 1, text: "Q1 texto", correctOptionId: "opt-a", difficulty: "medium" },
  { id: "q2", area: "Clínica Médica", theme: "HAS", number: 2, text: "Q2 texto", correctOptionId: "opt-b", difficulty: "medium" },
  { id: "q3", area: "Cirurgia", theme: "Abdome Agudo", number: 3, text: "Q3 texto", correctOptionId: "opt-a", difficulty: "hard" },
];

vi.mock("@/hooks/useSimuladoDetail", () => ({
  useSimuladoDetail: () => ({ questions: mockQuestions, loading: false }),
}));

const mockExamState = {
  status: "submitted",
  answers: {
    "q1": { selectedOption: "opt-a", markedForReview: false, highConfidence: false },
    "q2": { selectedOption: "opt-x", markedForReview: false, highConfidence: false },
    "q3": { selectedOption: "opt-a", markedForReview: false, highConfidence: false },
  },
};

vi.mock("@/hooks/useExamResult", () => ({
  useExamResult: () => ({ examState: mockExamState, loading: false }),
}));

vi.mock("@/lib/simulado-helpers", () => ({
  canViewResults: () => true,
  deriveSimuladoStatus: (s: any) => s.status,
}));

// ── Helper ──────────────────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/desempenho"]}>
      <DesempenhoPage />
    </MemoryRouter>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe("DesempenhoPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders the hero score", () => {
    renderPage();
    // 2 correct out of 3 = 67%
    expect(screen.getByText(/67%/)).toBeTruthy();
  });

  it("renders 'Aproveitamento geral' overline in hero", () => {
    renderPage();
    expect(screen.getByText(/aproveitamento geral/i)).toBeTruthy();
  });

  it("renders the SimuladoResultNav", () => {
    renderPage();
    expect(screen.getByText(/ver correção/i)).toBeTruthy();
  });

  it("renders area cards", () => {
    renderPage();
    expect(screen.getByText("Clínica Médica")).toBeTruthy();
    expect(screen.getByText("Cirurgia")).toBeTruthy();
  });

  it("shows 'Selecione uma Grande Área' placeholder when no area selected", () => {
    renderPage();
    expect(screen.getByText(/selecione uma grande área/i)).toBeTruthy();
  });

  it("clicking an area shows its themes", () => {
    renderPage();
    fireEvent.click(screen.getByText("Clínica Médica"));
    expect(screen.getByText("HAS")).toBeTruthy();
  });

  it("clicking a theme expands its questions", () => {
    renderPage();
    fireEvent.click(screen.getByText("Clínica Médica"));
    fireEvent.click(screen.getByText("HAS"));
    expect(screen.getByText(/Q1 texto/i)).toBeTruthy();
  });

  it("question rows link to correcao with correct q param", () => {
    renderPage();
    fireEvent.click(screen.getByText("Clínica Médica"));
    fireEvent.click(screen.getByText("HAS"));
    const link = screen.getByRole("link", { name: /Q1 texto/i });
    expect(link.getAttribute("href")).toContain("correcao?q=1");
  });

  it("renders summary cards when more than one area", () => {
    renderPage();
    expect(screen.getByText(/onde você brilha/i)).toBeTruthy();
    expect(screen.getByText(/próximo foco/i)).toBeTruthy();
  });

  it("renders evolution bars for each area", () => {
    renderPage();
    // Both areas should appear in the evo section
    const allClinica = screen.getAllByText("Clínica Médica");
    expect(allClinica.length).toBeGreaterThanOrEqual(1);
  });

  it("clicking selected area again deselects it", () => {
    renderPage();
    fireEvent.click(screen.getByText("Clínica Médica"));
    fireEvent.click(screen.getByText("Clínica Médica"));
    expect(screen.getByText(/selecione uma grande área/i)).toBeTruthy();
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```bash
cd "/c/Users/Felipe Souza/Documents/enamed-arena" && npm run test -- --run DesempenhoPage
```

Expected: multiple failures — the page doesn't yet have the new structure.

---

## Task 2: Hero banner + unified card shell

**Files:**
- Modify: `src/pages/DesempenhoPage.tsx`

Replace the entire file with the new scaffold. This establishes:
- All imports
- State variables (unchanged)
- All hooks (unchanged)
- Loading / empty states (unchanged)
- Outer unified card shell (`HeroSection` + nav strip + white body)
- Private `HeroSection` component at the bottom

- [ ] **Step 2.1 — Replace DesempenhoPage.tsx**

Overwrite `src/pages/DesempenhoPage.tsx` entirely:

```tsx
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { useSimulados } from '@/hooks/useSimulados';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { useUserPerformance } from '@/hooks/useUserPerformance';
import { canViewResults } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import { cn } from '@/lib/utils';
import { BarChart3, Star, TrendingDown, Stethoscope } from 'lucide-react';

export default function DesempenhoPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading: loadingSimulados } = useSimulados();
  const { history: _history } = useUserPerformance();
  const simuladosWithResults = useMemo(
    () => simulados.filter(s => canViewResults(s.status)),
    [simulados],
  );

  const [selectedSimuladoId, setSelectedSimuladoId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSimuladoId && simuladosWithResults.length > 0) {
      setSelectedSimuladoId(simuladosWithResults[0].id);
    }
  }, [simuladosWithResults, selectedSimuladoId]);

  const { questions, loading: loadingDetail } = useSimuladoDetail(selectedSimuladoId || undefined);
  const { examState, loading: loadingExam } = useExamResult(selectedSimuladoId || undefined);

  const breakdown = useMemo<PerformanceBreakdown | null>(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !questions.length) return null;
    return computePerformanceBreakdown(examState, questions);
  }, [examState, questions]);

  const questionResultsForTheme = useMemo(() => {
    if (!selectedTheme || !breakdown) return [];
    return breakdown.overall.questionResults
      .filter(q => q.theme === selectedTheme && (!selectedArea || q.area === selectedArea))
      .map(q => {
        const question = questions.find(item => item.id === q.questionId);
        return { ...q, number: question?.number ?? null, text: question?.text ?? '' };
      });
  }, [selectedTheme, selectedArea, breakdown, questions]);

  const loading = loadingSimulados || loadingDetail || loadingExam;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !breakdown) {
    return (
      <>
        <PageHeader title="Desempenho" subtitle="Sua evolução por área e tema." badge="Análise de Performance" />
        <div className="space-y-3">
          <SkeletonCard className="h-[140px] rounded-[22px] bg-primary/[0.06]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard className="h-[280px]" />
            <SkeletonCard className="h-[280px]" />
          </div>
          <SkeletonCard className="h-[160px]" />
        </div>
      </>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (simuladosWithResults.length === 0 || !breakdown) {
    return (
      <>
        <PageHeader title="Desempenho" subtitle="Sua evolução por área e tema." badge="Análise de Performance" />
        <EmptyState
          icon={BarChart3}
          title="Sem dados de desempenho"
          description="Complete um simulado e aguarde a liberação do resultado para ver sua análise de desempenho."
        />
      </>
    );
  }

  const { overall, byArea, byTheme } = breakdown;
  const themesForArea = selectedArea ? byTheme.filter(t => t.area === selectedArea) : [];
  const bestArea = byArea[0];
  const worstArea = byArea[byArea.length - 1];

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader title="Desempenho" subtitle="Sua evolução por área e tema." badge="Análise de Performance" />

      {/* Unified card: dark hero (top) + white body (bottom) */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="rounded-[22px] overflow-hidden border border-white/[0.07] shadow-[0_20px_40px_-16px_rgba(142,31,61,0.25),0_6px_16px_-8px_rgba(0,0,0,0.08)]"
      >
        {/* ── Hero ── */}
        <HeroSection
          simuladosWithResults={simuladosWithResults}
          selectedSimuladoId={selectedSimuladoId}
          onSelectSimulado={(id) => {
            setSelectedSimuladoId(id);
            setSelectedArea(null);
            setSelectedTheme(null);
          }}
          overall={overall}
          bestArea={bestArea}
          worstArea={worstArea}
        />

        {/* ── Nav strip ── */}
        {selectedSimuladoId && (
          <div className="bg-white border-b border-border/40 px-4 py-3">
            <SimuladoResultNav simuladoId={selectedSimuladoId} />
          </div>
        )}

        {/* ── White body ── */}
        <div className="bg-white px-4 py-5 md:px-5 md:py-6 space-y-5">

          {/* Section 1: Area grid + Theme accordion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Area grid */}
            <div>
              <p className="text-[9px] uppercase tracking-[1.2px] text-muted-foreground mb-2">Grande Área</p>
              <div className="grid grid-cols-2 gap-1.5">
                {byArea.map((area, idx) => (
                  <AreaCard
                    key={area.area}
                    area={area.area}
                    score={area.score}
                    correct={area.correct}
                    questions={area.questions}
                    isBest={idx === 0}
                    isWorst={idx === byArea.length - 1}
                    isSelected={selectedArea === area.area}
                    onClick={() => {
                      setSelectedArea(prev => prev === area.area ? null : area.area);
                      setSelectedTheme(null);
                    }}
                    prefersReducedMotion={!!prefersReducedMotion}
                  />
                ))}
              </div>
            </div>

            {/* Theme accordion */}
            <div>
              <p className="text-[9px] uppercase tracking-[1.2px] text-muted-foreground mb-2">
                {selectedArea ? `Temas · ${selectedArea}` : 'Temas'}
              </p>
              {!selectedArea ? (
                <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-border/40 text-[12px] text-muted-foreground/60 text-center px-4">
                  Selecione uma Grande Área
                </div>
              ) : themesForArea.length === 0 ? (
                <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-border/40 text-[12px] text-muted-foreground/60">
                  Nenhum tema encontrado
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {themesForArea.map(theme => (
                      <ThemeAccordionRow
                        key={theme.theme}
                        theme={theme.theme}
                        score={theme.score}
                        isOpen={selectedTheme === theme.theme}
                        onToggle={() => setSelectedTheme(prev => prev === theme.theme ? null : theme.theme)}
                        questionResults={selectedTheme === theme.theme ? questionResultsForTheme : []}
                        simuladoId={selectedSimuladoId!}
                        prefersReducedMotion={!!prefersReducedMotion}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-border/40" />

          {/* Section 2: Summary cards */}
          {byArea.length > 1 && (
            <SummarySection
              bestArea={bestArea.area}
              bestScore={bestArea.score}
              worstArea={worstArea.area}
              worstScore={worstArea.score}
              totalCorrect={overall.totalCorrect}
              totalQuestions={overall.totalQuestions}
              percentageScore={overall.percentageScore}
            />
          )}

          {/* Divider */}
          {byArea.length > 1 && <hr className="border-border/40" />}

          {/* Section 3: Evolution bars */}
          <EvoBars byArea={byArea} prefersReducedMotion={!!prefersReducedMotion} />

        </div>
      </motion.div>
    </>
  );
}

// ─── Private sub-components ──────────────────────────────────────────────────

function HeroSection({
  simuladosWithResults,
  selectedSimuladoId,
  onSelectSimulado,
  overall,
  bestArea,
  worstArea,
}: {
  simuladosWithResults: Array<{ id: string; title: string }>;
  selectedSimuladoId: string | null;
  onSelectSimulado: (id: string) => void;
  overall: { percentageScore: number; totalCorrect: number; totalQuestions: number };
  bestArea: { area: string; score: number } | null;
  worstArea: { area: string; score: number } | null;
}) {
  return (
    <div className="relative overflow-hidden bg-[linear-gradient(135deg,hsl(345,64%,22%)_0%,hsl(340,58%,14%)_60%,#0f111a_100%)] px-4 py-4 md:px-5 md:py-5">
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[hsl(345,72%,48%)] blur-[60px] opacity-25" />

      {/* Pill selector — only when multiple simulados */}
      {simuladosWithResults.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-0.5">
          {simuladosWithResults.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSimulado(s.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold transition-all duration-200',
                s.id === selectedSimuladoId
                  ? 'bg-white/[0.14] border-white/[0.28] text-white'
                  : 'bg-white/[0.05] border-white/[0.10] text-white/40 hover:text-white/60',
              )}
            >
              {s.title.length > 20 ? s.title.slice(0, 20) + '…' : s.title}
            </button>
          ))}
        </div>
      )}

      {/* Score + chips row */}
      <div className="relative z-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[1.5px] text-white/40 mb-1">Aproveitamento geral</p>
          <p className="text-[40px] font-black tracking-[-2px] text-white leading-none">{overall.percentageScore}%</p>
          <p className="text-[10px] text-white/40 mt-1">{overall.totalCorrect} de {overall.totalQuestions} questões</p>
        </div>
        <div className="flex gap-2 mb-1">
          {bestArea && (
            <div className="bg-white/[0.08] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-center">
              <p className="text-[14px] font-extrabold text-green-400 leading-none">{bestArea.score}%</p>
              <p className="text-[7px] text-white/40 mt-1">melhor área</p>
            </div>
          )}
          {worstArea && bestArea?.area !== worstArea.area && (
            <div className="bg-white/[0.08] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-center">
              <p className="text-[14px] font-extrabold text-red-400 leading-none">{worstArea.score}%</p>
              <p className="text-[7px] text-white/40 mt-1">foco</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AreaCard({
  area, score, correct, questions, isBest, isWorst, isSelected, onClick, prefersReducedMotion,
}: {
  area: string; score: number; correct: number; questions: number;
  isBest: boolean; isWorst: boolean; isSelected: boolean;
  onClick: () => void; prefersReducedMotion: boolean;
}) {
  const scoreColor = isBest ? 'text-green-700' : isWorst ? 'text-red-600' : 'text-foreground';
  const barColor = isBest
    ? 'bg-green-400'
    : isWorst
    ? 'bg-red-400'
    : 'bg-gradient-to-r from-[#8e1f3d] to-[#e83862]';
  const borderClass = isSelected
    ? 'border-primary/40 shadow-[0_3px_10px_-4px_rgba(142,31,61,0.2)]'
    : isBest
    ? 'border-green-200 shadow-[0_3px_10px_-4px_rgba(34,197,94,0.2)]'
    : isWorst
    ? 'border-red-200 shadow-[0_3px_10px_-4px_rgba(239,68,68,0.15)]'
    : 'border-border/40';

  return (
    <motion.button
      onClick={onClick}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'w-full text-left bg-white border rounded-[10px] p-2.5 cursor-pointer transition-all duration-200',
        borderClass,
      )}
    >
      <p className="text-[9px] text-muted-foreground truncate mb-1">{area}</p>
      <p className={cn('text-[20px] font-black tracking-[-0.8px] leading-none tabular-nums', scoreColor)}>{score}%</p>
      <p className="text-[8px] text-muted-foreground/70 mt-0.5">{correct}/{questions} questões</p>
      <div className="h-[3px] rounded-full bg-border/40 mt-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
    </motion.button>
  );
}

function ThemeAccordionRow({
  theme, score, isOpen, onToggle, questionResults, simuladoId, prefersReducedMotion,
}: {
  theme: string; score: number; isOpen: boolean; onToggle: () => void;
  questionResults: Array<{ questionId: string; number: number | null; text: string; isCorrect: boolean; wasAnswered: boolean }>;
  simuladoId: string; prefersReducedMotion: boolean;
}) {
  const scoreColor = score >= 70 ? 'text-green-700' : score >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div
      className={cn(
        'rounded-[9px] overflow-hidden cursor-pointer border transition-colors duration-200',
        isOpen ? 'border-primary/30 bg-white' : 'border-border/40 bg-[#fafafa]',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center px-3 py-2.5 text-left"
      >
        <span className="text-[11px] font-semibold text-foreground">
          {isOpen ? '▾' : '▸'} {theme}
        </span>
        <span className={cn('text-[12px] font-bold tabular-nums', scoreColor)}>{score}%</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-primary/10 px-2.5 py-1.5 flex flex-col gap-0.5">
              {questionResults.map((q, idx) => {
                const badgeClass = q.isCorrect
                  ? 'bg-success/10 text-success'
                  : q.wasAnswered
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning';
                const badgeText = q.isCorrect ? '✓ Acerto' : q.wasAnswered ? '✗ Erro' : '— Em branco';
                return (
                  <Link
                    key={q.questionId}
                    to={`/simulados/${simuladoId}/correcao?q=${q.number ?? idx + 1}`}
                    aria-label={q.text || `Questão ${q.number ?? idx + 1}`}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-border/[0.06] last:border-b-0 no-underline hover:bg-accent/20 rounded px-1 transition-colors"
                  >
                    <span className="text-[10px] text-foreground truncate flex-1">
                      {q.text || `Questão ${q.number ?? idx + 1}`}
                    </span>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-[5px] shrink-0', badgeClass)}>
                      {badgeText}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummarySection({
  bestArea, bestScore, worstArea, worstScore, totalCorrect, totalQuestions, percentageScore,
}: {
  bestArea: string; bestScore: number; worstArea: string; worstScore: number;
  totalCorrect: number; totalQuestions: number; percentageScore: number;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[1.2px] text-muted-foreground mb-3">Resumo do desempenho</p>
      <p className="text-[12px] text-muted-foreground mb-3">
        Seu aproveitamento geral foi de <strong className="text-foreground">{percentageScore}%</strong> ({totalCorrect}/{totalQuestions} questões).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-success/20 bg-success/[0.03] p-4">
          <h4 className="font-semibold flex items-center gap-2 text-success text-[12px] mb-2">
            <Star className="h-3.5 w-3.5" aria-hidden /> Onde você brilha
          </h4>
          <p className="text-[12px] text-muted-foreground">
            Sua principal fortaleza foi em <strong className="text-foreground">{bestArea}</strong> com <strong className="text-foreground">{bestScore}%</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4">
          <h4 className="font-semibold flex items-center gap-2 text-destructive text-[12px] mb-2">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden /> Próximo foco
          </h4>
          <p className="text-[12px] text-muted-foreground">
            A área com maior oportunidade é <strong className="text-foreground">{worstArea}</strong> com <strong className="text-foreground">{worstScore}%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

function EvoBars({
  byArea, prefersReducedMotion,
}: {
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>;
  prefersReducedMotion: boolean;
}) {
  const lastIdx = byArea.length - 1;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[1.2px] text-muted-foreground mb-3">Evolução por grande área</p>
      <div className="space-y-3">
        {byArea.map((area, i) => {
          const isWorst = i === lastIdx;
          const fillClass = isWorst
            ? 'bg-gradient-to-r from-[#991b1b] to-[#ef4444]'
            : 'bg-gradient-to-r from-[#8e1f3d] to-[#e83862]';
          return (
            <div key={area.area}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
                  <span className="text-[12px] font-medium text-foreground">{area.area}</span>
                </div>
                <span className="text-[12px] font-bold text-foreground tabular-nums">
                  {area.score}% <span className="text-[10px] font-normal text-muted-foreground">{area.correct}/{area.questions}</span>
                </span>
              </div>
              <div className="h-[6px] bg-primary/[0.08] rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', fillClass)}
                  initial={prefersReducedMotion ? false : { width: 0 }}
                  animate={{ width: `${area.score}%` }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : i * 0.06 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2 — Run tests**

```bash
cd "/c/Users/Felipe Souza/Documents/enamed-arena" && npm run test -- --run DesempenhoPage
```

Expected: all 11 tests pass.

- [ ] **Step 2.3 — Verify dev server has no TS errors**

```bash
cd "/c/Users/Felipe Souza/Documents/enamed-arena" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 2.4 — Commit**

```bash
cd "/c/Users/Felipe Souza/Documents/enamed-arena" && git add src/pages/DesempenhoPage.tsx src/pages/DesempenhoPage.test.tsx && git commit -m "feat: redesign desempenho page — premium blend hero + editorial body"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| Hero: dark wine gradient, atmospheric glow | Step 2.1 `HeroSection` |
| Hero: pill selector (conditional, `> 1` simulado) | Step 2.1 `HeroSection` |
| Hero: score, overline, subline | Step 2.1 `HeroSection` |
| Hero: melhor/foco chips | Step 2.1 `HeroSection` |
| Nav strip with `SimuladoResultNav` | Step 2.1 main render |
| Body: 2-col area grid + theme accordion | Step 2.1 main render |
| Area card: border color variants (best/worst/selected/default) | Step 2.1 `AreaCard` |
| Area card: score color, progress bar, hover animation | Step 2.1 `AreaCard` |
| Theme accordion: chevron toggle, open/close state | Step 2.1 `ThemeAccordionRow` |
| Theme accordion: animated height expand | Step 2.1 `ThemeAccordionRow` |
| Question rows: badge (acerto/erro/em branco), link to correção | Step 2.1 `ThemeAccordionRow` |
| Summary cards: onde brilha / próximo foco (conditional) | Step 2.1 `SummarySection` |
| Evolution bars: wine gradient, worst=red, staggered animation | Step 2.1 `EvoBars` |
| Loading skeleton: 3 blocks | Step 2.1 loading state |
| Empty state: unchanged `EmptyState` component | Step 2.1 empty state |
| `useReducedMotion` respected everywhere | Step 2.1 — `prefersReducedMotion` passed to all sub-components |
| Removed imports: `SectionHeader`, `StatCard`, `PremiumCard` | Step 2.1 — not imported |
| No new files | ✅ single file + test |
| No changes to hooks/data logic | ✅ all hooks identical |

**Placeholder scan:** No TBDs, no "handle edge cases", no "similar to task N". All code is complete.

**Type consistency:** `PerformanceBreakdown` imported from `@/lib/resultHelpers`. `byArea` items typed inline as `{ area, score, correct, questions }` — matches the `AreaPerformance` shape used by `computePerformanceBreakdown`. `questionResults` in `ThemeAccordionRow` uses the spread of `QuestionResult & { number, text }` — consistent with `questionResultsForTheme` computation in the main component.
