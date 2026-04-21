import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Star,
  TrendingDown,
  Stethoscope,
  ChevronRight,
  FileText,
  Loader2,
  Check,
  X,
  Minus,
} from 'lucide-react';

import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';
import { cn } from '@/lib/utils';
import { StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { usePdfDownload, getStageLabel } from '@/hooks/usePdfDownload';

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

export type DesempenhoSimuladoPanelProps = {
  simuladosWithResults: Array<{ id: string; title: string }>;
  selectedSimuladoId: string | null;
  onSelectSimulado: (id: string) => void;
  breakdown: PerformanceBreakdown;
  questions: Question[];
  examState?: ExamState | null;
  studentName?: string;
  resultNavVariant?: 'public' | 'admin';
};

type Tier = 'success' | 'warning' | 'destructive';

function scoreTier(score: number): Tier {
  if (score >= 70) return 'success';
  if (score >= 50) return 'warning';
  return 'destructive';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panel
 * ────────────────────────────────────────────────────────────────────────── */

export function DesempenhoSimuladoPanel({
  simuladosWithResults,
  selectedSimuladoId,
  onSelectSimulado,
  breakdown,
  questions,
  examState,
  studentName,
  resultNavVariant = 'public',
}: DesempenhoSimuladoPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedSubspecialty, setSelectedSubspecialty] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  const { overall, byArea, bySubspecialty, byTheme } = breakdown;
  const bestArea = byArea[0] ?? null;
  const worstArea = byArea.length > 1 ? byArea[byArea.length - 1] : null;

  const simuladoTitle = useMemo(
    () => simuladosWithResults.find((s) => s.id === selectedSimuladoId)?.title ?? '',
    [simuladosWithResults, selectedSimuladoId],
  );

  const pdf = usePdfDownload({
    simuladoId: selectedSimuladoId ?? '',
    simuladoTitle,
    studentName: studentName ?? 'Aluno',
    questions,
    examState: examState ?? null,
    breakdown,
  });

  const subspecialtiesForSpecialty = useMemo(
    () =>
      selectedSpecialty
        ? bySubspecialty.filter((s) => s.specialty === selectedSpecialty)
        : [],
    [selectedSpecialty, bySubspecialty],
  );

  const themesForSubspecialty = useMemo(
    () =>
      selectedSpecialty && selectedSubspecialty
        ? byTheme.filter(
            (t) => t.specialty === selectedSpecialty && t.area === selectedSubspecialty,
          )
        : [],
    [selectedSpecialty, selectedSubspecialty, byTheme],
  );

  const questionResultsForTheme = useMemo(() => {
    if (!selectedTheme || !selectedSpecialty || !selectedSubspecialty) return [];
    return breakdown.overall.questionResults
      .filter((q) => {
        if (q.area !== selectedSpecialty) return false;
        const parts = q.theme.split('>').map((p) => p.trim());
        return parts[0] === selectedSubspecialty && (parts[1] || '') === selectedTheme;
      })
      .map((q) => {
        const question = questions.find((item) => item.id === q.questionId);
        return { ...q, number: question?.number ?? null, text: question?.text ?? '' };
      });
  }, [selectedTheme, selectedSpecialty, selectedSubspecialty, breakdown, questions]);

  const handleSelectSimulado = (sid: string) => {
    onSelectSimulado(sid);
    setSelectedSpecialty(null);
    setSelectedSubspecialty(null);
    setSelectedTheme(null);
  };

  return (
    <StaggerContainer className="space-y-6 md:space-y-8">
      {/* Tabs de simulado (apenas quando > 1) */}
      {simuladosWithResults.length > 1 && (
        <StaggerItem>
          <SimuladoTabs
            simulados={simuladosWithResults}
            selectedId={selectedSimuladoId}
            onSelect={handleSelectSimulado}
          />
        </StaggerItem>
      )}

      {/* Hero de performance */}
      <StaggerItem>
        <PerformanceHeroCard
          overall={overall}
          bestArea={bestArea}
          worstArea={worstArea}
          prefersReducedMotion={!!prefersReducedMotion}
          pdf={pdf}
        />
      </StaggerItem>

      {/* Breadcrumb (drill-down) */}
      {(selectedSpecialty || selectedSubspecialty) && (
        <StaggerItem>
          <Breadcrumb
            specialty={selectedSpecialty}
            subspecialty={selectedSubspecialty}
            onReset={() => {
              setSelectedSpecialty(null);
              setSelectedSubspecialty(null);
              setSelectedTheme(null);
            }}
            onBackToSpecialty={() => {
              setSelectedSubspecialty(null);
              setSelectedTheme(null);
            }}
          />
        </StaggerItem>
      )}

      {/* Drill-down level 1: Especialidade */}
      {!selectedSpecialty && (
        <StaggerItem>
          <AreaGridSection title="Especialidade">
            {byArea.map((area, idx) => (
              <AreaCard
                key={area.area}
                label={area.area}
                correct={area.correct}
                total={area.questions}
                score={area.score}
                isBest={idx === 0 && byArea.length > 1}
                isWorst={idx === byArea.length - 1 && byArea.length > 1}
                onClick={() => {
                  setSelectedSpecialty(area.area);
                  setSelectedSubspecialty(null);
                  setSelectedTheme(null);
                }}
                prefersReducedMotion={!!prefersReducedMotion}
              />
            ))}
          </AreaGridSection>
        </StaggerItem>
      )}

      {/* Drill-down level 2: Subespecialidade */}
      {selectedSpecialty && !selectedSubspecialty && (
        <StaggerItem>
          <AnimatePresence mode="wait">
            <motion.div
              key={`subspec-${selectedSpecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <AreaGridSection title="Subespecialidade">
                {subspecialtiesForSpecialty.length === 0 ? (
                  <EmptyDrill label="Nenhuma subespecialidade encontrada." />
                ) : (
                  subspecialtiesForSpecialty.map((sub, idx) => (
                    <AreaCard
                      key={sub.subspecialty}
                      label={sub.subspecialty}
                      correct={sub.correct}
                      total={sub.questions}
                      score={sub.score}
                      isBest={idx === 0 && subspecialtiesForSpecialty.length > 1}
                      isWorst={
                        idx === subspecialtiesForSpecialty.length - 1 &&
                        subspecialtiesForSpecialty.length > 1
                      }
                      onClick={() => {
                        setSelectedSubspecialty(sub.subspecialty);
                        setSelectedTheme(null);
                      }}
                      prefersReducedMotion={!!prefersReducedMotion}
                    />
                  ))
                )}
              </AreaGridSection>
            </motion.div>
          </AnimatePresence>
        </StaggerItem>
      )}

      {/* Drill-down level 3: Tema + Questões */}
      {selectedSpecialty && selectedSubspecialty && (
        <StaggerItem>
          <AnimatePresence mode="wait">
            <motion.div
              key={`theme-${selectedSubspecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <SectionHeader title="Tema" />
              {themesForSubspecialty.length === 0 ? (
                <EmptyDrill label="Nenhum tema encontrado." />
              ) : (
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {themesForSubspecialty.map((theme) => (
                      <ThemeAccordionRow
                        key={theme.theme}
                        theme={theme.theme}
                        score={theme.score}
                        correct={theme.correct}
                        total={theme.total}
                        isOpen={selectedTheme === theme.theme}
                        onToggle={() =>
                          setSelectedTheme((prev) =>
                            prev === theme.theme ? null : theme.theme,
                          )
                        }
                        questionResults={
                          selectedTheme === theme.theme ? questionResultsForTheme : []
                        }
                        simuladoId={selectedSimuladoId ?? ''}
                        prefersReducedMotion={!!prefersReducedMotion}
                        correcaoVariant={resultNavVariant}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </StaggerItem>
      )}

      {/* Summary (Best + Worst) */}
      {byArea.length > 1 && bestArea && worstArea && (
        <StaggerItem>
          <SummarySection bestArea={bestArea} worstArea={worstArea} />
        </StaggerItem>
      )}

      {/* Evolução por especialidade */}
      {byArea.length > 0 && (
        <StaggerItem>
          <EvoBarsSection byArea={byArea} prefersReducedMotion={!!prefersReducedMotion} />
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * SimuladoTabs
 * ────────────────────────────────────────────────────────────────────────── */

function SimuladoTabs({
  simulados,
  selectedId,
  onSelect,
}: {
  simulados: Array<{ id: string; title: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Escolher simulado"
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
    >
      {simulados.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            title={s.title}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {s.title.length > 32 ? `${s.title.slice(0, 32)}…` : s.title}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * PerformanceHeroCard — dark premium, idioma HomeHeroPerformanceCard
 * ────────────────────────────────────────────────────────────────────────── */

function PerformanceHeroCard({
  overall,
  bestArea,
  worstArea,
  prefersReducedMotion,
  pdf,
}: {
  overall: { percentageScore: number; totalCorrect: number; totalQuestions: number };
  bestArea: { area: string; score: number; correct: number; questions: number } | null;
  worstArea: { area: string; score: number; correct: number; questions: number } | null;
  prefersReducedMotion: boolean;
  pdf: ReturnType<typeof usePdfDownload>;
}) {
  const pct = overall.percentageScore;
  const pdfLabel = pdf.stage
    ? `${getStageLabel(pdf.stage)}${pdf.progress ? ` (${pdf.progress.current}/${pdf.progress.total})` : ''}`
    : 'Prova Revisada PDF';

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)] p-5 md:p-7 shadow-[0_20px_40px_-20px_rgba(10,14,26,0.85),0_8px_20px_-12px_rgba(60,12,32,0.45)]">
      {/* Atmospheric layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[rgba(232,56,98,0.18)] blur-[70px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-[rgba(12,18,32,0.55)] blur-[50px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_50%_at_18%_12%,rgba(255,255,255,0.08)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
      />

      <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-end md:gap-8">
        {/* Score block */}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(249,168,212,0.9)]">
            Aproveitamento geral
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="text-[36px] font-extrabold leading-none tracking-[-0.035em] text-white tabular-nums sm:text-[44px] md:text-[52px] lg:text-[56px]">
              {overall.totalCorrect}
              <span className="text-white/30">/</span>
              {overall.totalQuestions}
            </p>
            <span className="text-[16px] font-bold tabular-nums text-white/65 md:text-[18px]">
              {pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-4 max-w-md">
            <div
              className="h-[6px] overflow-hidden rounded-full bg-white/[0.08]"
              role="progressbar"
              aria-valuenow={overall.totalCorrect}
              aria-valuemax={overall.totalQuestions}
              aria-label={`${overall.totalCorrect} de ${overall.totalQuestions} questões corretas`}
            >
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.8,
                  ease: 'easeOut',
                  delay: prefersReducedMotion ? 0 : 0.15,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/45">
              {overall.totalCorrect} {overall.totalCorrect === 1 ? 'acerto' : 'acertos'} entre{' '}
              {overall.totalQuestions} {overall.totalQuestions === 1 ? 'questão' : 'questões'}.
            </p>
          </div>
        </div>

        {/* Mini-stats + CTA PDF */}
        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {(bestArea || worstArea) && (
            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
              {bestArea && (
                <MiniStat
                  label="Melhor"
                  area={bestArea.area}
                  correct={bestArea.correct}
                  total={bestArea.questions}
                  tone="success"
                />
              )}
              {worstArea && (
                <MiniStat
                  label="Foco"
                  area={worstArea.area}
                  correct={worstArea.correct}
                  total={worstArea.questions}
                  tone="destructive"
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={pdf.downloadProvaRevisada}
            disabled={pdf.downloading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.06] px-4 py-2.5 text-[12px] font-semibold text-white/85 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.22] hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#11192A]"
          >
            {pdf.downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden />
            )}
            {pdfLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  area,
  correct,
  total,
  tone,
}: {
  label: string;
  area: string;
  correct: number;
  total: number;
  tone: 'success' | 'destructive';
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
      : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2',
        toneClasses,
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">
        {label}
      </span>
      <span className="text-[15px] font-extrabold leading-none tabular-nums">
        {correct}
        <span className="text-white/35">/</span>
        {total}
      </span>
      <span className="truncate max-w-[140px] text-[10px] font-medium text-white/55" title={area}>
        {area}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Breadcrumb
 * ────────────────────────────────────────────────────────────────────────── */

function Breadcrumb({
  specialty,
  subspecialty,
  onReset,
  onBackToSpecialty,
}: {
  specialty: string | null;
  subspecialty: string | null;
  onReset: () => void;
  onBackToSpecialty: () => void;
}) {
  return (
    <nav
      aria-label="Navegação de drill-down"
      className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground"
    >
      <button
        type="button"
        onClick={onReset}
        className="rounded font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
      >
        Especialidades
      </button>
      {specialty && (
        <>
          <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
          <button
            type="button"
            onClick={onBackToSpecialty}
            className={cn(
              'rounded font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline',
              !subspecialty && 'font-semibold text-foreground',
            )}
          >
            {specialty}
          </button>
        </>
      )}
      {subspecialty && (
        <>
          <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
          <span className="font-semibold text-foreground">{subspecialty}</span>
        </>
      )}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Section helpers
 * ────────────────────────────────────────────────────────────────────────── */

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {action}
    </div>
  );
}

function AreaGridSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function EmptyDrill({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-body-sm text-muted-foreground">
      {label}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * AreaCard
 * ────────────────────────────────────────────────────────────────────────── */

function AreaCard({
  label,
  correct,
  total,
  score,
  isBest,
  isWorst,
  onClick,
  prefersReducedMotion,
}: {
  label: string;
  correct: number;
  total: number;
  score: number;
  isBest: boolean;
  isWorst: boolean;
  onClick: () => void;
  prefersReducedMotion: boolean;
}) {
  const tier = scoreTier(score);

  const tierBar =
    tier === 'success'
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
      : tier === 'warning'
        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
        : 'bg-gradient-to-r from-rose-500 to-rose-600';

  const tierText =
    tier === 'success'
      ? 'text-success'
      : tier === 'warning'
        ? 'text-warning'
        : 'text-destructive';

  const tierChipClass =
    tier === 'success'
      ? 'bg-success/10 text-success'
      : tier === 'warning'
        ? 'bg-warning/15 text-warning-foreground border border-warning/30'
        : 'bg-destructive/10 text-destructive';

  // Subtle visual weight for best/worst
  const frameClass = isBest
    ? 'border-success/30 shadow-[0_4px_14px_-6px_hsl(152_60%_36%/0.25)]'
    : isWorst
      ? 'border-destructive/30 shadow-[0_4px_14px_-6px_hsl(0_72%_51%/0.2)]'
      : 'border-border';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      aria-label={`${label}: ${correct} de ${total} acertos, ${score}% de aproveitamento`}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all duration-200',
        'hover:border-primary/30 hover:shadow-[0_8px_22px_-12px_hsl(345_65%_30%/0.22)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        frameClass,
      )}
    >
      {/* Top: label + chevron */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-caption font-semibold text-foreground" title={label}>
          {label}
        </p>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>

      {/* Middle: score + % chip */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p
          className={cn(
            'text-[26px] font-extrabold leading-none tracking-[-0.025em] tabular-nums',
            tierText,
          )}
        >
          {correct}
          <span className="text-muted-foreground/40">/</span>
          {total}
        </p>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wide',
            tierChipClass,
          )}
        >
          {score}%
        </span>
      </div>

      {/* Footer: progress bar + questions count */}
      <div className="mt-3">
        <div
          className="h-[6px] overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={correct}
          aria-valuemax={total}
        >
          <motion.div
            className={cn('h-full rounded-full', tierBar)}
            initial={{ width: prefersReducedMotion ? `${score}%` : 0 }}
            animate={{ width: `${score}%` }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.6,
              ease: 'easeOut',
              delay: prefersReducedMotion ? 0 : 0.1,
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {total} {total === 1 ? 'questão' : 'questões'}
        </p>
      </div>
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ThemeAccordionRow
 * ────────────────────────────────────────────────────────────────────────── */

function ThemeAccordionRow({
  theme,
  score,
  correct,
  total,
  isOpen,
  onToggle,
  questionResults,
  simuladoId,
  prefersReducedMotion,
  correcaoVariant,
}: {
  theme: string;
  score: number;
  correct: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  questionResults: Array<{
    questionId: string;
    number: number | null;
    text: string;
    isCorrect: boolean;
    wasAnswered: boolean;
  }>;
  simuladoId: string;
  prefersReducedMotion: boolean;
  correcaoVariant: 'public' | 'admin';
}) {
  const tier = scoreTier(score);
  const scoreColor =
    tier === 'success' ? 'text-success' : tier === 'warning' ? 'text-warning' : 'text-destructive';

  const correcaoBase =
    correcaoVariant === 'admin'
      ? `/admin/preview/simulados/${simuladoId}/correcao`
      : `/simulados/${simuladoId}/correcao`;

  const contentId = `theme-content-${theme.replace(/\s+/g, '-')}`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors duration-200',
        isOpen ? 'border-primary/30 bg-card' : 'border-border bg-card/60 hover:border-primary/20',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-inset"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90 text-primary',
            )}
            aria-hidden
          />
          <span className="truncate text-[13px] font-semibold text-foreground">{theme}</span>
        </div>
        <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', scoreColor)}>
          {correct}
          <span className="text-muted-foreground/40">/</span>
          {total}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            key="content"
            initial={prefersReducedMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 bg-muted/30 px-2 py-1.5">
              {questionResults.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-muted-foreground">
                  Nenhuma questão encontrada.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {questionResults.map((q, idx) => (
                    <li key={q.questionId}>
                      <QuestionRow
                        number={q.number}
                        text={q.text}
                        isCorrect={q.isCorrect}
                        wasAnswered={q.wasAnswered}
                        href={`${correcaoBase}?q=${q.number ?? idx + 1}`}
                        fallbackIdx={idx + 1}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionRow({
  number,
  text,
  isCorrect,
  wasAnswered,
  href,
  fallbackIdx,
}: {
  number: number | null;
  text: string;
  isCorrect: boolean;
  wasAnswered: boolean;
  href: string;
  fallbackIdx: number;
}) {
  const tone = isCorrect ? 'success' : wasAnswered ? 'destructive' : 'neutral';
  const badgeClass =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'destructive'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-warning/15 text-warning-foreground';
  const Icon = isCorrect ? Check : wasAnswered ? X : Minus;
  const badgeLabel = isCorrect ? 'Acerto' : wasAnswered ? 'Erro' : 'Em branco';

  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 no-underline transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
        <span className="mr-1.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          Q{number ?? fallbackIdx}
        </span>
        {text || `Questão ${number ?? fallbackIdx}`}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          badgeClass,
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        {badgeLabel}
      </span>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * SummarySection
 * ────────────────────────────────────────────────────────────────────────── */

function SummarySection({
  bestArea,
  worstArea,
}: {
  bestArea: { area: string; score: number; correct: number; questions: number };
  worstArea: { area: string; score: number; correct: number; questions: number };
}) {
  return (
    <section aria-label="Resumo do desempenho">
      <SectionHeader title="Resumo do desempenho" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={Star}
          tone="success"
          title="Onde você brilha"
          area={bestArea.area}
          correct={bestArea.correct}
          total={bestArea.questions}
          score={bestArea.score}
          description={`Sua principal fortaleza foi em ${bestArea.area} com ${bestArea.correct}/${bestArea.questions} acertos.`}
        />
        <SummaryCard
          icon={TrendingDown}
          tone="destructive"
          title="Próximo foco"
          area={worstArea.area}
          correct={worstArea.correct}
          total={worstArea.questions}
          score={worstArea.score}
          description={`A especialidade com maior oportunidade é ${worstArea.area} com ${worstArea.correct}/${worstArea.questions} acertos.`}
        />
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  title,
  area,
  correct,
  total,
  score,
  description,
}: {
  icon: typeof Star;
  tone: 'success' | 'destructive';
  title: string;
  area: string;
  correct: number;
  total: number;
  score: number;
  description: string;
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-success/20 bg-success/[0.04]'
      : 'border-destructive/20 bg-destructive/[0.04]';
  const iconTone = tone === 'success' ? 'text-success' : 'text-destructive';
  const iconBg = tone === 'success' ? 'bg-success/15' : 'bg-destructive/15';
  const scoreTone = tone === 'success' ? 'text-success' : 'text-destructive';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-shadow duration-200 hover:shadow-[0_8px_22px_-14px_rgba(0,0,0,0.12)]',
        toneClasses,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', iconTone)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={cn('text-[13px] font-bold uppercase tracking-wide', iconTone)}>
            {title}
          </h4>
          <p className="mt-1 truncate text-[15px] font-bold text-foreground" title={area}>
            {area}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-[18px] font-extrabold leading-none tabular-nums', scoreTone)}>
              {correct}
              <span className="text-muted-foreground/40">/</span>
              {total}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              {score}%
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * EvoBarsSection
 * ────────────────────────────────────────────────────────────────────────── */

function EvoBarsSection({
  byArea,
  prefersReducedMotion,
}: {
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>;
  prefersReducedMotion: boolean;
}) {
  return (
    <section aria-label="Evolução por especialidade">
      <SectionHeader title="Evolução por especialidade" />
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <ul className="space-y-3.5">
          {byArea.map((area, i) => {
            const tier = scoreTier(area.score);
            const fill =
              tier === 'success'
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : tier === 'warning'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-[#8e1f3d] to-[#e83862]';
            return (
              <li key={area.area}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Stethoscope
                      className="h-4 w-4 shrink-0 text-muted-foreground/50"
                      aria-hidden
                    />
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {area.area}
                    </span>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
                    {area.correct}
                    <span className="text-muted-foreground/40">/</span>
                    {area.questions}
                  </span>
                </div>
                <div
                  className="h-[7px] overflow-hidden rounded-full bg-primary/[0.08]"
                  role="progressbar"
                  aria-valuenow={area.correct}
                  aria-valuemax={area.questions}
                  aria-label={`${area.area}: ${area.score}% de aproveitamento`}
                >
                  <motion.div
                    className={cn('h-full rounded-full', fill)}
                    initial={{ width: prefersReducedMotion ? `${area.score}%` : 0 }}
                    animate={{ width: `${area.score}%` }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.7,
                      delay: prefersReducedMotion ? 0 : i * 0.06,
                      ease: 'easeOut',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
