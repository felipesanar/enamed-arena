// src/admin/components/ui/AdminBarList.tsx
import { cn } from '@/lib/utils'

interface BarListItem {
  label: string
  value: number
  sublabel?: string
}

interface AdminBarListProps {
  items: BarListItem[]
  /** Valor de referência para 100% da trilha. Default = maior valor (mín. 1). */
  max?: number
  /** value ≥ goodAt → success */
  goodAt?: number
  /** value ≥ warnAt → warning (abaixo → destructive) */
  warnAt?: number
  valueSuffix?: string
  isLoading?: boolean
  /** Dentro de `AdminPanel` */
  embedded?: boolean
}

function barColor(value: number, goodAt?: number, warnAt?: number): string {
  if (goodAt === undefined && warnAt === undefined) return 'bg-admin-accent'
  if (goodAt !== undefined && value >= goodAt) return 'bg-admin-success'
  if (warnAt !== undefined && value >= warnAt) return 'bg-admin-warning'
  return 'bg-admin-destructive'
}

export function AdminBarList({
  items,
  max,
  goodAt,
  warnAt,
  valueSuffix = '',
  isLoading,
  embedded,
}: AdminBarListProps) {
  if (isLoading) {
    return (
      <div className={cn('animate-pulse space-y-2.5', embedded ? '' : 'p-1')}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-20 rounded bg-admin-raised" />
            <div className="h-2.5 flex-1 rounded bg-admin-raised" />
            <div className="h-2.5 w-8 rounded bg-admin-raised" />
          </div>
        ))}
      </div>
    )
  }

  const resolvedMax = max ?? Math.max(...items.map(i => i.value), 1)

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(100, (item.value / resolvedMax) * 100))
        return (
          <div key={`${item.label}-${i}`} className="flex items-center gap-2.5">
            <div className="w-24 shrink-0 min-w-0">
              <p className="truncate text-xs font-medium text-admin-text" title={item.label}>
                {item.label}
              </p>
              {item.sublabel && (
                <p className="truncate text-[10px] text-admin-faint">{item.sublabel}</p>
              )}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-admin-raised">
              <div
                className={cn('h-full rounded-full transition-all', barColor(item.value, goodAt, warnAt))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-admin-muted">
              {item.value.toFixed(1) + valueSuffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}
