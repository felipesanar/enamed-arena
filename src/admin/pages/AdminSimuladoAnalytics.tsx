import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useParams, Link } from 'react-router-dom'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminQuestionStatsTable } from '@/admin/components/ui/AdminQuestionStatsTable'
import { Button } from '@/components/ui/button'
import { formatInt } from '@/admin/lib/format'
import { BarChart3, ChevronLeft, RotateCw } from 'lucide-react'

const SUBTITLE = 'Participação, conclusão e qualidade por questão.'

function BackToSimuladosLink() {
  return (
    <Link
      to="/admin/simulados"
      className="inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Voltar aos simulados
    </Link>
  )
}

function AdminSimuladoAnalyticsContent() {
  const { id } = useParams<{ id: string }>()
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useAdminSimuladoDetailStats(id!)
  const { data: questions = [], isLoading: qLoading } = useAdminSimuladoQuestionStats(id!)

  const title = stats ? `Análise — #${stats.sequence_number} ${stats.title}` : 'Análise do simulado'

  // ── Erro ao carregar as métricas gerais ──────────────────────────────────
  if (statsError && !stats) {
    return (
      <div className="max-w-[1200px] space-y-6">
        <AdminPageHeader title="Análise do simulado" subtitle={SUBTITLE} actions={<BackToSimuladosLink />} />
        <AdminEmptyState
          icon={BarChart3}
          tone="error"
          eyebrow="Erro"
          title="Não foi possível carregar a análise"
          description="Houve uma falha ao buscar os dados deste simulado. Tente novamente em instantes."
          action={
            <Button variant="outline" size="sm" className="h-8 border-admin-line text-xs" onClick={() => refetchStats()}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Tentar de novo
            </Button>
          }
        />
      </div>
    )
  }

  // ── Simulado não encontrado ───────────────────────────────────────────────
  if (!statsLoading && !stats) {
    return (
      <div className="max-w-[1200px] space-y-6">
        <AdminPageHeader title="Análise do simulado" subtitle={SUBTITLE} actions={<BackToSimuladosLink />} />
        <AdminEmptyState
          icon={BarChart3}
          eyebrow="Não encontrado"
          title="Simulado não encontrado"
          description="O simulado indicado no endereço não existe ou foi removido."
          action={<BackToSimuladosLink />}
        />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <AdminPageHeader
        title={title}
        subtitle={SUBTITLE}
        actions={
          <>
            <BackToSimuladosLink />
            <Link
              to={`/admin/simulados/${id}`}
              className="rounded-lg border border-admin-line bg-admin-surface px-3 py-1.5 text-xs text-admin-muted hover:bg-admin-raised hover:text-admin-text motion-safe:transition-colors"
            >
              Editar simulado
            </Link>
          </>
        }
      />

      {/* ── Métricas gerais ────────────────────────────────────────────────── */}
      <section>
        <AdminSectionHeader title="Métricas gerais" />
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map(i => <AdminStatCard key={i} label="..." value="..." isLoading />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <AdminStatCard label="Participantes" value={formatInt(stats.participants)} />
            <AdminStatCard label="Taxa de conclusão" value={`${stats.completion_rate.toFixed(1)}%`} />
            <AdminStatCard label="Média geral" value={`${stats.avg_score.toFixed(1)}%`} />
            <AdminStatCard label="Abandono" value={`${stats.abandonment_rate.toFixed(1)}%`} invertDelta />
            <AdminStatCard label="Tempo médio" value={`${stats.avg_time_minutes.toFixed(0)} min`} />
          </div>
        ) : null}
      </section>

      {/* ── Qualidade por questão ──────────────────────────────────────────── */}
      <section>
        <AdminSectionHeader
          title="Qualidade por questão"
          hook={qLoading ? '…' : `${questions.length} questões`}
        />
        <AdminQuestionStatsTable questions={questions} isLoading={qLoading} />
      </section>
    </div>
  )
}

export default function AdminSimuladoAnalytics() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminSimuladoAnalyticsContent />
    </AdminCapabilityGate>
  )
}
