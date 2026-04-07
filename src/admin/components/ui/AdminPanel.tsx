import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface AdminPanelProps {
  children: ReactNode
  className?: string
  /** Sem padding interno (ex.: tabela full-bleed) */
  flush?: boolean
}

/**
 * Superfície padrão para agrupar blocos na Central Admin (elevação leve, dark-ready).
 */
export function AdminPanel({ children, className, flush }: AdminPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/30',
        'transition-colors duration-200 motion-reduce:transition-none',
        !flush && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
