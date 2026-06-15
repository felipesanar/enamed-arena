import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface AdminEmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function AdminEmptyState({ icon: Icon = Inbox, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-10 h-10 rounded-full bg-admin-raised border border-admin-line flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-admin-faint" aria-hidden />
      </div>
      <p className="text-sm font-medium text-admin-text">{title}</p>
      {description && <p className="text-xs text-admin-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
