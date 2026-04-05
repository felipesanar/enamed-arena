import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  useAdminProdutoSegmentedFunnel,
  useAdminProdutoFriction,
  useAdminProdutoFeatureAdoption,
  useAdminProdutoTopEvents,
} from '@/admin/hooks/useAdminProduto'
import type { SegmentedFunnelRow, FrictionPoint, FeatureAdoptionRow, TopEventRow } from '@/admin/types'

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  { label: 'Guest', value: 'guest' },
  { label: 'Standard', value: 'standard' },
  { label: 'Pro', value: 'pro' },
]

function pctColor(pct: number) {
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function formatMetric(value: number, unit: FrictionPoint['metric_unit']) {
  if (unit === 'percent') return `${value}%`
  if (unit === 'days') return `${value} dias`
  return `${value} min`
}

function severityClass(severity: FrictionPoint['severity']) {
  if (severity === 'critical') return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (severity === 'warning') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
}

function severityLabel(severity: FrictionPoint['severity']) {
  if (severity === 'critical') return 'Crítico'
  if (severity === 'warning') return 'Atenção'
  return 'Saudável'
}

export default function AdminProduto() {
  const [days, setDays] = useState(30)
  const [segment, setSegment] = useState('all')

  const { data: funnel = [] } = useAdminProdutoSegmentedFunnel(days)
  const { data: friction = [] } = useAdminProdutoFriction(days, segment)
  const { data: adoption = [] } = useAdminProdutoFeatureAdoption(days, segment)
  const { data: topEvents = [] } = useAdminProdutoTopEvents(days)

  const maxAdoption = Math.max(...(adoption as FeatureAdoptionRow[]).map(r => r.adoption_pct), 1)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-heading-1 text-foreground">Produto — Análise de Uso</h1>
        <p className="text-caption text-muted-foreground">Funil segmentado, pontos de fricção e adoção de features</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period pills */}
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              aria-label={p.label}
              onClick={() => setDays(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                days === p.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
              )}
            >{p.label}</button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Segment pills */}
        <div className="flex items-center gap-2">
          {SEGMENTS.map(s => (
            <button
              key={s.value}
              aria-label={s.label}
              onClick={() => setSegment(s.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                segment === s.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted',
              )}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Section 1: Segmented Funnel */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Funil Segmentado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Etapa</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Guest</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Standard</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(funnel as SegmentedFunnelRow[]).map(row => (
                <tr key={row.step_order} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.step_label}</td>
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
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
          )}
        </div>
      </div>

      {/* Section 2: Friction Map */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide mb-3">Mapa de Fricção</p>
        <div className="grid grid-cols-3 gap-3">
          {(friction as FrictionPoint[]).map(point => (
            <div
              key={point.key}
              className="bg-card rounded-lg border border-border p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-foreground leading-snug">{point.title}</p>
                <span className={cn(
                  'shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide',
                  severityClass(point.severity),
                )}>
                  {severityLabel(point.severity)}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatMetric(point.metric_value, point.metric_unit)}
              </p>
            </div>
          ))}
          {friction.length === 0 && (
            <div className="col-span-3 px-4 py-8 text-center text-sm text-muted-foreground bg-card rounded-lg border border-border">
              Sem dados no período.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Feature Adoption */}
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide mb-4">Adoção de Features</p>
        <div className="space-y-3">
          {(adoption as FeatureAdoptionRow[]).map(row => (
            <div key={row.event_name} className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground w-36 truncate shrink-0">{row.feature}</span>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(row.adoption_pct / maxAdoption) * 100}%` }}
                />
              </div>
              <span className={cn('text-[11px] font-semibold w-10 text-right', pctColor(row.adoption_pct))}>
                {row.adoption_pct}%
              </span>
            </div>
          ))}
          {adoption.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">Sem dados no período.</div>
          )}
        </div>
      </div>

      {/* Section 4: Top Events */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Top Eventos</p>
        </div>
        <div className="divide-y divide-border/40">
          {(topEvents as TopEventRow[]).map((ev, idx) => (
            <div key={ev.event_name} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground/40 w-4">{idx + 1}</span>
                <span className="text-xs font-mono text-foreground">{ev.event_name}</span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {ev.cnt.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
          {topEvents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
          )}
        </div>
      </div>
    </div>
  )
}
