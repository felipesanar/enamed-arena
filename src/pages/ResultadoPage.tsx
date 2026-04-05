import { useMemo, useEffect, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { SkeletonCard } from '@/components/SkeletonCard';
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
import { useUser } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResults } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import { SEGMENT_ACCESS } from '@/types';
import { trackEvent } from '@/lib/analytics';
import {
  Trophy, CheckCircle2, XCircle, Target, BarChart3,
  FileText, Stethoscope, ArrowLeft, Clock, Star, TrendingDown,
} from 'lucide-react';

export default function ResultadoPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const prefersReducedMotion = useReducedMotion();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { examState, attempt, loading: loadingExam } = useExamResult(id);

  const loading = loadingSim || loadingExam;

  const resultTracked = useRef(false);
  useEffect(() => {
    if (loading || resultTracked.current) return;
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) return;
    resultTracked.current = true;
    const breakdown = computePerformanceBreakdown(examState, questions);
    const worstArea = breakdown.byArea.at(-1)?.area ?? 'unknown';
    const bestArea = breakdown.byArea[0]?.area ?? 'unknown';
    trackEvent('resultado_viewed', {
      simulado_id: id ?? '',
      score_percentage: attempt?.score_percentage ?? 0,
      total_correct: attempt?.total_correct ?? 0,
      total_questions: questions.length,
      worst_area: worstArea,
      best_area: bestArea,
      segment,
    });
  }, [loading, examState, id, questions, segment]);

  if (loading) {
    return (
      <>
        <div className="space-y-4">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (!simulado) {
    return (
      <>
        <EmptyState
          title="Simulado não encontrado"
          description="O simulado que você procura não existe."
          backHref="/simulados"
          backLabel="Voltar ao calendário"
        />
      </>
    );
  }

  if (!canViewResults(simulado.status)) {
    return <Navigate to={`/simulados/${id}`} replace />;
  }

  if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired')) {
    return (
      <>
        <div className="mb-4">
          <Link to={`/simulados/${id}`} className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao simulado
          </Link>
        </div>
        <EmptyState
          icon={FileText}
          title="Sem resultado disponível"
          description="Você não realizou este simulado. Não há resultado para exibir."
          backHref={id ? `/simulados/${id}` : "/simulados"}
          backLabel="Voltar ao simulado"
        />
      </>
    );
  }

  const breakdown = computePerformanceBreakdown(examState, questions);
  const { overall, byArea } = breakdown;
  const officialCorrect = attempt?.total_correct ?? overall.totalCorrect;
  const officialAnswered = attempt?.total_answered ?? overall.totalAnswered;
  const officialPercentage = attempt?.score_percentage != null
    ? Math.round(Number(attempt.score_percentage))
    : overall.percentageScore;
  const bestArea = byArea[0];
  const worstArea = byArea[byArea.length - 1];
  const hasComparativo = SEGMENT_ACCESS[segment].comparativo;
  const hasCadernoErros = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Simulados", href: "/simulados" },
          { label: `Simulado #${simulado.sequenceNumber}`, href: `/simulados/${id}` },
          { label: "Resultado" },
        ]}
        className="mb-4"
      />

      <PageHeader
        title={`Resultado — ${simulado.title}`}
        subtitle="Confira seu desempenho neste simulado."
        badge={`Simulado #${simulado.sequenceNumber}`}
        action={<StatusBadge status={simulado.status} />}
      />

      {/* Hero score — momento de reconhecimento (Fase D) */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        className="mb-8"
      >
        <PremiumCard variant="hero" className="text-center border-primary/20 bg-gradient-to-br from-accent/40 via-card to-card">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-10 w-10 text-primary" aria-hidden />
          </div>
          <p className="text-overline uppercase text-muted-foreground tracking-wide mb-1">Seu desempenho neste simulado</p>
          <div className="text-display font-bold text-primary mb-1 tabular-nums">{officialPercentage}%</div>
          <p className="text-body-lg text-muted-foreground mb-6">
            {officialCorrect} de {overall.totalQuestions} questões corretas
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { label: 'Acertos', value: String(officialCorrect), icon: CheckCircle2, color: 'text-success' },
              { label: 'Erros', value: String(overall.totalIncorrect), icon: XCircle, color: 'text-destructive' },
              { label: 'Em branco', value: String(overall.totalUnanswered), icon: Target, color: 'text-muted-foreground' },
              { label: 'Respondidas', value: String(officialAnswered), icon: Clock, color: 'text-info' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="p-3 rounded-xl bg-card border border-border">
                <stat.icon className={`h-5 w-5 ${stat.color} mx-auto mb-1.5`} />
                <p className="text-heading-2 text-foreground">{stat.value}</p>
                <p className="text-caption text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </PremiumCard>
      </motion.div>

      {/* Performance highlights */}
      {byArea.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <PremiumCard delay={0.1} className="p-5 border-success/20 bg-success/[0.02]">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
                <Star className="h-[18px] w-[18px] text-success" />
              </div>
              <div>
                <p className="text-overline uppercase text-success">Ponto forte</p>
                <p className="text-body font-semibold text-foreground">{bestArea.area}</p>
              </div>
            </div>
            <p className="text-body-sm text-muted-foreground">
              {bestArea.correct}/{bestArea.questions} questões corretas — <strong className="text-foreground">{bestArea.score}%</strong>
            </p>
          </PremiumCard>
          <PremiumCard delay={0.15} className="p-5 border-destructive/20 bg-destructive/[0.02]">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-[18px] w-[18px] text-destructive" />
              </div>
              <div>
                <p className="text-overline uppercase text-destructive">Oportunidade</p>
                <p className="text-body font-semibold text-foreground">{worstArea.area}</p>
              </div>
            </div>
            <p className="text-body-sm text-muted-foreground">
              {worstArea.correct}/{worstArea.questions} questões corretas — <strong className="text-foreground">{worstArea.score}%</strong>
            </p>
          </PremiumCard>
        </div>
      )}

      {/* Area breakdown */}
      <SectionHeader title="Desempenho por Grande Área" />
      <div className="space-y-3 mb-8">
        {byArea.map((area, i) => (
          <PremiumCard key={area.area} delay={i * 0.05} className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body-sm text-muted-foreground">{area.correct}/{area.questions}</span>
                <span className="text-heading-3 text-foreground">{area.score}%</span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${area.score}%` }} transition={{ duration: 0.7, delay: 0.3 + i * 0.05 }} className="h-full rounded-full bg-primary" />
            </div>
          </PremiumCard>
        ))}
      </div>

      {!hasCadernoErros && (
        <div className="mb-8">
          <UpgradeBanner
            title="Salve questões no Caderno de Erros"
            description="Com o PRO: ENAMED, adicione questões ao seu Caderno de Erros direto da correção."
            ctaText="Conhecer o PRO: ENAMED"
          />
        </div>
      )}

      {id && <SimuladoResultNav simuladoId={id} />}
      {hasComparativo && (
        <div className="mt-4">
          <Link
            to="/comparativo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-transparent text-muted-foreground text-body font-medium hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Comparativo
          </Link>
        </div>
      )}
    </>
  );
}
