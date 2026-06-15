// src/admin/components/ui/AdminInsightCard.tsx
import { Activity, FileText, Sparkles, TrendingDown, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntelInsight } from '@/admin/types'

interface AdminInsightCardProps {
  insight: IntelInsight
  onNavigate?: (route: string) => void
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  desempenho: TrendingDown,
  engajamento: Activity,
  aquisicao: Users,
  conteudo: FileText,
}

const SEVERITY_BORDER: Record<IntelInsight['severity'], string> = {
  critical: 'border-l-admin-destructive',
  warning: 'border-l-admin-warning',
  info: 'border-l-admin-info',
}

const SEVERITY_ICON_COLOR: Record<IntelInsight['severity'], string> = {
  critical: 'text-admin-destructive',
  warning: 'text-admin-warning',
  info: 'text-admin-info',
}

export function AdminInsightCard({ insight, onNavigate }: AdminInsightCardProps) {
  const Icon = CATEGORY_ICON[insight.category] ?? Sparkles

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={insight.title}
      onClick={() => onNavigate?.(insight.route)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate?.(insight.route)
        }
      }}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-admin-line bg-admin-surface p-3',
        'border-l-[3px]',
        SEVERITY_BORDER[insight.severity],
        'cursor-pointer transition-colors motion-reduce:transition-none',
        'hover:bg-admin-raised/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', SEVERITY_ICON_COLOR[insight.severity])} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-admin-text">{insight.title}</p>
        <p className="text-xs text-admin-muted">{insight.detail}</p>
      </div>
    </div>
  )
}
