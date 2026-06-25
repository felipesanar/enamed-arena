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
  /** Número de linhas-fantasma no estado carregando. */
  loadingRows?: number
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
  loadingRows = 5,
  emptyMessage = 'Nada por aqui ainda.',
  embedded,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}: AdminDataTableProps<T>) {
  const cellPadding = compact ? 'px-3.5 py-2' : 'px-4 py-3'
  const textSize = compact ? 'text-[12px]' : 'text-[13px]'

  const gridStyle = {
    gridTemplateColumns: columns.map(c => c.width ?? '1fr').join(' '),
  }

  // raio 12 no container
  const shell = cn(
    'rounded-xl border overflow-hidden',
    embedded ? 'border-admin-line-subtle bg-admin-raised/15' : 'border-admin-line bg-admin-surface',
  )

  // cabeçalho: 10.5px / 700 / uppercase / texto fraco / fundo admin-bg
  const headerCellText = 'text-[10.5px] font-bold text-admin-faint uppercase tracking-[0.1em] leading-none'

  // Cabeçalho compartilhado entre estados.
  const header = (
    <div className="grid border-b border-admin-line bg-admin-bg" style={gridStyle}>
      {columns.map(c => (
        <div key={c.key} className={cn(cellPadding)}>
          {c.sortable && onSort ? (
            <button
              type="button"
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => onSort(c.key)}
            >
              <span className={headerCellText}>{c.label}</span>
              <span className="text-[9px] text-admin-faint/70">
                {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
              </span>
            </button>
          ) : (
            <span className={headerCellText}>{c.label}</span>
          )}
        </div>
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <div className={cn(shell, 'overflow-x-auto')} aria-busy="true">
        <div className="min-w-[640px] md:min-w-0">
          {header}
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div
              key={i}
              data-skeleton-row=""
              className={cn(
                'grid border-b border-admin-line-subtle last:border-0 motion-safe:animate-pulse',
                i % 2 === 1 && 'bg-admin-bg',
              )}
              style={gridStyle}
            >
              {columns.map((c, ci) => (
                <div key={c.key} className={cellPadding}>
                  <div
                    className="h-3 rounded bg-admin-raised"
                    style={{ width: ci === 0 ? '55%' : '75%' }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(shell, 'overflow-x-auto')}>
      <div className="min-w-[640px] md:min-w-0">
        {header}

        {/* Linhas */}
        {data.length === 0 ? (
          <div className={cn(cellPadding, 'text-center text-admin-muted py-8', textSize)}>
            {emptyMessage}
          </div>
        ) : (
          data.map((row, i) => (
            <div
              key={i}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                'grid border-b border-admin-line-subtle last:border-0 motion-safe:transition-colors',
                'hover:bg-admin-raised focus-within:bg-admin-raised/70',
                // zebra: linhas pares (índice ímpar) recebem fundo admin-bg
                i % 2 === 1 && 'bg-admin-bg',
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
