// src/admin/components/ui/AdminCohortMatrix.tsx
import { formatInt } from '@/admin/lib/format'
import type { CohortRetentionRow } from '@/admin/types'

interface AdminCohortMatrixProps {
  rows: CohortRetentionRow[]
  isLoading?: boolean
}

const HEAD_CLASS =
  'px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-admin-muted/60'

function formatMonth(cohortMonth: string): string {
  return new Date(cohortMonth).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

/** Célula de marco: % com overlay de accent proporcional ao valor. */
function MilestoneCell({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <td className="relative px-3 py-2 text-center text-xs text-admin-text">
      <span
        aria-hidden
        className="absolute inset-1 rounded"
        style={{ backgroundColor: `hsl(var(--admin-accent) / ${pct / 100})` }}
      />
      <span className="relative font-medium tabular-nums">{pct}%</span>
    </td>
  )
}

export function AdminCohortMatrix({ rows, isLoading }: AdminCohortMatrixProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse overflow-hidden rounded-lg border border-admin-line bg-admin-surface">
        <div className="border-b border-admin-line px-3 py-2">
          <div className="h-2.5 w-1/3 rounded bg-admin-raised" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="border-b border-admin-line/40 px-3 py-2.5 last:border-0">
            <div className="h-3 w-4/5 rounded bg-admin-raised/60" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-admin-line bg-admin-surface">
      <table className="w-full min-w-[560px] border-collapse">
        <caption className="sr-only">Ativação acumulada por coorte de cadastro (provas válidas; iniciados inclui treino)</caption>
        <thead>
          <tr className="border-b border-admin-line">
            <th scope="col" className={HEAD_CLASS}>Coorte</th>
            <th scope="col" className={HEAD_CLASS}>Tamanho</th>
            <th scope="col" className={HEAD_CLASS} title="Volume de tentativa — inclui treino. Não é prova válida.">Iniciados</th>
            <th scope="col" className={HEAD_CLASS}>Onboarding</th>
            <th scope="col" className={HEAD_CLASS} title="Provas válidas (dentro da janela). Exclui treino.">≥1 prova</th>
            <th scope="col" className={HEAD_CLASS}>≥2</th>
            <th scope="col" className={HEAD_CLASS}>≥3</th>
            <th scope="col" className={HEAD_CLASS} title="Entrega offline aguardando processamento.">Offline pend.</th>
            <th scope="col" className={HEAD_CLASS} title="Média de acerto em provas válidas (exclui treino).">Média</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.cohort_month}
              className="border-b border-admin-line/40 last:border-0"
            >
              <td className="px-3 py-2 text-xs font-medium text-admin-text whitespace-nowrap">
                {formatMonth(row.cohort_month)}
              </td>
              <td className="px-3 py-2 text-xs tabular-nums text-admin-muted">
                {formatInt(row.cohort_size)}
              </td>
              <td className="px-3 py-2 text-center text-xs tabular-nums text-admin-muted">
                {formatInt(row.started_any)}
              </td>
              <MilestoneCell value={row.did_onboarding} total={row.cohort_size} />
              <MilestoneCell value={row.did_1_plus} total={row.cohort_size} />
              <MilestoneCell value={row.did_2_plus} total={row.cohort_size} />
              <MilestoneCell value={row.did_3_plus} total={row.cohort_size} />
              <MilestoneCell value={row.did_offline_pending} total={row.cohort_size} />
              <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-admin-text">
                {row.avg_score == null ? '—' : row.avg_score.toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
