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
import { BarChart3, ArrowLeft, Eye } from 'lucide-react';

function BackToPreviewLink() {
  return (
    <Link
      to="/admin/previews"
      className="inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a prévia do aluno
    </Link>
  );
}

const SUBTITLE = 'Mesma análise que o aluno vê, sem depender da liberação pública.';

function AdminDesempenhoPreviewPageContent() {
  const { id } = useParams<{ id: string }>();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { examState, loading: loadingExam, error } = useExamResult(id);

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
          subtitle={SUBTITLE}
          actions={<BackToPreviewLink />}
        />
        <div className="space-y-3 motion-safe:animate-pulse">
          <div className="h-[140px] rounded-xl bg-admin-raised" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="h-[280px] rounded-xl bg-admin-raised" />
            <div className="h-[280px] rounded-xl bg-admin-raised" />
          </div>
          <div className="h-[160px] rounded-xl bg-admin-raised" />
        </div>
      </>
    );
  }

  if (error && !simulado) {
    return (
      <>
        <AdminPageHeader title="Desempenho" subtitle={SUBTITLE} actions={<BackToPreviewLink />} />
        <AdminEmptyState
          icon={BarChart3}
          tone="error"
          eyebrow="Erro"
          title="Não foi possível carregar a prévia"
          description="Houve uma falha ao buscar os dados deste simulado. Tente novamente em instantes."
          action={<BackToPreviewLink />}
        />
      </>
    );
  }

  if (!simulado) {
    return (
      <>
        <AdminPageHeader title="Desempenho" subtitle={SUBTITLE} actions={<BackToPreviewLink />} />
        <AdminEmptyState
          icon={BarChart3}
          eyebrow="Não encontrado"
          title="Simulado não encontrado"
          description="O simulado indicado no endereço não existe ou foi removido."
          action={<BackToPreviewLink />}
        />
      </>
    );
  }

  if (!resultsAllowed) {
    return (
      <>
        <AdminPageHeader title="Desempenho" subtitle={SUBTITLE} actions={<BackToPreviewLink />} />
        <AdminEmptyState
          icon={BarChart3}
          eyebrow="Indisponível"
          title="Prévia indisponível"
          description="Não há tentativa finalizada deste simulado na sua conta, ou a análise ainda não pode ser exibida."
          action={<BackToPreviewLink />}
        />
      </>
    );
  }

  if (!breakdown) {
    return (
      <>
        <AdminPageHeader title="Desempenho" subtitle={SUBTITLE} actions={<BackToPreviewLink />} />
        <AdminEmptyState
          icon={BarChart3}
          eyebrow="Vazio"
          title="Sem dados de desempenho"
          description="Finalize uma tentativa deste simulado na sua conta para ver a análise aqui."
          action={<BackToPreviewLink />}
        />
      </>
    );
  }

  const simuladosWithResults = [{ id: simulado.id, title: simulado.title }];

  return (
    <PageTransition>
      <AdminPageHeader
        title={`Desempenho — ${simulado.title}`}
        subtitle={SUBTITLE}
        actions={<BackToPreviewLink />}
      />

      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-text px-2.5 py-1 text-[10.5px] font-bold text-admin-surface">
          <Eye className="h-3 w-3" aria-hidden /> Visão do aluno
        </span>
        <span className="text-[11px] text-admin-faint">{simulado.title}</span>
      </div>

      {/* Conteúdo do aluno emoldurado com o fundo próprio dele. */}
      <div className="overflow-hidden rounded-xl border border-admin-line bg-background p-4">
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
