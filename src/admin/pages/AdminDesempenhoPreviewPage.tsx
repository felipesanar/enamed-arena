import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { DesempenhoSimuladoPanel } from '@/components/desempenho/DesempenhoSimuladoPanel';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import { BarChart3, ArrowLeft } from 'lucide-react';

export default function AdminDesempenhoPreviewPage() {
  const { id } = useParams<{ id: string }>();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { examState, loading: loadingExam } = useExamResult(id);

  const attemptFinished =
    examState?.status === 'submitted' || examState?.status === 'expired';
  const resultsAllowed =
    simulado &&
    canViewResultsOrAdminPreview(simulado.status, {
      adminPreview: true,
      attemptFinished,
    });

  const breakdown = useMemo<PerformanceBreakdown | null>(() => {
    if (!examState || (examState.status !== 'submitted' && examState.status !== 'expired') || !questions.length) return null;
    return computePerformanceBreakdown(examState, questions);
  }, [examState, questions]);

  const loading = loadingSim || loadingExam;

  if (loading && !breakdown) {
    return (
      <>
        <PageHeader
          title="Desempenho"
          subtitle="Preview admin — mesma análise do aluno sem depender da liberação pública."
          badge="Admin · preview"
        />
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

  if (!simulado) {
    return (
      <>
        <PageHeader title="Desempenho" subtitle="Preview admin" badge="Admin · preview" />
        <EmptyState
          icon={BarChart3}
          title="Simulado não encontrado"
          description="O ID do simulado na URL não existe ou foi removido."
          backHref="/admin/ranking-preview"
          backLabel="Preview do ranking"
        />
      </>
    );
  }

  if (!resultsAllowed) {
    return (
      <>
        <div className="mb-4">
          <Link
            to="/admin/ranking-preview"
            className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao preview do ranking
          </Link>
        </div>
        <PageHeader
          title="Desempenho"
          subtitle="Preview admin"
          badge="Admin · preview"
        />
        <EmptyState
          icon={BarChart3}
          title="Preview indisponível"
          description="Não há tentativa finalizada para este simulado com o usuário logado, ou a análise ainda não pode ser exibida."
          backHref="/admin/ranking-preview"
          backLabel="Preview do ranking"
        />
      </>
    );
  }

  if (!breakdown) {
    return (
      <>
        <div className="mb-4">
          <Link
            to="/admin/ranking-preview"
            className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao preview do ranking
          </Link>
        </div>
        <PageHeader
          title="Desempenho"
          subtitle="Preview admin"
          badge="Admin · preview"
        />
        <EmptyState
          icon={BarChart3}
          title="Sem dados de desempenho"
          description="Finalize uma tentativa deste simulado com o usuário logado para ver a análise aqui."
          backHref="/admin/ranking-preview"
          backLabel="Preview do ranking"
        />
      </>
    );
  }

  const simuladosWithResults = [{ id: simulado.id, title: simulado.title }];

  return (
    <PageTransition>
      <PageHeader
        title={`Desempenho — ${simulado.title}`}
        subtitle="Preview admin — mesma análise do aluno sem depender da liberação pública."
        badge="Admin · preview"
      />

      <DesempenhoSimuladoPanel
        simuladosWithResults={simuladosWithResults}
        selectedSimuladoId={simulado.id}
        onSelectSimulado={() => {}}
        breakdown={breakdown}
        questions={questions}
        resultNavVariant="admin"
      />
    </PageTransition>
  );
}
