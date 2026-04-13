import { useState, useMemo, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { PageTransition } from '@/components/premium/PageTransition';

import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { DesempenhoSimuladoPanel } from '@/components/desempenho/DesempenhoSimuladoPanel';
import { useSimulados } from '@/hooks/useSimulados';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { useUserPerformance } from '@/hooks/useUserPerformance';
import { canViewResults } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import { BarChart3 } from 'lucide-react';

export default function DesempenhoPage() {
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

  const { questions, loading: loadingDetail } = useSimuladoDetail(selectedSimuladoId || undefined, true);
  const { examState, loading: loadingExam } = useExamResult(selectedSimuladoId || undefined);

  const breakdown = useMemo<PerformanceBreakdown | null>(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !questions.length) return null;
    return computePerformanceBreakdown(examState, questions);
  }, [examState, questions]);

  const loading = loadingSimulados || loadingDetail || loadingExam;

  if (loading && !breakdown) {
    return (
      <div className="space-y-3">
        <SkeletonCard className="h-[140px] rounded-[22px] bg-primary/[0.06]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SkeletonCard className="h-[280px]" />
          <SkeletonCard className="h-[280px]" />
        </div>
        <SkeletonCard className="h-[160px]" />
      </div>
    );
  }

  if (simuladosWithResults.length === 0 || !breakdown) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de desempenho"
        description="Complete um simulado e aguarde a liberação do resultado para ver sua análise de desempenho."
      />
    );
  }

  return (
    <PageTransition>
      <DesempenhoSimuladoPanel
        simuladosWithResults={simuladosWithResults}
        selectedSimuladoId={selectedSimuladoId}
        onSelectSimulado={setSelectedSimuladoId}
        breakdown={breakdown}
        questions={questions}
        resultNavVariant="public"
      />
    </PageTransition>
  );
}
