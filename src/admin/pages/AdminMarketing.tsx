import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
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

/**
 * Abertura do painel: a pergunta que ele responde, em português direto, para
 * quem chega saber se está na tela certa sem abrir as outras.
 */
function PanelQuestion({
  eyebrow,
  question,
  helper,
}: {
  eyebrow: string
  question: string
  helper: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
        {eyebrow}
      </p>
      <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.025em] text-admin-text">
        {question}
      </h1>
      <p className="mt-1 text-[13px] text-admin-muted">{helper}</p>
    </div>
  )
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

  // Participação de cada origem no total de cadastros (resposta direta da pergunta).
  const sourceRows = sources as MarketingSourceRow[]
  const totalSourceUsers = sourceRows.reduce((acc, s) => acc + s.user_count, 0)
  const originBars = sourceRows
    .slice()
    .sort((a, b) => b.user_count - a.user_count)
    .map(s => ({
      source: s.source,
      user_count: s.user_count,
      share: totalSourceUsers > 0 ? Math.round((s.user_count / totalSourceUsers) * 1000) / 10 : 0,
    }))

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PanelQuestion
          eyebrow="Aquisição"
          question="De onde vêm os novos alunos?"
          helper="A origem dos cadastros no período: canal, meio e campanhas que mais trazem gente."
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-admin-surface border border-admin-line/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
            {PERIODS.map(p => (
              <button
                key={p.value}
                type="button"
                aria-label={p.label}
                aria-pressed={days === p.value}
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
          >Exportar lista</button>
        </div>
      </div>

      <p className="text-[10px] text-admin-muted inline-flex items-center gap-1.5 max-w-md">
        <Info className="h-3.5 w-3.5 shrink-0 text-admin-info" aria-hidden />
        A origem só aparece a partir de quando a captura foi ativada
      </p>

      {/* Resposta direta: participação de cada origem no total de cadastros, em barras horizontais. */}
      <AdminPanel>
        <p className="text-[11px] font-semibold text-admin-text mb-3">Origens por participação nos cadastros</p>
        {originBars.length === 0 ? (
          <AdminEmptyState
            title="Sem origens no período"
            description="Quando houver cadastros com origem capturada neste intervalo, eles aparecem aqui."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {originBars.map(o => (
              <div key={o.source}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-admin-text truncate">{o.source}</span>
                  <span className="text-xs font-semibold tabular-nums text-admin-text">
                    {o.share}%
                    <span className="ml-2 font-normal text-admin-muted">
                      {formatInt(o.user_count)} cadastros
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-admin-raised">
                  <div
                    className="h-full rounded-full bg-admin-accent transition-all"
                    style={{ width: `${o.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      {/* KPIs */}
      <AdminPanel className="p-3 sm:p-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Novos usuários" value={kpis ? formatInt(kpis.new_users) : '—'}
          delta={delta} deltaLabel="vs mês ant." isLoading={kLoading}
        />
        <AdminStatCard
          label="Conversão visita→cadastro" value={kpis ? `${kpis.landing_to_signup_pct}%` : '—'}
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
          <p className="text-[11px] font-semibold text-admin-text mb-3">Por canal</p>
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
          <p className="text-[11px] font-semibold text-admin-text mb-3">Por meio</p>
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
          <p className="text-micro-label text-admin-muted uppercase">Campanhas</p>
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
