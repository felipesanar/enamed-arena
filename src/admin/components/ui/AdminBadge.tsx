import { cn } from '@/lib/utils'
import { SEGMENT_META, ATTEMPT_STATUS_META, ROLE_META } from '@/admin/lib/constants'

interface AdminBadgeProps {
  kind: 'segment' | 'attemptStatus' | 'role'
  value: string
  className?: string
}

const NEUTRAL = 'bg-admin-raised text-admin-muted border-admin-line'

export function AdminBadge({ kind, value, className }: AdminBadgeProps) {
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
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', tone, className)}>
      {label}
    </span>
  )
}
