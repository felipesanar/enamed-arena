// src/admin/components/ui/AdminDataTable.tsx
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  label: string
  width?: string
  render?: (row: T) => ReactNode
}

interface AdminDataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  footer?: ReactNode
  compact?: boolean
  isLoading?: boolean
  emptyMessage?: string
}

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  footer,
  compact,
  isLoading,
  emptyMessage = 'Nenhum dado encontrado.',
}: AdminDataTableProps<T>) {
  const cellPadding = compact ? 'px-3.5 py-2' : 'px-4 py-3'
  const textSize = compact ? 'text-[11px]' : 'text-sm'

  const gridStyle = {
    gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden animate-pulse">
        <div className="grid border-b border-border px-3.5 py-2" style={gridStyle}>
          {columns.map(c => (
            <div key={c.key} className="h-2.5 bg-muted rounded w-2/3" />
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="grid border-b border-border/50 px-3.5 py-2.5" style={gridStyle}>
            {columns.map(c => (
              <div key={c.key} className="h-3 bg-muted/60 rounded w-4/5" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="grid border-b border-border" style={gridStyle}>
        {columns.map(c => (
          <div key={c.key} className={cn(cellPadding)}>
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide">
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.length === 0 ? (
        <div className={cn(cellPadding, 'text-center text-muted-foreground', textSize)}>
          {emptyMessage}
        </div>
      ) : (
        data.map((row, i) => (
          <div
            key={i}
            className={cn(
              'grid border-b border-border/40 last:border-0',
              i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20',
            )}
            style={gridStyle}
          >
            {columns.map(c => (
              <div key={c.key} className={cn(cellPadding, textSize, 'text-foreground')}>
                {c.render ? c.render(row) : String(row[c.key] ?? '')}
              </div>
            ))}
          </div>
        ))
      )}

      {footer && (
        <div className={cn(cellPadding, 'border-t border-border text-muted-foreground', textSize)}>
          {footer}
        </div>
      )}
    </div>
  )
}
