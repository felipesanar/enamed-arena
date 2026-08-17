// src/admin/components/GabaritoSuspicionBanner.tsx
//
// Banner de destaque no Dashboard para simulados na "janela de ouro":
// execução encerrada, resultado ainda não liberado. No incidente da S6 Q49
// esse sinal ficou pronto e disponível por 33h antes de alguém olhar — este
// banner é a tentativa de fechar essa janela.
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useGabaritoGoldenWindowSimulados,
  useGabaritoSuspicionMap,
} from '@/admin/hooks/useGabaritoSuspicion'
import { formatSuspectPct } from '@/admin/lib/suspectKey'

export function GabaritoSuspicionBanner() {
  const { data: candidates = [] } = useGabaritoGoldenWindowSimulados()
  const candidateIds = candidates.map(c => c.id)
  const { data: suspicionMap } = useGabaritoSuspicionMap(candidateIds)

  const flagged = candidates
    .map(simulado => ({ simulado, suspects: suspicionMap?.get(simulado.id) ?? [] }))
    .filter(({ suspects }) => suspects.length > 0)

  // Sem candidatos na janela de ouro, ou sem sinal de suspeita neles: nada a
  // dizer aqui. Não polui o dashboard com um banner "tudo certo".
  if (flagged.length === 0) return null

  const hasHigh = flagged.some(({ suspects }) => suspects.some(s => s.severity === 'high'))

  return (
    <div
      className={cn(
        'rounded-xl border border-admin-line/80 border-l-[3px] bg-admin-surface p-4',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/25',
        hasHigh ? 'border-l-admin-destructive' : 'border-l-admin-warning',
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle
          className={cn('h-4 w-4 shrink-0', hasHigh ? 'text-admin-destructive' : 'text-admin-warning')}
          aria-hidden
        />
        <p
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.06em]',
            hasHigh ? 'text-admin-destructive' : 'text-admin-warning',
          )}
        >
          Suspeita de gabarito — janela de ouro
        </p>
      </div>

      <p className="mb-3 text-[12.5px] text-admin-muted">
        Janela de execução encerrada e resultado ainda não liberado para {flagged.length === 1 ? 'este simulado' : 'estes simulados'}.
        É a hora de conferir antes que os alunos vejam a nota.
      </p>

      <div className="flex flex-col gap-2">
        {flagged.map(({ simulado, suspects }) => {
          const worst = suspects[0] // já vem ordenado por gravidade (menor correct_rate primeiro)
          return (
            <Link
              key={simulado.id}
              to={`/admin/simulados/${simulado.id}/analytics`}
              className={cn(
                'group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
                'border-admin-line-subtle bg-admin-raised/30 motion-safe:transition-colors hover:bg-admin-raised/60',
              )}
            >
              <span className="min-w-0 text-[12.5px] text-admin-text">
                <span className="font-semibold">
                  #{simulado.sequence_number} {simulado.title}
                </span>
                <span className="text-admin-muted">
                  {' — '}
                  {suspects.length === 1 ? '1 questão suspeita' : `${suspects.length} questões suspeitas`}
                  {worst && (
                    <>
                      {' '}
                      (Q{worst.questionNumber}: {formatSuspectPct(worst.correctRate)} de acerto,{' '}
                      {formatSuspectPct(worst.topWrongPct)} em {worst.topWrongLabel})
                    </>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-admin-accent group-hover:underline">
                Ver análise →
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
