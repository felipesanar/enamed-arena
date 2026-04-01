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
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          <span>{theme}</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-success/20 bg-success/[0.03] p-4">
          <h4 className="font-semibold flex items-center gap-2 text-success text-[12px] mb-2">
            <Star className="h-3.5 w-3.5" aria-hidden /> Onde você brilha
          </h4>
          <p className="text-[12px] text-muted-foreground">
            {`Sua principal fortaleza foi em ${bestArea} com ${bestScore}%.`}
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4">
          <h4 className="font-semibold flex items-center gap-2 text-destructive text-[12px] mb-2">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden /> Próximo foco
          </h4>
          <p className="text-[12px] text-muted-foreground">
            {`A área com maior oportunidade é ${worstArea} com ${worstScore}%.`}
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
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-hidden />
                  <span className="text-[12px] font-medium text-foreground">{area.area}</span>
                </div>
                <span className="text-[12px] font-bold text-foreground tabular-nums">
                  {area.score}% <span className="text-[10px] font-normal text-muted-foreground">· {area.correct}/{area.questions}</span>
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
