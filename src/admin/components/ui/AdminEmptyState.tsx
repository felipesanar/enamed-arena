import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Rótulo curto acima do título (ex.: "Vazio", "Erro", "Sem resultado"). */
  eyebrow?: string
  /** 'error' deixa o quadro com tom de perigo (borda e ícone vermelhos). */
  tone?: 'default' | 'error'
  className?: string
}

export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  eyebrow,
  tone = 'default',
  className,
}: AdminEmptyStateProps) {
  const isError = tone === 'error'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border',
          isError
            ? 'border-admin-destructive/25 bg-admin-destructive/10'
            : 'border-admin-line bg-admin-raised',
        )}
      >
        <Icon
          className={cn('h-5 w-5', isError ? 'text-admin-destructive' : 'text-admin-faint')}
          aria-hidden
        />
      </div>
      {eyebrow && (
        <p
          className={cn(
            'mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em]',
            isError ? 'text-admin-destructive' : 'text-admin-faint',
          )}
        >
          {eyebrow}
        </p>
      )}
      <p className="text-sm font-bold text-admin-text">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-admin-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
