import { useState, useMemo, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { DesempenhoSimuladoPanel } from '@/components/desempenho/DesempenhoSimuladoPanel';
import { useSimulados } from '@/hooks/useSimulados';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { useUserPerformance } from '@/hooks/useUserPerformance';
import { useUser } from '@/contexts/UserContext';
import { canViewResults } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import { BarChart3 } from 'lucide-react';

export default function DesempenhoPage() {
  const { profile } = useUser();
  const { simulados, loading: loadingSimulados } = useSimulados();
  const { history: _history } = useUserPerformance();
  const simuladosWithResults = useMemo(
    () => simulados.filter(s => canViewResults(s.status)),
    [simulados],
  );

  const [selectedSimuladoId, setSelectedSimuladoId] = useState<string | null>(null);

  const desTracked = useRef(false);
  useEffect(() => {
    if (loadingSimulados || desTracked.current) return;
    desTracked.current = true;
    trackEvent('desempenho_viewed', {
      simulados_with_results: simuladosWithResults.length,
    });
  }, [loadingSimulados, simuladosWithResults.length]);

  useEffect(() => {
    if (!selectedSimuladoId && simuladosWithResults.length > 0) {
      setSelectedSimuladoId(simuladosWithResults[0].id);
    }
  }, [simuladosWithResults, selectedSimuladoId]);

  const { questions, loading: loadingDetail, error: errorDetail, refetch: refetchDetail } = useSimuladoDetail(selectedSimuladoId || undefined);
  const { examState, attemptQuestionResults, loading: loadingExam, error: errorExam, refetch: refetchExam } = useExamResult(selectedSimuladoId || undefined);
  const loadError = errorDetail ?? errorExam;

  const performanceQuestions = useMemo(
    () => questions.map((question) => ({
      ...question,
      correctOptionId: attemptQuestionResults[question.id]?.correct_option_id ?? '',
    })),
    [questions, attemptQuestionResults],
  );

  const breakdown = useMemo<PerformanceBreakdown | null>(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !performanceQuestions.length) return null;
    return computePerformanceBreakdown(examState, performanceQuestions);
  }, [examState, performanceQuestions]);

  const loading = loadingSimulados || loadingDetail || loadingExam;

  if (loading && !breakdown) {
    return (
      <PageTransition>
        <PageHeader
          title="Desempenho"
          subtitle="Análise detalhada do seu desempenho por especialidade e tema."
          subtitlePlacement="inline-end"
          badge="ENAMED 2026"
        />
        <div className="space-y-4 md:space-y-5">
          <SkeletonCard className="h-[180px] rounded-[22px] bg-primary/[0.06]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <SkeletonCard className="h-[140px]" />
            <SkeletonCard className="h-[140px]" />
            <SkeletonCard className="h-[140px]" />
          </div>
          <SkeletonCard className="h-[200px]" />
        </div>
      </PageTransition>
    );
  }

  if (loadError && !breakdown) {
    return (
      <PageTransition>
        <PageHeader
          title="Desempenho"
          subtitle="Análise detalhada do seu desempenho por especialidade e tema."
          subtitlePlacement="inline-end"
          badge="ENAMED 2026"
        />
        <EmptyState
          variant="error"
          title="Não foi possível carregar o desempenho"
          description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
          onRetry={() => { refetchDetail?.(); refetchExam(); }}
        />
      </PageTransition>
    );
  }

  if (simuladosWithResults.length === 0 || !breakdown) {
    return (
      <PageTransition>
        <PageHeader
          title="Desempenho"
          subtitle="Análise detalhada do seu desempenho por especialidade e tema."
          subtitlePlacement="inline-end"
          badge="ENAMED 2026"
        />
        <EmptyState
          icon={BarChart3}
          title="Sem dados de desempenho"
          description="Complete um simulado e aguarde a liberação do resultado para ver sua análise de desempenho."
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader
          title="Desempenho"
          subtitle="Análise detalhada do seu desempenho por especialidade e tema."
          subtitlePlacement="inline-end"
          badge="ENAMED 2026"
        />
      <DesempenhoSimuladoPanel
          simuladosWithResults={simuladosWithResults}
          selectedSimuladoId={selectedSimuladoId}
          onSelectSimulado={setSelectedSimuladoId}
          breakdown={breakdown}
          questions={questions}
          examState={examState}
          studentName={profile?.name ?? 'Aluno'}
          resultNavVariant="public"
        />
    </PageTransition>
  );
}
