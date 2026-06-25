import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface AdminPanelProps {
  children: ReactNode
  className?: string
  /** Sem padding interno (ex.: tabela full-bleed) */
  flush?: boolean
  /** Realça borda + sombra ao passar o mouse (use em cards clicáveis). */
  hover?: boolean
}

/**
 * Superfície padrão para agrupar blocos na Central Admin (elevação leve, dark-ready).
 */
export function AdminPanel({ children, className, flush, hover }: AdminPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-admin-line/80 bg-admin-surface',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/30',
        'transition-[border-color,box-shadow] duration-[160ms] ease-out motion-reduce:transition-none',
        hover && 'hover:border-admin-line-strong hover:shadow-[0_4px_16px_rgba(26,23,21,0.06)] dark:hover:shadow-black/40',
        !flush && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
