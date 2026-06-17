// src/admin/components/ui/AdminDataTable.tsx
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  label: string
  width?: string
  render?: (row: T) => ReactNode
  sortable?: boolean
}

interface AdminDataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  footer?: ReactNode
  compact?: boolean
  isLoading?: boolean
  emptyMessage?: string
  /** Dentro de `AdminPanel` */
  embedded?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T, index: number) => void
}

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  footer,
  compact,
  isLoading,
  emptyMessage = 'Nenhum dado encontrado.',
  embedded,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}: AdminDataTableProps<T>) {
  const cellPadding = compact ? 'px-3.5 py-2' : 'px-4 py-3'
  const textSize = compact ? 'text-[11px]' : 'text-sm'

  const gridStyle = {
    gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
  }

  const shell = cn(
    'rounded-lg border overflow-hidden',
    embedded ? 'border-admin-line/60 bg-admin-raised/15' : 'border-admin-line bg-admin-surface',
  )

  if (isLoading) {
    return (
      <div className={cn(shell, 'animate-pulse')}>
        <div className="grid border-b border-admin-line px-3.5 py-2" style={gridStyle}>
          {columns.map(c => (
            <div key={c.key} className="h-2.5 bg-admin-raised rounded w-2/3" />
          ))}
        </div>
        {[1, 2].map(i => (
          <div key={i} className="grid border-b border-admin-line/50 px-3.5 py-2.5" style={gridStyle}>
            {columns.map(c => (
              <div key={c.key} className="h-3 bg-admin-raised/60 rounded w-4/5" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn(shell, 'overflow-x-auto')}>
      <div className="min-w-[640px] md:min-w-0">
      {/* Header */}
      <div className="grid border-b border-admin-line" style={gridStyle}>
        {columns.map(c => (
          <div key={c.key} className={cn(cellPadding)}>
            {c.sortable && onSort ? (
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => onSort(c.key)}
              >
                <span className="text-[9px] font-bold text-admin-muted/60 uppercase tracking-wide">
                  {c.label}
                </span>
                <span className="text-[9px] text-admin-muted/40">
                  {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
              </button>
            ) : (
              <span className="text-[9px] font-bold text-admin-muted/60 uppercase tracking-wide">
                {c.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.length === 0 ? (
        <div className={cn(cellPadding, 'text-center text-admin-muted', textSize)}>
          {emptyMessage}
        </div>
      ) : (
        data.map((row, i) => (
          <div
            key={i}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={cn(
              'grid border-b border-admin-line/40 last:border-0 motion-safe:transition-colors',
              'hover:bg-admin-raised/30 focus-within:bg-admin-raised/20',
              i % 2 === 0 ? 'bg-transparent' : 'bg-admin-raised/15',
              onRowClick && 'cursor-pointer',
            )}
            style={gridStyle}
            onClick={onRowClick ? () => onRowClick(row, i) : undefined}
            onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row, i) } } : undefined}
          >
            {columns.map(c => (
              <div key={c.key} className={cn(cellPadding, textSize, 'text-admin-text')}>
                {c.render ? c.render(row) : String(row[c.key] ?? '')}
              </div>
            ))}
          </div>
        ))
      )}

      {footer && (
        <div className={cn(cellPadding, 'border-t border-admin-line text-admin-muted', textSize)}>
          {footer}
        </div>
      )}
      </div>
    </div>
  )
}
