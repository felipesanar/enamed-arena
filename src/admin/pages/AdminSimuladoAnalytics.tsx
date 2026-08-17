import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useParams, Link } from 'react-router-dom'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { useGabaritoSuspicion } from '@/admin/hooks/useGabaritoSuspicion'
import { formatSuspectPct } from '@/admin/lib/suspectKey'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminQuestionStatsTable } from '@/admin/components/ui/AdminQuestionStatsTable'
import { Button } from '@/components/ui/button'
import { formatInt } from '@/admin/lib/format'
import { cn } from '@/lib/utils'
import { BarChart3, ChevronLeft, RotateCw, AlertTriangle } from 'lucide-react'

/** Sub-seção de "Qualidade por questão": distribuição de respostas com cara
 * de gabarito errado (concentração alta numa alternativa, acerto baixo). */
function GabaritoSuspicionSection({ simuladoId }: { simuladoId: string }) {
  const { suspects, isLoading } = useGabaritoSuspicion(simuladoId)

  if (isLoading) return null

  if (suspects.length === 0) {
    return (
      <p className="mt-3 text-[11.5px] text-admin-faint">
        Nenhuma suspeita de gabarito pela distribuição de respostas.
      </p>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface">
      <div className="flex items-center gap-2 border-b border-admin-line/80 bg-admin-destructive/5 px-3.5 py-2.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-admin-destructive" aria-hidden />
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-admin-destructive">
          Suspeita de gabarito
        </p>
        <span className="text-[10px] text-admin-faint">
          {suspects.length === 1 ? '1 questão' : `${suspects.length} questões`}
        </span>
      </div>
      <div className="divide-y divide-admin-line/40">
        {suspects.map(s => (
          <div key={s.questionNumber} className="flex items-start gap-3 px-3.5 py-2.5">
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                s.severity === 'high'
                  ? 'border-admin-destructive/30 bg-admin-destructive/10 text-admin-destructive'
                  : 'border-admin-warning/30 bg-admin-warning/10 text-admin-warning',
              )}
            >
              Q{s.questionNumber}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] text-admin-text">{s.reason}</p>
              <p className="mt-0.5 text-[10.5px] text-admin-muted">
                {formatSuspectPct(s.correctRate)} de acerto · {formatSuspectPct(s.topWrongPct)} marcaram{' '}
                {s.topWrongLabel} · {formatInt(s.totalResponses)} respostas
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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
            <AdminStatCard
              label="Tempo mediano"
              value={`${stats.median_time_minutes.toFixed(0)} min`}
              hint={`p90: ${stats.p90_time_minutes.toFixed(0)} min`}
            />
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
