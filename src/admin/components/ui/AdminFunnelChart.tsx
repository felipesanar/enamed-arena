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
          embedded ? 'border-transparent bg-muted/20' : 'border-border bg-card',
        )}
      >
        <div className="h-3 bg-muted rounded w-1/4 mb-4" />
        <div className="flex gap-1 items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 h-14 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!steps.length) return null

  const stepsWithDrop = steps.slice(1)
  const biggestDropStep = stepsWithDrop.reduce((min, s) =>
    s.conversion_from_prev < min.conversion_from_prev ? s : min,
    stepsWithDrop[0],
  )
  const biggestDropIndex = steps.findIndex(s => s.step_order === biggestDropStep.step_order)
  const prevStep = steps[biggestDropIndex - 1]

  return (
    <div
      className={cn(
        embedded ? 'p-0 border-0 bg-transparent' : 'rounded-lg border border-border bg-card p-4',
      )}
    >
      <div className="flex items-stretch gap-0.5">
        {steps.map((step, i) => (
          <div key={step.step_order} className="flex items-center flex-1 gap-0.5 min-w-0">
            <div
              className={cn(
                'flex-1 rounded-md px-2 py-2.5 text-center min-w-0',
                step.step_order === biggestDropStep.step_order && 'ring-1 ring-destructive/40',
              )}
              style={{
                backgroundColor: `hsl(var(--primary) / ${stepOpacity(i, steps.length)})`,
              }}
            >
              <p className="text-base font-bold text-primary-foreground leading-none mb-1">
                {step.user_count.toLocaleString('pt-BR')}
              </p>
              <p className="text-[9px] text-primary-foreground/70 leading-tight break-words" aria-hidden="true">
                {step.step_label}
              </p>
              {i > 0 && (
                <p
                  className={cn(
                    'text-[9px] mt-1 font-medium',
                    step.conversion_from_prev >= 70 ? 'text-emerald-200' : 'text-red-200',
                  )}
                >
                  {step.conversion_from_prev}%
                </p>
              )}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground/50 self-center"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>

      {biggestDropStep && prevStep && (
        <p className="mt-3 px-3 py-2 bg-destructive/5 border border-destructive/20 rounded-md text-[10px] text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" aria-hidden />
          <span>
            <span className="text-destructive font-semibold">Maior queda: </span>
            {prevStep.step_label} → {biggestDropStep.step_label} (−
            {(100 - biggestDropStep.conversion_from_prev).toFixed(1)}pp). Possível fricção nessa etapa.
          </span>
        </p>
      )}
    </div>
  )
}
