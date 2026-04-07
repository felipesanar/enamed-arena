// src/admin/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom'
import { useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import {
  useAdminDashboardKpis,
  useAdminEventsTimeseries,
  useAdminFunnelStats,
  useAdminSimuladoEngagement,
  useAdminLiveSignals,
} from '@/admin/hooks/useAdminDashboard'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminFunnelChart } from '@/admin/components/ui/AdminFunnelChart'
import { AdminLivePanel } from '@/admin/components/ui/AdminLivePanel'
import { AdminDataTable } from '@/admin/components/ui/AdminDataTable'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { adminChartSeriesColors } from '@/admin/lib/adminChartTheme'
import { cn } from '@/lib/utils'
import type { AdminPeriod, SimuladoEngagementRow } from '@/admin/types'

const PERIOD_OPTIONS: { label: string; value: AdminPeriod }[] = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

function delta(current: number, prev: number): number {
  return Math.round((current - prev) * 10) / 10
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function AdminDashboard() {
  const { period, setPeriod } = useAdminPeriod()

  const kpis       = useAdminDashboardKpis(period)
  const timeseries = useAdminEventsTimeseries(period)
  const funnel     = useAdminFunnelStats(period)
  const engagement = useAdminSimuladoEngagement(8)
  const live       = useAdminLiveSignals()

  const k = kpis.data

  const engagementColumns = [
    { key: 'title',            label: 'Simulado',      width: '2fr',  render: (r: SimuladoEngagementRow) => `#${r.sequence_number} — ${r.title}` },
    { key: 'participants',     label: 'Participantes', width: '90px' },
    { key: 'completion_rate',  label: 'Conclusão',     width: '90px', render: (r: SimuladoEngagementRow) => formatPct(r.completion_rate) },
    { key: 'avg_score',        label: 'Média',         width: '80px', render: (r: SimuladoEngagementRow) => formatPct(r.avg_score) },
    { key: 'abandonment_rate', label: 'Abandono',      width: '80px', render: (r: SimuladoEngagementRow) => formatPct(r.abandonment_rate) },
  ] as const

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* Page header + period selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Dashboard</h1>
          <p className="text-caption text-muted-foreground">Central de comando · ENAMED Arena</p>
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium motion-safe:transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                period === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEÇÃO 1: Visão Executiva ── */}
      <section>
        <AdminSectionHeader title="Visão Executiva" hook="useAdminDashboardKpis" />
        <AdminPanel className="p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <AdminStatCard
            label="Usuários totais"
            value={k?.total_users.toLocaleString('pt-BR') ?? 0}
            delta={k ? delta(k.new_users, k.new_users_prev) : undefined}
            deltaLabel="novos vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Novos usuários"
            value={k?.new_users ?? 0}
            delta={k ? delta(k.new_users, k.new_users_prev) : undefined}
            deltaLabel="vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Taxa de conclusão"
            value={k ? formatPct(k.completion_rate) : '—'}
            delta={k ? delta(k.completion_rate, k.completion_rate_prev) : undefined}
            deltaLabel="pp vs período ant."
            accentBorder={k ? k.completion_rate < k.completion_rate_prev : false}
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Média de nota"
            value={k ? formatPct(k.avg_score) : '—'}
            delta={k ? delta(k.avg_score, k.avg_score_prev) : undefined}
            deltaLabel="pp vs período ant."
            isLoading={kpis.isLoading}
          />
          <AdminStatCard
            label="Taxa de ativação"
            value={k ? formatPct(k.activation_rate) : '—'}
            delta={k ? delta(k.activation_rate, k.activation_rate_prev) : undefined}
            deltaLabel="pp vs período ant."
            isLoading={kpis.isLoading}
          />
        </div>
        {kpis.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro ao carregar KPIs.{' '}
            <button type="button" className="underline" onClick={() => kpis.refetch()}>Tentar novamente</button>
          </p>
        )}
        </AdminPanel>
      </section>

      {/* ── SEÇÃO 2: Tendências + Sinais ao vivo ── */}
      <section>
        <AdminSectionHeader title="Tendências" hook="useAdminEventsTimeseries" />
        <AdminPanel className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_200px] gap-3">
          <AdminTrendChart
            embedded
            title="Novos cadastros / dia"
            data={timeseries.data ?? []}
            xKey="day"
            bars={[{ key: 'new_users', color: adminChartSeriesColors.primary, label: 'Cadastros' }]}
            isLoading={timeseries.isLoading}
          />
          <AdminTrendChart
            embedded
            title="Simulados iniciados vs concluídos"
            data={timeseries.data ?? []}
            xKey="day"
            bars={[
              { key: 'exams_started',   color: adminChartSeriesColors.primary, label: 'Iniciados' },
              { key: 'exams_completed', color: adminChartSeriesColors.success, label: 'Concluídos' },
            ]}
            isLoading={timeseries.isLoading}
          />
          <AdminLivePanel embedded data={live.data} isLoading={live.isLoading} />
        </div>
        {timeseries.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro nos gráficos.{' '}
            <button type="button" className="underline" onClick={() => timeseries.refetch()}>Tentar novamente</button>
          </p>
        )}
        </AdminPanel>
      </section>

      {/* ── SEÇÃO 3: Funil de Jornada ── */}
      <section>
        <AdminSectionHeader title="Funil de Jornada" hook="useAdminFunnelStats" />
        <AdminPanel flush className="p-3 sm:p-4">
          <AdminFunnelChart embedded steps={funnel.data ?? []} isLoading={funnel.isLoading} />
        </AdminPanel>
        {funnel.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro no funil.{' '}
            <button type="button" className="underline" onClick={() => funnel.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

      {/* ── SEÇÃO 4: Simulados — Engajamento ── */}
      <section>
        <AdminSectionHeader title="Simulados — Engajamento" hook="useAdminSimuladoEngagement" />
        <AdminPanel flush className="p-3 sm:p-4">
        <AdminDataTable
          embedded
          columns={engagementColumns as any}
          data={(engagement.data ?? []) as any}
          compact
          isLoading={engagement.isLoading}
          emptyMessage="Nenhum simulado encontrado."
          footer={
            <Link to="/admin/simulados" className="text-primary hover:underline text-[11px] inline-flex items-center gap-1 font-medium">
              Ver todos os simulados
            </Link>
          }
        />
        </AdminPanel>
        {engagement.isError && (
          <p className="text-xs text-destructive mt-2">
            Erro ao carregar simulados.{' '}
            <button type="button" className="underline" onClick={() => engagement.refetch()}>Tentar novamente</button>
          </p>
        )}
      </section>

    </div>
  )
}
