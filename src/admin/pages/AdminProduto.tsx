import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { PERIOD_OPTIONS, SEGMENT_META } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import {
  useAdminProdutoSegmentedFunnel,
  useAdminProdutoFriction,
  useAdminProdutoFeatureAdoption,
  useAdminProdutoTopEvents,
  useAdminProdutoCadernoFunnel,
} from '@/admin/hooks/useAdminProduto'
import type { SegmentedFunnelRow, FrictionPoint, FeatureAdoptionRow, TopEventRow, CadernoFunnelRow } from '@/admin/types'

/** Mantém os mesmos períodos exibidos antes da centralização (7/30/90). */
const PERIODS = PERIOD_OPTIONS.filter(opt => opt.value !== 14)

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  ...(['guest', 'standard', 'pro'] as const).map(value => ({
    label: SEGMENT_META[value].label,
    value,
  })),
]

function pctColor(pct: number) {
  if (pct >= 70) return 'text-admin-success'
  if (pct >= 40) return 'text-admin-warning'
  return 'text-admin-destructive'
}

function formatMetric(value: number, unit: FrictionPoint['metric_unit'], insufficient?: boolean) {
  if (insufficient || value < 0) return 'Dados insuficientes'
  if (unit === 'percent') return `${value}%`
  if (unit === 'days') return `${value} dias`
  return `${value} min`
}

function severityClass(severity: FrictionPoint['severity']) {
  if (severity === 'critical') return 'bg-admin-destructive/15 text-admin-destructive border-admin-destructive/30'
  if (severity === 'warning') return 'bg-admin-warning/15 text-admin-warning border-admin-warning/30'
  return 'bg-admin-success/15 text-admin-success border-admin-success/30'
}

function severityLabel(severity: FrictionPoint['severity']) {
  if (severity === 'critical') return 'Crítico'
  if (severity === 'warning') return 'Atenção'
  return 'Saudável'
}

function AdminProdutoContent() {
  const [days, setDays] = useState(30)
  const [segment, setSegment] = useState('all')

  const { data: funnel = [] } = useAdminProdutoSegmentedFunnel(days)
  const { data: friction = [] } = useAdminProdutoFriction(days, segment)
  const { data: adoption = [] } = useAdminProdutoFeatureAdoption(days, segment)
  const { data: topEvents = [] } = useAdminProdutoTopEvents(days)
  const { data: caderno = [] } = useAdminProdutoCadernoFunnel(days, segment)

  const maxAdoption = Math.max(...(adoption as FeatureAdoptionRow[]).map(r => r.adoption_pct), 1)

  // Caderno de Erros derived metrics
  const cadernoRows = caderno as CadernoFunnelRow[]
  const cadernoBy = (key: string) => cadernoRows.find(r => r.metric_key === key)
  const triageViewed = cadernoBy('triage_viewed')
  const triageAdded = cadernoBy('triage_batch_added')
  const reminderSent = cadernoBy('reminder_sent')
  const reminderOpened = cadernoBy('reminder_opened')
  // Activation conversion: triagem vista → lote adicionado (unique users)
  const triageConvRate = triageViewed && triageViewed.unique_users > 0
    ? Math.round((triageAdded?.unique_users ?? 0) / triageViewed.unique_users * 1000) / 10
    : 0
  // Loop: lembrete enviado → aberto (open rate)
  const reminderOpenRate = reminderSent && reminderSent.total_events > 0
    ? Math.round((reminderOpened?.total_events ?? 0) / reminderSent.total_events * 1000) / 10
    : 0
  const cadernoTotal = cadernoRows.reduce((acc, r) => acc + r.total_events, 0)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <AdminPageHeader
        title="Produto"
        subtitle="Funil segmentado, pontos de fricção e adoção de features"
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
            <div className="w-px h-5 bg-admin-line" />
            <div className="flex items-center gap-1.5 bg-admin-surface border border-admin-line/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
              {SEGMENTS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  aria-label={s.label}
                  onClick={() => setSegment(s.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium motion-safe:transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg',
                    segment === s.value
                      ? 'bg-admin-accent text-admin-accent-contrast shadow-sm'
                      : 'text-admin-muted hover:text-admin-text hover:bg-admin-raised',
                  )}
                >{s.label}</button>
              ))}
            </div>
          </>
        }
      />

      {/* Section 1: Segmented Funnel */}
      <AdminPanel flush className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-admin-line/80 bg-admin-raised/10">
          <p className="text-micro-label text-admin-muted uppercase">Funil Segmentado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-admin-line bg-admin-raised/30">
                <th className="px-4 py-2 text-left text-[10px] font-bold text-admin-faint uppercase tracking-wide">Etapa</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-admin-faint uppercase tracking-wide">Guest</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-admin-faint uppercase tracking-wide">Standard</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-admin-faint uppercase tracking-wide">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line/40">
              {(funnel as SegmentedFunnelRow[]).map(row => (
                <tr key={row.step_order} className="hover:bg-admin-raised/20 motion-safe:transition-colors">
                  <td className="px-4 py-2.5 font-medium text-admin-text">{row.step_label}{row.insufficient_data && (<span className="ml-2 text-[9px] font-normal text-admin-muted align-middle">dados insuficientes</span>)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('font-semibold text-[11px]', pctColor(row.guest_pct))}>
                      {row.guest_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('font-semibold text-[11px]', pctColor(row.standard_pct))}>
                      {row.standard_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('font-semibold text-[11px]', pctColor(row.pro_pct))}>
                      {row.pro_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {funnel.length === 0 && (
            <AdminEmptyState title="Sem dados no período" />
          )}
        </div>
      </AdminPanel>

      {/* Section 2: Friction Map */}
      <div>
        <p className="text-micro-label text-admin-muted uppercase mb-3">Mapa de Fricção</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(friction as FrictionPoint[]).map(point => (
            <AdminPanel key={point.key} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-admin-text leading-snug">{point.title}</p>
                <span className={cn(
                  'shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide',
                  severityClass(point.severity),
                )}>
                  {severityLabel(point.severity)}
                </span>
              </div>
              <p className="text-2xl font-bold text-admin-text">
                {formatMetric(point.metric_value, point.metric_unit, point.insufficient_data)}
              </p>
              {point.denominator != null && (
                <p className="text-[10px] text-admin-muted">
                  {point.insufficient_data
                    ? `base ínfima (${formatInt(point.numerator ?? 0)}/${formatInt(point.denominator ?? 0)})`
                    : `${formatInt(point.numerator ?? 0)} de ${formatInt(point.denominator ?? 0)}`}
                </p>
              )}
            </AdminPanel>
          ))}
          {friction.length === 0 && (
            <AdminPanel className="col-span-full">
              <AdminEmptyState title="Sem dados no período" />
            </AdminPanel>
          )}
        </div>
      </div>

      {/* Section 3: Feature Adoption */}
      <AdminPanel>
        <p className="text-micro-label text-admin-muted uppercase mb-4">Adoção de Features</p>
        <div className="space-y-3">
          {(adoption as FeatureAdoptionRow[]).map(row => (
            <div key={row.event_name} className="flex items-center gap-3">
              <span className="text-[11px] text-admin-muted w-36 truncate shrink-0">{row.feature}</span>
              <div className="flex-1 h-3 bg-admin-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-admin-accent rounded-full transition-all"
                  style={{ width: `${(row.adoption_pct / maxAdoption) * 100}%` }}
                />
              </div>
              <span className={cn('text-[11px] font-semibold w-10 text-right', pctColor(row.adoption_pct))}>
                {row.adoption_pct}%
              </span>
            </div>
          ))}
          {adoption.length === 0 && (
            <AdminEmptyState title="Sem dados no período" />
          )}
        </div>
      </AdminPanel>

      {/* Section 4: Top Events */}
      <AdminPanel flush className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-admin-line/80 bg-admin-raised/10">
          <p className="text-micro-label text-admin-muted uppercase">Top Eventos</p>
        </div>
        <div className="divide-y divide-admin-line/40">
          {(topEvents as TopEventRow[]).map((ev, idx) => (
            <div key={ev.event_name} className="flex items-center justify-between px-4 py-2.5 hover:bg-admin-raised/20 motion-safe:transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-admin-faint w-4">{idx + 1}</span>
                <span className="text-xs font-mono text-admin-text">{ev.event_name}</span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-admin-accent/10 text-admin-accent border border-admin-accent/20">
                {formatInt(ev.cnt)}
              </span>
            </div>
          ))}
          {topEvents.length === 0 && (
            <AdminEmptyState title="Sem dados no período" />
          )}
        </div>
      </AdminPanel>

      {/* Section 5: Caderno de Erros — Funil & Saúde (cutover) */}
      <div>
        <p className="text-micro-label text-admin-muted uppercase mb-3">Caderno de Erros — Funil &amp; Saúde</p>

        {/* Headline rates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          <AdminPanel className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-admin-text leading-snug">Conversão de triagem</p>
            <p className="text-[10px] text-admin-muted">triagem vista → lote adicionado (usuários)</p>
            <p className={cn('text-2xl font-bold', pctColor(triageConvRate))}>{triageConvRate}%</p>
            <p className="text-[10px] text-admin-muted">
              {formatInt(triageAdded?.unique_users ?? 0)} de {formatInt(triageViewed?.unique_users ?? 0)} usuários
            </p>
          </AdminPanel>
          <AdminPanel className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-admin-text leading-snug">Abertura de lembretes</p>
            <p className="text-[10px] text-admin-muted">enviados → abertos (eventos)</p>
            <p className={cn('text-2xl font-bold', pctColor(reminderOpenRate))}>{reminderOpenRate}%</p>
            <p className="text-[10px] text-admin-muted">
              {formatInt(reminderOpened?.total_events ?? 0)} de {formatInt(reminderSent?.total_events ?? 0)} envios
            </p>
          </AdminPanel>
          <AdminPanel className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-admin-text leading-snug">Eventos do Caderno</p>
            <p className="text-[10px] text-admin-muted">volume total no período</p>
            <p className="text-2xl font-bold text-admin-text">{formatInt(cadernoTotal)}</p>
          </AdminPanel>
        </div>

        {/* Metric breakdown table */}
        <AdminPanel flush className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-admin-line bg-admin-raised/30">
                  <th className="px-4 py-2 text-left text-[10px] font-bold text-admin-faint uppercase tracking-wide">Métrica</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold text-admin-faint uppercase tracking-wide">Evento</th>
                  <th className="px-4 py-2 text-right text-[10px] font-bold text-admin-faint uppercase tracking-wide">Eventos</th>
                  <th className="px-4 py-2 text-right text-[10px] font-bold text-admin-faint uppercase tracking-wide">Usuários</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line/40">
                {cadernoRows.map(row => (
                  <tr key={row.metric_key} className="hover:bg-admin-raised/20 motion-safe:transition-colors">
                    <td className="px-4 py-2.5 font-medium text-admin-text">{row.metric_label}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-admin-muted">{row.event_name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[11px] text-admin-text">
                      {formatInt(row.total_events)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-admin-muted">
                      {formatInt(row.unique_users)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cadernoRows.length === 0 && (
              <AdminEmptyState
                title="Sem dados no período"
                description="Ou a RPC ainda não foi publicada."
              />
            )}
          </div>
        </AdminPanel>
      </div>
    </div>
  )
}

export default function AdminProduto() {
  return (
    <AdminCapabilityGate capability="intel.view">
      <AdminProdutoContent />
    </AdminCapabilityGate>
  )
}
