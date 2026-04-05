// src/admin/components/ui/AdminStatCard.tsx
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
      <div className="animate-pulse bg-card rounded-lg border border-border p-3">
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
        'bg-card rounded-lg border border-border p-3',
        accentBorder && 'border-l-2 border-l-primary',
      )}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground leading-none mb-1.5">
        {value}
      </p>
      {delta !== undefined ? (
        <p
          className={cn(
            'text-[10px] flex items-center gap-1',
            isPositive && 'text-success',
            isNegative && 'text-destructive',
            !isPositive && !isNegative && 'text-muted-foreground',
          )}
        >
          {isPositive && `▲ +${delta}`}
          {isNegative && `▼ −${Math.abs(delta)}`}
          {!isPositive && !isNegative && `― ${Math.abs(delta)}`}
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </p>
      ) : null}
    </div>
  )
}
