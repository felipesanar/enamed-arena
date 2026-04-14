import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';
import { cn } from '@/lib/utils';
import { Star, TrendingDown, Stethoscope, ChevronRight, Download, Loader2, FileText } from 'lucide-react';
import { usePdfDownload, getStageLabel } from '@/hooks/usePdfDownload';

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
  const bestArea = byArea[0];
  const worstArea = byArea[byArea.length - 1];

  const subspecialtiesForSpecialty = useMemo(
    () => selectedSpecialty ? bySubspecialty.filter(s => s.specialty === selectedSpecialty) : [],
    [selectedSpecialty, bySubspecialty],
  );

  const themesForSubspecialty = useMemo(
    () => selectedSpecialty && selectedSubspecialty
      ? byTheme.filter(t => t.specialty === selectedSpecialty && t.area === selectedSubspecialty)
      : [],
    [selectedSpecialty, selectedSubspecialty, byTheme],
  );

  const questionResultsForTheme = useMemo(() => {
    if (!selectedTheme || !selectedSpecialty || !selectedSubspecialty) return [];
    return breakdown.overall.questionResults
      .filter(q => {
        if (q.area !== selectedSpecialty) return false;
        const parts = q.theme.split('>').map(p => p.trim());
        return parts[0] === selectedSubspecialty && (parts[1] || '') === selectedTheme;
      })
      .map(q => {
        const question = questions.find(item => item.id === q.questionId);
        return { ...q, number: question?.number ?? null, text: question?.text ?? '' };
      });
  }, [selectedTheme, selectedSpecialty, selectedSubspecialty, breakdown, questions]);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top,0px)+1.5rem)] md:pt-6 p-2 md:p-3"
    >
      <HeroSection
        simuladosWithResults={simuladosWithResults}
        selectedSimuladoId={selectedSimuladoId}
        onSelectSimulado={(sid) => {
          onSelectSimulado(sid);
          setSelectedSpecialty(null);
          setSelectedSubspecialty(null);
          setSelectedTheme(null);
        }}
        overall={overall}
        bestArea={bestArea}
        worstArea={worstArea}
      />


      <div className="bg-white px-5 py-6 md:px-6 md:py-7 space-y-6">

        {/* Breadcrumb */}
        {(selectedSpecialty || selectedSubspecialty) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <button
              type="button"
              onClick={() => { setSelectedSpecialty(null); setSelectedSubspecialty(null); setSelectedTheme(null); }}
              className="hover:text-foreground transition-colors"
            >
              Especialidades
            </button>
            {selectedSpecialty && (
              <>
                <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />
                <button
                  type="button"
                  onClick={() => { setSelectedSubspecialty(null); setSelectedTheme(null); }}
                  className={cn('hover:text-foreground transition-colors', !selectedSubspecialty && 'text-foreground font-semibold')}
                >
                  {selectedSpecialty}
                </button>
              </>
            )}
            {selectedSubspecialty && (
              <>
                <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />
                <span className="text-foreground font-semibold">{selectedSubspecialty}</span>
              </>
            )}
          </div>
        )}

        {/* Level 1: Especialidade */}
        {!selectedSpecialty && (
          <div>
            <p className="text-[11px] uppercase tracking-[1.2px] text-muted-foreground font-semibold mb-3">Especialidade</p>
            <div className="grid grid-cols-2 gap-2">
              {byArea.map((area, idx) => (
                <AreaCard
                  key={area.area}
                  label={area.area}
                  correct={area.correct}
                  questions={area.questions}
                  score={area.score}
                  isBest={idx === 0}
                  isWorst={idx === byArea.length - 1}
                  isSelected={false}
                  onClick={() => {
                    setSelectedSpecialty(area.area);
                    setSelectedSubspecialty(null);
                    setSelectedTheme(null);
                  }}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              ))}
            </div>
          </div>
        )}

        {/* Level 2: Subespecialidade */}
        {selectedSpecialty && !selectedSubspecialty && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`subspec-${selectedSpecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-[11px] uppercase tracking-[1.2px] text-muted-foreground font-semibold mb-3">Subespecialidade</p>
              {subspecialtiesForSpecialty.length === 0 ? (
                <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-border/40 text-[13px] text-muted-foreground/60">
                  Nenhuma subespecialidade encontrada
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {subspecialtiesForSpecialty.map((sub, idx) => (
                    <AreaCard
                      key={sub.subspecialty}
                      label={sub.subspecialty}
                      correct={sub.correct}
                      questions={sub.questions}
                      score={sub.score}
                      isBest={idx === 0}
                      isWorst={idx === subspecialtiesForSpecialty.length - 1}
                      isSelected={false}
                      onClick={() => {
                        setSelectedSubspecialty(sub.subspecialty);
                        setSelectedTheme(null);
                      }}
                      prefersReducedMotion={!!prefersReducedMotion}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Level 3: Tema */}
        {selectedSpecialty && selectedSubspecialty && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`theme-${selectedSubspecialty}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-[11px] uppercase tracking-[1.2px] text-muted-foreground font-semibold mb-3">
                Tema
              </p>
              {themesForSubspecialty.length === 0 ? (
                <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-border/40 text-[13px] text-muted-foreground/60">
                  Nenhum tema encontrado
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {themesForSubspecialty.map(theme => (
                      <ThemeAccordionRow
                        key={theme.theme}
                        theme={theme.theme}
                        score={theme.score}
                        correct={theme.correct}
                        total={theme.total}
                        isOpen={selectedTheme === theme.theme}
                        onToggle={() => setSelectedTheme(prev => (prev === theme.theme ? null : theme.theme))}
                        questionResults={selectedTheme === theme.theme ? questionResultsForTheme : []}
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
        )}

        <hr className="border-border/40" />

        {byArea.length > 1 && (
          <SummarySection
            bestArea={bestArea.area}
            bestCorrect={bestArea.correct}
            bestTotal={bestArea.questions}
            worstArea={worstArea.area}
            worstCorrect={worstArea.correct}
            worstTotal={worstArea.questions}
          />
        )}

        {byArea.length > 1 && <hr className="border-border/40" />}

        <EvoBars byArea={byArea} prefersReducedMotion={!!prefersReducedMotion} />
      </div>
    </motion.div>
  );
}

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
  bestArea: { area: string; score: number; correct: number; questions: number } | null;
  worstArea: { area: string; score: number; correct: number; questions: number } | null;
}) {
  return (
    <div className="relative overflow-hidden bg-[linear-gradient(135deg,#421424_0%,hsl(340,58%,14%)_50%,#0f111a_100%)] px-5 py-6 md:px-8 md:py-8 rounded-[22px] md:rounded-[28px]">
      <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[hsl(345,72%,48%)] blur-[60px] opacity-25" />

      <div className="mb-3">
        <span className="text-[9px] uppercase tracking-[1.5px] text-white/40 font-bold block mb-1">Análise de Performance</span>
        <h1 className="text-[22px] font-bold text-white leading-tight">Desempenho</h1>
        <p className="text-[11px] text-white/40 mt-0.5">Sua evolução por área e tema.</p>
      </div>

      {simuladosWithResults.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-0.5">
          {simuladosWithResults.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSimulado(s.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold transition-all duration-200',
                s.id === selectedSimuladoId
                  ? 'bg-white/[0.14] border-white/[0.28] text-white'
                  : 'bg-white/[0.05] border-white/[0.10] text-white/40 hover:text-white/60',
              )}
            >
              {s.title.length > 20 ? `${s.title.slice(0, 20)}…` : s.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative z-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[1.5px] text-white/40 mb-1">Total de acertos</p>
          <p className="text-[40px] font-black tracking-[-2px] text-white leading-none">{overall.totalCorrect}/{overall.totalQuestions}</p>
          <p className="text-[10px] text-white/40 mt-1">
            {overall.percentageScore}% de aproveitamento
          </p>
        </div>
        <div className="flex gap-2 mb-1">
          {bestArea && (
            <div className="bg-white/[0.08] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-center">
              <p className="text-[14px] font-extrabold text-green-400 leading-none">{bestArea.correct}/{bestArea.questions}</p>
              <p className="text-[7px] text-white/40 mt-1">melhor espec.</p>
            </div>
          )}
          {worstArea && bestArea?.area !== worstArea.area && (
            <div className="bg-white/[0.08] border border-white/[0.12] rounded-[10px] px-3 py-1.5 text-center">
              <p className="text-[14px] font-extrabold text-red-400 leading-none">{worstArea.correct}/{worstArea.questions}</p>
              <p className="text-[7px] text-white/40 mt-1">foco</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AreaCard({
  label, score, correct, questions, isBest, isWorst, isSelected, onClick, prefersReducedMotion,
}: {
  label: string; score: number; correct: number; questions: number;
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
      type="button"
      onClick={onClick}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'w-full text-left bg-white border rounded-[12px] p-3.5 cursor-pointer transition-all duration-200',
        borderClass,
      )}
    >
      <p className="text-[11px] text-muted-foreground truncate mb-1">{label}</p>
      <p className={cn('text-[24px] font-black tracking-[-0.8px] leading-none tabular-nums', scoreColor)}>{correct}/{questions}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{questions} questões</p>
      <div className="h-[4px] rounded-full bg-border/40 mt-2 overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
    </motion.button>
  );
}

function ThemeAccordionRow({
  theme, score, correct, total, isOpen, onToggle, questionResults, simuladoId, prefersReducedMotion, correcaoVariant,
}: {
  theme: string; score: number; correct: number; total: number; isOpen: boolean; onToggle: () => void;
  questionResults: Array<{ questionId: string; number: number | null; text: string; isCorrect: boolean; wasAnswered: boolean }>;
  simuladoId: string; prefersReducedMotion: boolean;
  correcaoVariant: 'public' | 'admin';
}) {
  const scoreColor = score >= 70 ? 'text-green-700' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const correcaoBase =
    correcaoVariant === 'admin'
      ? `/admin/preview/simulados/${simuladoId}/correcao`
      : `/simulados/${simuladoId}/correcao`;

  return (
    <div
      className={cn(
        'rounded-[9px] overflow-hidden border transition-colors duration-200',
        isOpen ? 'border-primary/30 bg-white' : 'border-border/40 bg-[#fafafa]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex justify-between items-center px-3.5 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          <span>{theme}</span>
        </span>
        <span className={cn('text-[13px] font-bold tabular-nums', scoreColor)}>{correct}/{total}</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={prefersReducedMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-primary/10 px-3 py-2 flex flex-col gap-0.5">
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
                    to={`${correcaoBase}?q=${q.number ?? idx + 1}`}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-border/[0.06] last:border-b-0 no-underline hover:bg-accent/20 rounded px-1 transition-colors"
                  >
                    <span className="text-[12px] text-foreground truncate flex-1">
                      {q.text || `Questão ${q.number ?? idx + 1}`}
                    </span>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-[5px] shrink-0', badgeClass)}>
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
  bestArea, bestCorrect, bestTotal, worstArea, worstCorrect, worstTotal,
}: {
  bestArea: string; bestCorrect: number; bestTotal: number;
  worstArea: string; worstCorrect: number; worstTotal: number;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[1.2px] text-muted-foreground font-semibold mb-3">Resumo do desempenho</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-success/20 bg-success/[0.03] p-5">
          <h4 className="font-semibold flex items-center gap-2 text-success text-[14px] mb-2">
            <Star className="h-4 w-4" aria-hidden /> Onde você brilha
          </h4>
          <p className="text-[13px] text-muted-foreground">
            {`Sua principal fortaleza foi em ${bestArea} com ${bestCorrect}/${bestTotal} acertos.`}
          </p>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-5">
          <h4 className="font-semibold flex items-center gap-2 text-destructive text-[14px] mb-2">
            <TrendingDown className="h-4 w-4" aria-hidden /> Próximo foco
          </h4>
          <p className="text-[13px] text-muted-foreground">
            {`A especialidade com maior oportunidade é ${worstArea} com ${worstCorrect}/${worstTotal} acertos.`}
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
      <p className="text-[11px] uppercase tracking-[1.2px] text-muted-foreground font-semibold mb-3">Evolução por especialidade</p>
      <div className="space-y-3.5">
        {byArea.map((area, i) => {
          const isWorst = i === lastIdx;
          const fillClass = isWorst
            ? 'bg-gradient-to-r from-[#991b1b] to-[#ef4444]'
            : 'bg-gradient-to-r from-[#8e1f3d] to-[#e83862]';
          return (
            <div key={area.area}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground/50 shrink-0" aria-hidden />
                  <span className="text-[13px] font-medium text-foreground">{area.area}</span>
                </div>
                <span className="text-[13px] font-bold text-foreground tabular-nums">
                  {area.correct}/{area.questions}
                </span>
              </div>
              <div className="h-[7px] bg-primary/[0.08] rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', fillClass)}
                  initial={{ width: prefersReducedMotion ? `${area.score}%` : '0%' }}
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
