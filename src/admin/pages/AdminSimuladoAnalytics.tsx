import { useParams, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import type { SimuladoQuestionStat } from '@/admin/types'

function discriminationLabel(index: number): { label: string; description: string; cls: string } {
  if (index >= 30) return { label: 'Diferencia bem', description: 'Quem estudou acerta, quem não estudou erra', cls: 'text-success' }
  if (index >= 10) return { label: 'Diferencia pouco', description: 'Não separa bem preparados de não preparados', cls: 'text-warning' }
  if (index >= 0) return { label: 'Não diferencia', description: 'Todos acertam ou todos erram igualmente', cls: 'text-destructive' }
  return { label: 'Questão confusa', description: 'Os melhores alunos erram mais que os piores', cls: 'text-destructive' }
}

export default function AdminSimuladoAnalytics() {
  const { id } = useParams<{ id: string }>()
  const { data: stats, isLoading: statsLoading } = useAdminSimuladoDetailStats(id!)
  const { data: questions = [], isLoading: qLoading } = useAdminSimuladoQuestionStats(id!)

  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin/simulados" className="hover:text-foreground transition-colors">Simulados</Link>
        <span>›</span>
        <span className="text-foreground font-medium">
          {stats ? `#${stats.sequence_number} — ${stats.title}` : 'Analytics'}
        </span>
        <Link to={`/admin/simulados/${id}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Editar simulado
        </Link>
      </div>

      {/* KPIs */}
      <section>
        <AdminSectionHeader title="Métricas gerais" />
        {statsLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <AdminStatCard key={i} label="..." value="..." isLoading />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdminStatCard label="Participantes" value={stats.participants.toLocaleString('pt-BR')} />
            <AdminStatCard label="Taxa de conclusão" value={`${stats.completion_rate.toFixed(1)}%`} />
            <AdminStatCard label="Média geral" value={`${stats.avg_score.toFixed(1)}%`} />
            <AdminStatCard label="Abandono" value={`${stats.abandonment_rate.toFixed(1)}%`} />
            <AdminStatCard label="Tempo médio" value={`${stats.avg_time_minutes.toFixed(0)} min`} />
          </div>
        ) : null}
      </section>

      {/* Por questão */}
      <section>
        <AdminSectionHeader title="Analytics por questão" hook={`${questions.length} questões`} />
        {qLoading ? (
          <div className="bg-card border border-border rounded-lg animate-pulse h-32" />
        ) : questions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados suficientes para esta análise.</p>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-border text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide"
              style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}>
              {['Q', 'Enunciado', 'Taxa de acerto', 'Qualidade da questão', 'Erro mais comum'].map(h => (
                <div key={h} className="px-3 py-2">{h}</div>
              ))}
            </div>

            {questions.map((q: SimuladoQuestionStat) => {
              const barPct = Math.min(100, Math.max(0, q.correct_rate))
              const barColor = barPct >= 70 ? 'bg-success' : barPct >= 40 ? 'bg-warning' : 'bg-destructive'
              const disc = discriminationLabel(q.discrimination_index)

              return (
                <div
                  key={q.question_number}
                  className="grid border-b border-border/40 last:border-0 hover:bg-muted/20 items-center"
                  style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}
                >
                  <div className="px-3 py-2.5 text-xs font-bold text-muted-foreground">
                    Q{q.question_number}
                  </div>
                  <div className="px-3 py-2.5 text-[11px] text-foreground truncate max-w-xs" title={q.text}>
                    {q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full">
                        <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">
                        {q.correct_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5" title={disc.description}>
                    <span className={cn('text-[11px] font-semibold', disc.cls)}>{disc.label}</span>
                    <p className="text-[9px] text-muted-foreground">{disc.description}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    {q.most_common_wrong_label ? (
                      <>
                        <span className="text-[10px] bg-muted/60 border border-border text-muted-foreground px-1.5 py-0.5 rounded">
                          Alt. {q.most_common_wrong_label}
                        </span>
                        <span className="text-[9px] text-muted-foreground ml-1">({q.most_common_wrong_pct?.toFixed(1)}%)</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
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
