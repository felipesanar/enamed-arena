import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageTransition } from '@/components/premium/PageTransition';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState';
import { DesempenhoSimuladoPanel } from '@/components/desempenho/DesempenhoSimuladoPanel';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamResult } from '@/hooks/useExamResult';
import { canViewResultsOrAdminPreview } from '@/lib/simulado-helpers';
import { computePerformanceBreakdown } from '@/lib/resultHelpers';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import { BarChart3, ArrowLeft } from 'lucide-react';

function BackToRankingPreviewLink() {
  return (
    <Link
      to="/admin/ranking-preview"
      className="inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao preview do ranking
    </Link>
  );
}

function AdminDesempenhoPreviewPageContent() {
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
        <AdminPageHeader
          title="Desempenho"
          subtitle="Preview admin — mesma análise do aluno sem depender da liberação pública."
          actions={<BackToRankingPreviewLink />}
        />
        <div className="space-y-3 animate-pulse">
          <div className="h-[140px] rounded-xl bg-admin-raised/60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-[280px] rounded-xl bg-admin-raised/60" />
            <div className="h-[280px] rounded-xl bg-admin-raised/60" />
          </div>
          <div className="h-[160px] rounded-xl bg-admin-raised/60" />
        </div>
      </>
    );
  }

  if (!simulado) {
    return (
      <>
        <AdminPageHeader
          title="Desempenho"
          subtitle="Preview admin"
          actions={<BackToRankingPreviewLink />}
        />
        <AdminEmptyState
          icon={BarChart3}
          title="Simulado não encontrado"
          description="O ID do simulado na URL não existe ou foi removido."
          action={<BackToRankingPreviewLink />}
        />
      </>
    );
  }

  if (!resultsAllowed) {
    return (
      <>
        <AdminPageHeader
          title="Desempenho"
          subtitle="Preview admin"
          actions={<BackToRankingPreviewLink />}
        />
        <AdminEmptyState
          icon={BarChart3}
          title="Preview indisponível"
          description="Não há tentativa finalizada para este simulado com o usuário logado, ou a análise ainda não pode ser exibida."
          action={<BackToRankingPreviewLink />}
        />
      </>
    );
  }

  if (!breakdown) {
    return (
      <>
        <AdminPageHeader
          title="Desempenho"
          subtitle="Preview admin"
          actions={<BackToRankingPreviewLink />}
        />
        <AdminEmptyState
          icon={BarChart3}
          title="Sem dados de desempenho"
          description="Finalize uma tentativa deste simulado com o usuário logado para ver a análise aqui."
          action={<BackToRankingPreviewLink />}
        />
      </>
    );
  }

  const simuladosWithResults = [{ id: simulado.id, title: simulado.title }];

  return (
    <PageTransition>
      <AdminPageHeader
        title={`Desempenho — ${simulado.title}`}
        subtitle="Preview admin — mesma análise do aluno sem depender da liberação pública."
        actions={<BackToRankingPreviewLink />}
      />

      {/* Conteúdo do aluno "emoldurado" com o fundo próprio dele */}
      <div className="bg-background rounded-lg border border-admin-line overflow-hidden p-4">
        <DesempenhoSimuladoPanel
          simuladosWithResults={simuladosWithResults}
          selectedSimuladoId={simulado.id}
          onSelectSimulado={() => {}}
          breakdown={breakdown}
          questions={questions}
          resultNavVariant="admin"
        />
      </div>
    </PageTransition>
  );
}

export default function AdminDesempenhoPreviewPage() {
  return (
    <AdminCapabilityGate capability="previews.view">
      <AdminDesempenhoPreviewPageContent />
    </AdminCapabilityGate>
  )
}
