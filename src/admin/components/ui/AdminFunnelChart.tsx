// src/admin/components/ui/AdminFunnelChart.tsx
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunnelStep } from '@/admin/types'

function stepOpacity(index: number, total: number): string {
  const min = 0.25
  const opacity = 1 - (index / (total - 1)) * (1 - min)
  return String(Math.round(opacity * 100) / 100)
}

interface AdminFunnelChartProps {
  steps: FunnelStep[]
  isLoading?: boolean
  embedded?: boolean
}

export function AdminFunnelChart({ steps, isLoading, embedded }: AdminFunnelChartProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-lg border p-4',
          embedded ? 'border-transparent bg-admin-raised/20' : 'border-admin-line bg-admin-surface',
        )}
      >
        <div className="h-3 bg-admin-raised rounded w-1/4 mb-4" />
        <div className="flex gap-1 items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 h-14 bg-admin-raised rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!steps.length) return null

  // "Maior queda" só considera etapas com conversão rastreada (não-null).
  const trackedDrops = steps.slice(1).filter(s => s.conversion_from_prev != null)
  const biggestDropStep = trackedDrops.length
    ? trackedDrops.reduce((min, s) =>
        (s.conversion_from_prev as number) < (min.conversion_from_prev as number) ? s : min,
        trackedDrops[0],
      )
    : null
  const biggestDropIndex = biggestDropStep
    ? steps.findIndex(s => s.step_order === biggestDropStep.step_order)
    : -1
  const prevStep = biggestDropIndex > 0 ? steps[biggestDropIndex - 1] : null

  return (
    <div
      className={cn(
        embedded ? 'p-0 border-0 bg-transparent' : 'rounded-lg border border-admin-line bg-admin-surface p-4',
      )}
    >
      <div className="flex items-stretch gap-0.5">
        {steps.map((step, i) => (
          <div key={step.step_order} className="flex items-center flex-1 gap-0.5 min-w-0">
            <div
              className={cn(
                'flex-1 rounded-md px-2 py-2.5 text-center min-w-0',
                biggestDropStep && step.step_order === biggestDropStep.step_order && 'ring-1 ring-admin-destructive/40',
              )}
              style={{
                backgroundColor: `hsl(var(--admin-accent) / ${stepOpacity(i, steps.length)})`,
              }}
            >
              <p className="text-base font-bold text-admin-accent-contrast leading-none mb-1">
                {step.user_count.toLocaleString('pt-BR')}
              </p>
              <p className="text-[9px] text-admin-accent-contrast/70 leading-tight break-words" aria-hidden="true">
                {step.step_label}
              </p>
              {i > 0 && (
                step.conversion_from_prev == null ? (
                  <p className="text-[9px] mt-1 font-medium text-admin-accent-contrast/60">
                    — sem rastreio
                  </p>
                ) : (
                  <p
                    className={cn(
                      'text-[9px] mt-1 font-medium',
                      step.conversion_from_prev >= 70 ? 'text-admin-success' : 'text-admin-destructive',
                    )}
                  >
                    {step.conversion_from_prev}%
                    {step.insufficient_data && (
                      <span className="ml-1 text-admin-accent-contrast/50">(base baixa)</span>
                    )}
                  </p>
                )
              )}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-admin-muted/50 self-center"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      {biggestDropStep && prevStep && biggestDropStep.conversion_from_prev != null && (
        <p className="mt-3 px-3 py-2 bg-admin-destructive/5 border border-admin-destructive/20 rounded-md text-[10px] text-admin-muted flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-admin-destructive shrink-0 mt-0.5" aria-hidden />
          <span>
            <span className="text-admin-destructive font-semibold">Maior queda: </span>
            {prevStep.step_label} → {biggestDropStep.step_label} (−
            {(100 - biggestDropStep.conversion_from_prev).toFixed(1)}pp). Possível fricção nessa etapa.
          </span>
        </p>
      )}
    </div>
  )
}
