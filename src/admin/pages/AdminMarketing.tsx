import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { adminChartSeriesColors } from '@/admin/lib/adminChartTheme'
import { PERIOD_OPTIONS } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import {
  useAdminMarketingKpis,
  useAdminMarketingSources,
  useAdminMarketingMediums,
  useAdminMarketingCampaigns,
} from '@/admin/hooks/useAdminMarketing'
import type { MarketingSourceRow, MarketingMediumRow, MarketingCampaignRow } from '@/admin/types'

/** Mantém os mesmos períodos exibidos antes da centralização (7/30/90). */
const PERIODS = PERIOD_OPTIONS.filter(opt => opt.value !== 14)

/** Paleta de séries decorativas (tokens admin + 3 hues extras legíveis em claro/escuro) */
const SOURCE_COLORS = [
  adminChartSeriesColors.primary,
  adminChartSeriesColors.info,
  adminChartSeriesColors.success,
  adminChartSeriesColors.warning,
  'hsl(280 55% 55%)',
  'hsl(24 90% 55%)',
  'hsl(190 70% 45%)',
  adminChartSeriesColors.muted,
]

function convColor(pct: number) {
  if (pct >= 40) return 'text-admin-success'
  if (pct >= 20) return 'text-admin-warning'
  return 'text-admin-destructive'
}

function exportCampaignsCsv(rows: MarketingCampaignRow[]) {
  const header = 'Campanha,Canal,Visitas,Cadastros,Conversão (%),1ª Prova'
  const lines = rows.map(r =>
    [r.campaign, r.source, r.visits, r.signups, r.conv_rate.toFixed(1), r.first_exams].join(',')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'campanhas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function AdminMarketingContent() {
  const [days, setDays] = useState(30)

  const { data: kpis, isLoading: kLoading } = useAdminMarketingKpis(days)
  const { data: sources = [] } = useAdminMarketingSources(days)
  const { data: mediums = [] } = useAdminMarketingMediums(days)
  const { data: campaigns = [] } = useAdminMarketingCampaigns(days)

  const delta = kpis ? kpis.new_users - kpis.new_users_prev : undefined

  return (
    <div className="space-y-5 max-w-[1400px]">
      <AdminPageHeader
        title="Aquisição"
        subtitle="UTM source, medium e campanhas"
        actions={
          <>
            <div className="flex items-center gap-1.5 bg-admin-surface border border-admin-line/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  aria-label={p.label}
                  onClick={() => setDays(p.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium motion-safe:transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg',
                    days === p.value
                      ? 'bg-admin-accent text-admin-accent-contrast shadow-sm'
                      : 'text-admin-muted hover:text-admin-text hover:bg-admin-raised',
                  )}
                >{p.label}</button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Exportar CSV"
              onClick={() => exportCampaignsCsv(campaigns as MarketingCampaignRow[])}
              className="px-3 py-1.5 text-xs rounded-lg border border-admin-line bg-admin-surface text-admin-muted hover:text-admin-text hover:bg-admin-raised motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg"
            >Exportar CSV</button>
          </>
        }
      />

      <p className="text-[10px] text-admin-muted inline-flex items-center gap-1.5 max-w-md">
        <Info className="h-3.5 w-3.5 shrink-0 text-admin-info" aria-hidden />
        UTM capturado a partir de quando a captura foi ativada
      </p>

      {/* KPIs */}
      <AdminPanel className="p-3 sm:p-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Novos usuários" value={kpis ? formatInt(kpis.new_users) : '—'}
          delta={delta} deltaLabel="vs mês ant." isLoading={kLoading}
        />
        <AdminStatCard
          label="Conv. landing→cadastro" value={kpis ? `${kpis.landing_to_signup_pct}%` : '—'}
          isLoading={kLoading}
        />
        <AdminStatCard
          label="Campanhas ativas" value={kpis?.active_campaigns ?? '—'}
          isLoading={kLoading}
        />
        <AdminStatCard
          label="Via orgânico" value={kpis ? `${kpis.organic_pct}%` : '—'}
          isLoading={kLoading}
        />
      </div>
      </AdminPanel>

      {/* Source + Medium split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sources */}
        <AdminPanel>
          <p className="text-[11px] font-semibold text-admin-text mb-3">Por UTM Source</p>
          <div className="space-y-2">
            {(sources as MarketingSourceRow[]).map((src, i) => (
              <div key={src.source} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i] ?? adminChartSeriesColors.muted }} />
                <span className="text-[10px] text-admin-muted w-28 truncate">{src.source}</span>
                <div className="flex-1 h-1.5 bg-admin-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${src.conv_rate}%`, background: SOURCE_COLORS[i] ?? adminChartSeriesColors.muted }} />
                </div>
                <span className="text-[10px] text-admin-muted w-10 text-right">
                  {formatInt(src.user_count)}
                </span>
                <span className={cn('text-[10px] font-semibold w-10 text-right', convColor(src.conv_rate))}>
                  {src.conv_rate}%
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>

        {/* Mediums */}
        <AdminPanel>
          <p className="text-[11px] font-semibold text-admin-text mb-3">Por UTM Medium</p>
          <div className="space-y-2">
            {(mediums as MarketingMediumRow[]).map((med, i) => (
              <div key={med.medium} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i] ?? adminChartSeriesColors.muted }} />
                <span className="text-[10px] text-admin-muted w-28 truncate">{med.medium}</span>
                <div className="flex-1 h-1.5 bg-admin-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${med.conv_rate}%`, background: SOURCE_COLORS[i] ?? adminChartSeriesColors.muted }} />
                </div>
                <span className="text-[10px] text-admin-muted w-10 text-right">
                  {formatInt(med.user_count)}
                </span>
                <span className={cn('text-[10px] font-semibold w-10 text-right', convColor(med.conv_rate))}>
                  {med.conv_rate}%
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      {/* Campaigns table */}
      <AdminPanel flush className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-admin-line/80 bg-admin-raised/10">
          <p className="text-micro-label text-admin-muted uppercase">Campanhas (utm_campaign)</p>
        </div>
        <div
          className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
          style={{ gridTemplateColumns: '2fr 100px 70px 70px 70px 80px' }}
        >
          {['Campanha', 'Canal', 'Visitas', 'Cadastros', 'Conv.', '1ª Prova'].map(h => (
            <div key={h} className="px-4 py-2">{h}</div>
          ))}
        </div>
        {(campaigns as MarketingCampaignRow[]).map(row => (
          <div
            key={row.campaign}
            className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 motion-safe:transition-colors items-center"
            style={{ gridTemplateColumns: '2fr 100px 70px 70px 70px 80px' }}
          >
            <div className="px-4 py-2.5 text-xs font-medium text-admin-text truncate">{row.campaign}</div>
            <div className="px-4 py-2.5">
              <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-semibold bg-admin-accent/10 text-admin-accent border border-admin-accent/20">
                {row.source}
              </span>
            </div>
            <div className="px-4 py-2.5 text-[11px] text-admin-muted">{formatInt(row.visits)}</div>
            <div className="px-4 py-2.5 text-[11px] text-admin-text font-semibold">{formatInt(row.signups)}</div>
            <div className={cn('px-4 py-2.5 text-[11px] font-semibold', convColor(row.conv_rate))}>{row.conv_rate.toFixed(1)}%</div>
            <div className="px-4 py-2.5 text-[11px] text-admin-muted">{formatInt(row.first_exams)}</div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <AdminEmptyState title="Nenhuma campanha no período" />
        )}
      </AdminPanel>
    </div>
  )
}

export default function AdminMarketing() {
  return (
    <AdminCapabilityGate capability="intel.view">
      <AdminMarketingContent />
    </AdminCapabilityGate>
  )
}
