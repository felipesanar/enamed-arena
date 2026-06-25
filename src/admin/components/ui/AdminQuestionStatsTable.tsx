import { cn } from '@/lib/utils'
import type { SimuladoQuestionStat } from '@/admin/types'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { ListChecks } from 'lucide-react'

/** Lê o índice de discriminação e devolve um rótulo que um operador novo entende. */
function discriminationLabel(index: number): { label: string; description: string; cls: string } {
  if (index >= 30) return { label: 'Diferencia bem', description: 'Quem estudou acerta, quem não estudou erra', cls: 'text-admin-success' }
  if (index >= 10) return { label: 'Diferencia pouco', description: 'Não separa bem preparados de não preparados', cls: 'text-admin-warning' }
  if (index >= 0) return { label: 'Não diferencia', description: 'Todos acertam ou todos erram igualmente', cls: 'text-admin-destructive' }
  return { label: 'Questão confusa', description: 'Os melhores alunos erram mais que os piores', cls: 'text-admin-destructive' }
}

const GRID = '40px 1fr 168px 148px 124px'
const HEADERS = ['Q', 'Enunciado', 'Taxa de acerto', 'Qualidade da questão', 'Erro mais comum']

interface AdminQuestionStatsTableProps {
  questions: SimuladoQuestionStat[]
  isLoading?: boolean
}

/**
 * Tabela de qualidade por questão (taxa de acerto, discriminação e erro mais
 * comum). Compartilhada por Resultados e Analytics do simulado para manter o
 * mesmo acabamento e a mesma leitura nas duas telas.
 */
export function AdminQuestionStatsTable({ questions, isLoading }: AdminQuestionStatsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="relative h-9 overflow-hidden rounded-md bg-admin-raised">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/60 to-transparent" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
        <AdminEmptyState
          icon={ListChecks}
          eyebrow="Vazio"
          title="Sem dados suficientes por questão"
          description="Quando houver respostas suficientes neste simulado, a análise de cada questão aparece aqui."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-admin-line/80 bg-admin-surface shadow-sm shadow-black/[0.04] dark:shadow-black/30">
      <div
        className="grid border-b border-admin-line/80 bg-admin-raised/20 text-[9px] font-bold uppercase tracking-[0.08em] text-admin-faint"
        style={{ gridTemplateColumns: GRID }}
      >
        {HEADERS.map(h => (
          <div key={h} className="px-3 py-2.5">{h}</div>
        ))}
      </div>

      {questions.map(q => {
        const barPct = Math.min(100, Math.max(0, q.correct_rate))
        const barColor = barPct >= 70 ? 'bg-admin-success' : barPct >= 40 ? 'bg-admin-warning' : 'bg-admin-destructive'
        const disc = discriminationLabel(q.discrimination_index)

        return (
          <div
            key={q.question_number}
            className="grid items-center border-b border-admin-line/40 last:border-0 motion-safe:transition-colors hover:bg-admin-raised/20"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="px-3 py-3 text-xs font-bold text-admin-muted tabular-nums">Q{q.question_number}</div>
            <div className="min-w-0 px-3 py-3 text-[11px] text-admin-text" title={q.text}>
              <span className="block truncate">{q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}</span>
            </div>
            <div className="px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-raised">
                  <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold tabular-nums text-admin-text">
                  {q.correct_rate.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="px-3 py-3" title={disc.description}>
              <span className={cn('text-[11px] font-semibold', disc.cls)}>{disc.label}</span>
              <p className="text-[9px] leading-tight text-admin-muted">{disc.description}</p>
            </div>
            <div className="px-3 py-3">
              {q.most_common_wrong_label ? (
                <span className="inline-flex items-baseline gap-1">
                  <span className="rounded border border-admin-line bg-admin-raised/60 px-1.5 py-0.5 text-[10px] text-admin-muted">
                    Alt. {q.most_common_wrong_label}
                  </span>
                  <span className="text-[9px] tabular-nums text-admin-muted">
                    ({q.most_common_wrong_pct?.toFixed(1)}%)
                  </span>
                </span>
              ) : (
                <span className="text-[10px] text-admin-faint">—</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
