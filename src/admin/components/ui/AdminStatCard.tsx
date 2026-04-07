// src/admin/components/ui/AdminStatCard.tsx
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminStatCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  accentBorder?: boolean
  isLoading?: boolean
}

export function AdminStatCard({
  label,
  value,
  delta,
  deltaLabel,
  accentBorder,
  isLoading,
}: AdminStatCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-border/80 bg-card p-3 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
        <div className="h-3 bg-muted rounded w-2/3 mb-3" />
        <div className="h-6 bg-muted rounded w-1/2 mb-2" />
        <div className="h-2.5 bg-muted rounded w-1/3" />
      </div>
    )
  }

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card p-3',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/25',
        'transition-colors duration-200 motion-reduce:transition-none',
        accentBorder && 'border-l-[3px] border-l-primary',
      )}
    >
      <p className="text-micro-label text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-foreground leading-none mb-1.5">{value}</p>
      {delta !== undefined ? (
        <p
          className={cn(
            'text-caption flex items-center gap-1',
            isPositive && 'text-success',
            isNegative && 'text-destructive',
            !isPositive && !isNegative && 'text-muted-foreground',
          )}
        >
          {isPositive && (
            <>
              <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
              <span>+{delta}</span>
            </>
          )}
          {isNegative && (
            <>
              <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
              <span>−{Math.abs(delta)}</span>
            </>
          )}
          {!isPositive && !isNegative && (
            <>
              <Minus className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              <span>{Math.abs(delta)}</span>
            </>
          )}
          {deltaLabel && <span className="text-muted-foreground font-normal">{deltaLabel}</span>}
        </p>
      ) : null}
    </div>
  )
}
