// src/admin/components/ui/AdminLivePanel.tsx
import { cn } from '@/lib/utils'
import type { LiveSignals } from '@/admin/types'

interface AdminLivePanelProps {
  data: LiveSignals | undefined
  isLoading: boolean
}

function LiveCard({
  label,
  value,
  warning,
  isLoading,
}: {
  label: string
  value: number
  warning?: boolean
  isLoading: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md px-2.5 py-2 border',
        warning && value > 0
          ? 'bg-warning/5 border-warning/30'
          : 'bg-background border-border',
      )}
    >
      <p className={cn('text-[9px] mb-0.5', warning && value > 0 ? 'text-warning' : 'text-muted-foreground')}>
        {warning && value > 0 ? '⚠ ' : ''}{label}
      </p>
      {isLoading ? (
        <div className="h-5 w-8 bg-muted rounded animate-pulse" />
      ) : (
        <p className={cn('text-lg font-bold', warning && value > 0 ? 'text-warning' : 'text-foreground')}>
          {value}
        </p>
      )}
    </div>
  )
}

export function AdminLivePanel({ data, isLoading }: AdminLivePanelProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <p className="text-[11px] font-semibold text-foreground">Ao vivo</p>
      </div>
      <LiveCard
        label="Online agora"
        value={data?.online_last_15min ?? 0}
        isLoading={isLoading}
      />
      <LiveCard
        label="Em prova agora"
        value={data?.active_exams ?? 0}
        isLoading={isLoading}
      />
      <LiveCard
        label="Tickets abertos"
        value={data?.open_tickets ?? 0}
        warning
        isLoading={isLoading}
      />
      <p className="text-[8px] text-muted-foreground/40 text-center">
        "online" = eventos nos últimos 15 min
      </p>
    </div>
  )
}
