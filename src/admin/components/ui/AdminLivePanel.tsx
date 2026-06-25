// src/admin/components/ui/AdminLivePanel.tsx
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LiveSignals } from '@/admin/types'

interface AdminLivePanelProps {
  data: LiveSignals | undefined
  isLoading: boolean
  embedded?: boolean
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
          ? 'bg-admin-warning/5 border-admin-warning/30'
          : 'bg-admin-bg/80 border-admin-line',
      )}
    >
      <p
        className={cn(
          'text-[9px] mb-0.5 flex items-center gap-1',
          warning && value > 0 ? 'text-admin-warning' : 'text-admin-muted',
        )}
      >
        {warning && value > 0 ? (
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
        ) : null}
        {label}
      </p>
      {isLoading ? (
        <div className="h-5 w-8 bg-admin-raised rounded animate-pulse" />
      ) : (
        <p className={cn('text-lg font-bold', warning && value > 0 ? 'text-admin-warning' : 'text-admin-text')}>
          {value}
        </p>
      )}
    </div>
  )
}

export function AdminLivePanel({ data, isLoading, embedded }: AdminLivePanelProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 flex flex-col gap-2',
        embedded ? 'border-admin-line/60 bg-admin-raised/15' : 'border-admin-line bg-admin-surface',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <p className="text-[11px] font-semibold text-admin-text">Ao vivo</p>
      </div>
      <LiveCard label="Online agora (aprox.)" value={data?.online_last_15min ?? 0} isLoading={isLoading} />
      <LiveCard label="Em prova agora" value={data?.active_exams ?? 0} isLoading={isLoading} />
      <LiveCard label="Aguardando envio (offline)" value={data?.offline_pending_now ?? 0} isLoading={isLoading} />
      {data?.tickets_supported ? (
        <LiveCard label="Tickets abertos" value={data?.open_tickets ?? 0} warning isLoading={isLoading} />
      ) : (
        <div className="rounded-md px-2.5 py-2 border bg-admin-bg/80 border-admin-line">
          <p className="text-[9px] mb-0.5 text-admin-muted">Tickets abertos</p>
          <p className="text-lg font-bold text-admin-muted">--</p>
          <p className="text-[8px] text-admin-muted/60 leading-tight">sem módulo de suporte</p>
        </div>
      )}
      <p className="text-[8px] text-admin-muted/50 text-center leading-tight">
        &quot;online&quot; = atividade nos últimos 15 min (estimativa, baixa confiança)
      </p>
    </div>
  )
}
