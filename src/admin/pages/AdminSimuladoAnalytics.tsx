import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useParams, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { formatInt } from '@/admin/lib/format'
import type { SimuladoQuestionStat } from '@/admin/types'

function discriminationLabel(index: number): { label: string; description: string; cls: string } {
  if (index >= 30) return { label: 'Diferencia bem', description: 'Quem estudou acerta, quem não estudou erra', cls: 'text-admin-success' }
  if (index >= 10) return { label: 'Diferencia pouco', description: 'Não separa bem preparados de não preparados', cls: 'text-admin-warning' }
  if (index >= 0) return { label: 'Não diferencia', description: 'Todos acertam ou todos erram igualmente', cls: 'text-admin-destructive' }
  return { label: 'Questão confusa', description: 'Os melhores alunos erram mais que os piores', cls: 'text-admin-destructive' }
}

function AdminSimuladoAnalyticsContent() {
  const { id } = useParams<{ id: string }>()
  const { data: stats, isLoading: statsLoading } = useAdminSimuladoDetailStats(id!)
  const { data: questions = [], isLoading: qLoading } = useAdminSimuladoQuestionStats(id!)

  return (
    <div className="max-w-[1200px] space-y-6">
      <AdminPageHeader
        title={stats ? `#${stats.sequence_number} — ${stats.title}` : 'Analytics do simulado'}
        subtitle="Participação, conclusão e qualidade por questão"
        actions={
          <>
            <Link
              to="/admin/simulados"
              className="text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
            >
              ← Voltar aos simulados
            </Link>
            <Link
              to={`/admin/simulados/${id}`}
              className="px-3 py-1.5 text-xs rounded-lg border border-admin-line bg-admin-surface text-admin-muted hover:text-admin-text hover:bg-admin-raised motion-safe:transition-colors"
            >
              Editar simulado
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <section>
        <AdminSectionHeader title="Métricas gerais" />
        {statsLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <AdminStatCard key={i} label="..." value="..." isLoading />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdminStatCard label="Participantes" value={formatInt(stats.participants)} hint="Usuários distintos com tentativa válida (treino excluído)" />
            <AdminStatCard label="Taxa de conclusão" value={`${stats.completion_rate.toFixed(1)}%`} hint={`${formatInt(stats.completed_count)} de ${formatInt(stats.completed_count + stats.in_progress_count + stats.offline_pending_count)} válidas`} />
            <AdminStatCard label="Média geral" value={`${stats.avg_score.toFixed(1)}%`} />
            <AdminStatCard label="Abandono" value={`${stats.abandonment_rate.toFixed(1)}%`} hint={`${formatInt(stats.in_progress_count)} em andamento + ${formatInt(stats.offline_pending_count)} offline pendente`} />
            <AdminStatCard label="Tempo mediano" value={`${stats.median_time_minutes.toFixed(0)} min`} hint={`p90 ${stats.p90_time_minutes.toFixed(0)} min · iniciadas ${formatInt(stats.started_total)} (inclui ${formatInt(stats.treino_count)} treino)`} />
          </div>
        ) : null}
      </section>

      {/* Por questão */}
      <section>
        <AdminSectionHeader title="Analytics por questão" hook={`${questions.length} questões`} />
        {qLoading ? (
          <div className="bg-admin-surface border border-admin-line rounded-lg animate-pulse h-32" />
        ) : questions.length === 0 ? (
          <AdminEmptyState title="Sem dados suficientes para esta análise" />
        ) : (
          <div className="bg-admin-surface border border-admin-line rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-admin-line text-[9px] font-bold text-admin-faint uppercase tracking-wide"
              style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}>
              {['Q', 'Enunciado', 'Taxa de acerto', 'Qualidade da questão', 'Erro mais comum'].map(h => (
                <div key={h} className="px-3 py-2">{h}</div>
              ))}
            </div>

            {questions.map((q: SimuladoQuestionStat) => {
              const barPct = Math.min(100, Math.max(0, q.correct_rate))
              const barColor = barPct >= 70 ? 'bg-admin-success' : barPct >= 40 ? 'bg-admin-warning' : 'bg-admin-destructive'
              const disc = discriminationLabel(q.discrimination_index)

              return (
                <div
                  key={q.question_number}
                  className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/20 items-center"
                  style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}
                >
                  <div className="px-3 py-2.5 text-xs font-bold text-admin-muted">
                    Q{q.question_number}
                  </div>
                  <div className="px-3 py-2.5 text-[11px] text-admin-text truncate max-w-xs" title={q.text}>
                    {q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-admin-raised rounded-full">
                        <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-admin-text w-10 text-right">
                        {q.correct_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5" title={disc.description}>
                    <span className={cn('text-[11px] font-semibold', disc.cls)}>{disc.label}</span>
                    <p className="text-[9px] text-admin-muted">{disc.description}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    {q.most_common_wrong_label ? (
                      <>
                        <span className="text-[10px] bg-admin-raised/60 border border-admin-line text-admin-muted px-1.5 py-0.5 rounded">
                          Alt. {q.most_common_wrong_label}
                        </span>
                        <span className="text-[9px] text-admin-muted ml-1">({q.most_common_wrong_pct?.toFixed(1)}%)</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-admin-faint">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
