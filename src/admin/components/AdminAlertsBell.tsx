import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { useAdminIntelInsights } from '@/admin/hooks/useAdminInteligencia'
import { logger } from '@/lib/logger'
import type { IntelInsight } from '@/admin/types'

function SeverityDot({ severity }: { severity: IntelInsight['severity'] }) {
  const colorClass =
    severity === 'critical'
      ? 'bg-admin-destructive'
      : severity === 'warning'
        ? 'bg-admin-warning'
        : 'bg-admin-info'
  return <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${colorClass}`} aria-hidden />
}

export function AdminAlertsBell() {
  const canView = useAdminCan('intel.view')
  const { data: insights = [], isLoading } = useAdminIntelInsights()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  if (!canView) return null

  const alertCount = insights.filter(
    i => i.severity === 'critical' || i.severity === 'warning',
  ).length
  const hasCritical = insights.some(i => i.severity === 'critical')

  function handleInsightClick(insight: IntelInsight) {
    setOpen(false)
    logger.log('[AdminAlertsBell] Navegando para:', insight.route)
    navigate(insight.route)
    if (insight.route.includes('#')) {
      const id = insight.route.split('#')[1]
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Alertas"
          className="relative w-8 h-8 rounded-md flex items-center justify-center text-admin-muted hover:text-admin-text hover:bg-admin-raised motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {alertCount > 0 && (
            <span
              aria-hidden
              className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[9px] font-bold leading-none text-white px-0.5 ${hasCritical ? 'bg-admin-destructive' : 'bg-admin-warning'}`}
            >
              {alertCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 bg-admin-surface border-admin-line text-admin-text p-0"
      >
        <div className="px-3 py-2 border-b border-admin-line">
          <span className="text-xs font-medium text-admin-text">Alertas</span>
        </div>

        {isLoading ? (
          <div className="px-3 py-2 space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-3 rounded bg-admin-raised animate-pulse" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="text-xs text-admin-muted px-3 py-6 text-center">
            Nenhum alerta no momento.
          </p>
        ) : (
          <ul className="max-h-80 overflow-auto">
            {insights.map(insight => (
              <li key={insight.id}>
                <button
                  type="button"
                  onClick={() => handleInsightClick(insight)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-admin-raised motion-safe:transition-colors"
                >
                  <SeverityDot severity={insight.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-admin-text leading-snug">
                      {insight.title}
                    </p>
                    <p className="text-[11px] text-admin-muted line-clamp-2 mt-0.5">
                      {insight.detail}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
