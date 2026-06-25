import { cn } from '@/lib/utils'
import { SEGMENT_META, ATTEMPT_STATUS_META, ROLE_META } from '@/admin/lib/constants'

interface AdminBadgeProps {
  kind: 'segment' | 'attemptStatus' | 'role'
  value: string
  className?: string
  /**
   * Mostra um ponto colorido antes do texto (mesma cor semântica do selo).
   * Usado em status de tentativa e disponibilidade de simulado para leitura rápida.
   */
  dot?: boolean
}

const NEUTRAL = 'bg-admin-raised text-admin-muted border-admin-line'

export function AdminBadge({ kind, value, className, dot }: AdminBadgeProps) {
  let label = value
  let tone = NEUTRAL

  if (kind === 'segment') {
    const meta = SEGMENT_META[value]
    if (meta) { label = meta.label; tone = meta.className }
  } else if (kind === 'attemptStatus') {
    const meta = ATTEMPT_STATUS_META[value]
    if (meta) { label = meta.label; tone = meta.className }
  } else if (kind === 'role') {
    const meta = ROLE_META[value]
    if (meta) { label = meta.label; tone = 'bg-admin-accent/10 text-admin-accent border-admin-accent/30' }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[11px] font-semibold leading-none whitespace-nowrap',
        tone,
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {label}
    </span>
  )
}
