import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import {
  useAdminMarketingKpis,
  useAdminMarketingSources,
  useAdminMarketingMediums,
  useAdminMarketingCampaigns,
} from '@/admin/hooks/useAdminMarketing'
import type { MarketingSourceRow, MarketingMediumRow, MarketingCampaignRow } from '@/admin/types'

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

/** Paleta legível em claro/escuro (tokens semânticos + primary) */
const SOURCE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(280 55% 55%)',
  'hsl(24 90% 55%)',
  'hsl(190 70% 45%)',
  'hsl(var(--muted-foreground))',
]

function convColor(pct: number) {
  if (pct >= 40) return 'text-success'
  if (pct >= 20) return 'text-warning'
  return 'text-destructive'
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

export default function AdminMarketing() {
  const [days, setDays] = useState(30)

  const { data: kpis, isLoading: kLoading } = useAdminMarketingKpis(days)
  const { data: sources = [] } = useAdminMarketingSources(days)
  const { data: mediums = [] } = useAdminMarketingMediums(days)
  const { data: campaigns = [] } = useAdminMarketingCampaigns(days)

  const delta = kpis ? kpis.new_users - kpis.new_users_prev : undefined

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-heading-1 text-foreground">Marketing — Aquisição</h1>
        <p className="text-caption text-muted-foreground">UTM source, medium e campanhas</p>
      </div>

      {/* Period pills */}
      <div className="flex items-center gap-2">
        {PERIODS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => setDays(p.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              days === p.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
            )}
          >{p.label}</button>
        ))}
        <span className="ml-3 text-[10px] text-muted-foreground inline-flex items-center gap-1.5 max-w-md">
          <Info className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
          UTM capturado a partir de quando a captura foi ativada
        </span>
      </div>

      {/* KPIs */}
      <AdminPanel className="p-3 sm:p-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Novos usuários" value={kpis?.new_users.toLocaleString('pt-BR') ?? '—'}
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
          <p className="text-[11px] font-semibold text-foreground mb-3">Por UTM Source</p>
          <div className="space-y-2">
            {(sources as MarketingSourceRow[]).map((src, i) => (
              <div key={src.source} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i] ?? '#6b7280' }} />
                <span className="text-[10px] text-muted-foreground w-28 truncate">{src.source}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${src.conv_rate}%`, background: SOURCE_COLORS[i] ?? '#6b7280' }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {src.user_count.toLocaleString('pt-BR')}
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
          <p className="text-[11px] font-semibold text-foreground mb-3">Por UTM Medium</p>
          <div className="space-y-2">
            {(mediums as MarketingMediumRow[]).map((med, i) => (
              <div key={med.medium} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i] ?? '#6b7280' }} />
                <span className="text-[10px] text-muted-foreground w-28 truncate">{med.medium}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${med.conv_rate}%`, background: SOURCE_COLORS[i] ?? '#6b7280' }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {med.user_count.toLocaleString('pt-BR')}
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/10">
          <p className="text-micro-label text-muted-foreground uppercase">Campanhas (utm_campaign)</p>
          <button
            type="button"
            aria-label="Exportar CSV"
            onClick={() => exportCampaignsCsv(campaigns as MarketingCampaignRow[])}
            className="px-3 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >Exportar CSV</button>
        </div>
        <div
          className="grid text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide border-b border-border"
          style={{ gridTemplateColumns: '2fr 100px 70px 70px 70px 80px' }}
        >
          {['Campanha', 'Canal', 'Visitas', 'Cadastros', 'Conv.', '1ª Prova'].map(h => (
            <div key={h} className="px-4 py-2">{h}</div>
          ))}
        </div>
        {(campaigns as MarketingCampaignRow[]).map(row => (
          <div
            key={row.campaign}
            className="grid border-b border-border/40 last:border-0 hover:bg-muted/30 motion-safe:transition-colors items-center"
            style={{ gridTemplateColumns: '2fr 100px 70px 70px 70px 80px' }}
          >
            <div className="px-4 py-2.5 text-xs font-medium text-foreground truncate">{row.campaign}</div>
            <div className="px-4 py-2.5">
              <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                {row.source}
              </span>
            </div>
            <div className="px-4 py-2.5 text-[11px] text-muted-foreground">{row.visits.toLocaleString('pt-BR')}</div>
            <div className="px-4 py-2.5 text-[11px] text-foreground font-semibold">{row.signups.toLocaleString('pt-BR')}</div>
            <div className={cn('px-4 py-2.5 text-[11px] font-semibold', convColor(row.conv_rate))}>{row.conv_rate.toFixed(1)}%</div>
            <div className="px-4 py-2.5 text-[11px] text-muted-foreground">{row.first_exams.toLocaleString('pt-BR')}</div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma campanha no período.</div>
        )}
      </AdminPanel>
    </div>
  )
}
