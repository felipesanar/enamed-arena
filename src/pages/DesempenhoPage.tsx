import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { StatCard } from '@/components/StatCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useSimulados } from '@/hooks/useSimulados';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResults } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown, type ThemePerformance } from '@/lib/resultHelpers';
import { cn } from '@/lib/utils';
import {
  BarChart3, BookOpen, Stethoscope, Target, Star, TrendingDown, FileText,
} from 'lucide-react';
import type { AreaPerformance } from '@/types';

function PerformanceNode({
  name, score, total, correct, isSelected, onClick,
}: {
  name: string; score: number; total: number; correct: number; isSelected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(
      'w-full text-left p-3.5 rounded-xl border transition-all duration-200',
      isSelected ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border/40 hover:bg-accent/30 hover:border-border/60',
    )}>
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium text-body-sm">{name}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-caption', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{correct}/{total}</span>
          <span className={cn('font-bold text-body-sm tabular-nums', isSelected ? 'text-primary-foreground' : 'text-primary')}>{score}%</span>
        </div>
      </div>
    </button>
  );
}

export default function DesempenhoPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading: loadingSimulados } = useSimulados();
  const simuladosWithResults = useMemo(() => simulados.filter(s => canViewResults(s.status)), [simulados]);

  const [selectedSimuladoId, setSelectedSimuladoId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Set default selected simulado when data loads
  useEffect(() => {
    if (!selectedSimuladoId && simuladosWithResults.length > 0) {
      setSelectedSimuladoId(simuladosWithResults[0].id);
    }
  }, [simuladosWithResults, selectedSimuladoId]);

  const { simulado: selectedSimulado, questions, loading: loadingDetail } = useSimuladoDetail(selectedSimuladoId || undefined);
  const { examState, loading: loadingExam } = useExamResult(selectedSimuladoId || undefined);

  const breakdown = useMemo(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !questions.length) return null;
    return computePerformanceBreakdown(examState, questions);
  }, [examState, questions]);

  const loading = loadingSimulados || loadingDetail || loadingExam;

  if (loading && !breakdown) {
    return (
      <>
        <PageHeader title="Desempenho" subtitle="Sua evolução por área e tema." badge="Análise de Performance" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard />
      </>
    );
  }

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

  return (
    <>
      <PageHeader title="Desempenho" subtitle="Sua evolução por área e tema." badge="Análise de Performance" />

      {simuladosWithResults.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {simuladosWithResults.map(s => (
            <button key={s.id} onClick={() => { setSelectedSimuladoId(s.id); setSelectedArea(null); }} className={cn(
              'px-4 py-2 rounded-xl text-body-sm font-medium transition-all whitespace-nowrap',
              s.id === selectedSimuladoId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted',
            )}>{s.title}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Aproveitamento geral" value={`${overall.percentageScore}%`} icon={BarChart3} delay={0} />
        <StatCard label="Acertos" value={`${overall.totalCorrect}/${overall.totalQuestions}`} icon={Target} delay={0.08} />
        <StatCard label="Questões respondidas" value={String(overall.totalAnswered)} icon={BookOpen} delay={0.16} />
      </div>

      {byArea.length > 1 && (
        <PremiumCard className="p-5 md:p-6 mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" aria-hidden /></div>
            <h3 className="text-heading-3 text-foreground">Resumo do seu desempenho</h3>
          </div>
          <p className="text-body text-muted-foreground mb-5">
            Seu aproveitamento geral foi de <strong className="text-foreground">{overall.percentageScore}%</strong> ({overall.totalCorrect}/{overall.totalQuestions} questões).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-success/20 bg-success/[0.03] p-4">
              <h4 className="font-semibold flex items-center gap-2 text-success text-body-sm mb-2"><Star className="h-4 w-4" aria-hidden /> Onde você brilha</h4>
              <p className="text-body-sm text-muted-foreground">Sua principal fortaleza foi em <strong className="text-foreground">{bestArea.area}</strong> com <strong className="text-foreground">{bestArea.score}%</strong>.</p>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4">
              <h4 className="font-semibold flex items-center gap-2 text-destructive text-body-sm mb-2"><TrendingDown className="h-4 w-4" aria-hidden /> Próximo foco</h4>
              <p className="text-body-sm text-muted-foreground">A área com maior oportunidade é <strong className="text-foreground">{worstArea.area}</strong> com <strong className="text-foreground">{worstArea.score}%</strong>.</p>
            </div>
          </div>
        </PremiumCard>
      )}

      {/* Análise por área e tema */}
      <PremiumCard className="p-5 md:p-6 mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center"><BarChart3 className="h-4 w-4 text-primary" aria-hidden /></div>
          <h3 className="text-heading-3 text-foreground">Análise por grande área e tema</h3>
        </div>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="lg:border-r lg:border-border/30 lg:pr-6 space-y-3">
            <p className="text-overline uppercase text-muted-foreground">Aproveitamento</p>
            <div className="flex items-center justify-center bg-primary text-primary-foreground p-4 rounded-xl min-w-0 sm:min-w-[160px]">
              <div className="text-center">
                <p className="text-heading-1 font-bold">{overall.percentageScore}%</p>
                <p className="text-caption opacity-80 mt-1">{overall.totalCorrect}/{overall.totalQuestions}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-overline uppercase text-muted-foreground mb-3">Grande Área</p>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {byArea.map(area => (
                  <PerformanceNode key={area.area} name={area.area} score={area.score} total={area.questions} correct={area.correct} isSelected={selectedArea === area.area} onClick={() => setSelectedArea(prev => prev === area.area ? null : area.area)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-overline uppercase text-muted-foreground mb-3">Tema</p>
              {!selectedArea ? (
                <div className="flex items-center justify-center h-32 text-center text-muted-foreground/60 text-body-sm p-4 border border-dashed border-border/40 rounded-xl">Selecione uma Grande Área</div>
              ) : themesForArea.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center text-muted-foreground/60 text-body-sm p-4 border border-dashed border-border/40 rounded-xl">Nenhum tema encontrado</div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  <AnimatePresence>
                    {themesForArea.map(theme => (
                      <motion.div key={theme.theme} initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}>
                        <div className="p-3.5 rounded-xl border border-border/40 bg-card hover:bg-accent/30 transition-all">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-medium text-body-sm text-foreground">{theme.theme}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-caption text-muted-foreground">{theme.correct}/{theme.total}</span>
                              <span className="font-bold text-body-sm text-primary tabular-nums">{theme.score}%</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </PremiumCard>

      <SectionHeader title="Sua evolução por grande área" />
      <div className="space-y-3">
        {byArea.map((area, i) => (
          <PremiumCard key={area.area} delay={i * 0.06} className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3"><Stethoscope className="h-4 w-4 text-muted-foreground" /><span className="text-body font-medium text-foreground">{area.area}</span></div>
              <div className="flex items-center gap-3"><span className="text-body-sm text-muted-foreground">{area.correct}/{area.questions} questões</span><span className="text-heading-3 text-foreground">{area.score}%</span></div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div initial={prefersReducedMotion ? false : { width: 0 }} animate={{ width: `${area.score}%` }} transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : i * 0.06 }} className="h-full rounded-full bg-primary" />
            </div>
          </PremiumCard>
        ))}
      </div>
    </>
  );
}
