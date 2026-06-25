import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { adminChartSeriesColors } from '@/admin/lib/adminChartTheme'
import { PERIOD_OPTIONS } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import {
  useAdminAnalyticsFunnel,
  useAdminAnalyticsTimeseries,
  useAdminAnalyticsSources,
  useAdminAnalyticsTimeToConvert,
} from '@/admin/hooks/useAdminAnalytics'
import type { FunnelStep, JourneySourceRow, JourneyTimeToConvert } from '@/admin/types'

/** Mantém os mesmos períodos exibidos antes da centralização (7/30/90). */
const PERIODS = PERIOD_OPTIONS.filter(opt => opt.value !== 14)

function convColor(pct: number) {
  if (pct >= 70) return 'text-admin-success'
  if (pct >= 50) return 'text-admin-warning'
  return 'text-admin-destructive'
}

function AdminAnalyticsContent() {
  const [days, setDays] = useState(30)

  const { data: funnel = [], isLoading: fLoading } = useAdminAnalyticsFunnel(days)
  const { data: timeseries = [], isLoading: tLoading } = useAdminAnalyticsTimeseries(days * 2)
  const { data: sources = [] } = useAdminAnalyticsSources(days)
  const { data: ttc } = useAdminAnalyticsTimeToConvert(days)

  const maxCount = funnel[0]?.user_count ?? 1

  return (
    <div className="space-y-5 max-w-[1400px]">
      <AdminPageHeader
        title="Jornada"
        subtitle="Funil de conversão sequencial e origens de aquisição"
        actions={
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
        }
      />

      {/* Funnel steps */}
      <AdminPanel flush className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-admin-line/80 bg-admin-raised/10">
          <p className="text-micro-label text-admin-muted uppercase">Funil de Conversão</p>
        </div>
        {fLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-admin-raised rounded" />)}
          </div>
        ) : (
          <div className="divide-y divide-admin-line/40">
            {(funnel as FunnelStep[]).map((step, idx) => (
              <div key={step.step_order} className="flex items-center gap-4 px-4 py-3">
                <div className="w-5 h-5 rounded-full bg-admin-accent/10 flex items-center justify-center text-[10px] font-bold text-admin-accent shrink-0">
                  {step.step_order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-admin-text">{step.step_label}</span>
                    <div className="flex items-center gap-3">
                      {idx > 0 && (
                        step.conversion_from_prev == null ? (
                          <span className="text-[10px] font-medium text-admin-muted" title="Conversão não rastreável (sem evento de origem antes do cadastro).">— sem rastreio</span>
                        ) : (
                          <span className={cn('text-[10px] font-semibold', convColor(step.conversion_from_prev))}>
                            {step.conversion_from_prev}%
                            {step.insufficient_data && (<span className="ml-1 text-admin-muted font-normal">·dados insuficientes</span>)}
                          </span>
                        )
                      )}
                      <span className="text-sm font-bold text-admin-text w-16 text-right">
                        {formatInt(step.user_count)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-admin-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-admin-accent rounded-full transition-all"
                      style={{ width: `${(step.user_count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      {/* Weekly chart */}
      <AdminPanel className="p-3 sm:p-4">
      <AdminTrendChart
        embedded
        title="Cadastros vs. 1ª prova válida por semana"
        data={timeseries}
        xKey="week_start"
        bars={[
          { key: 'new_users',        color: adminChartSeriesColors.primary, label: 'Cadastros' },
          { key: 'first_exams',      color: adminChartSeriesColors.success, label: '1ª prova válida' },
          { key: 'started_attempts', color: adminChartSeriesColors.muted,   label: 'Tentativas iniciadas' },
        ]}
        height={140}
        isLoading={tLoading}
      />
      </AdminPanel>

      {/* Sources + TTC */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sources */}
        <AdminPanel>
          <p className="text-[11px] font-semibold text-admin-text mb-3">Origem dos Usuários (UTM Source)</p>
          <div className="space-y-2">
            {(sources as JourneySourceRow[]).map(src => (
              <div key={src.utm_source} className="flex items-center gap-2">
                <span className="text-[10px] text-admin-muted w-24 truncate">{src.utm_source}</span>
                <div className="flex-1 h-1.5 bg-admin-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-admin-accent/70 rounded-full"
                    style={{ width: `${Math.min(100, src.signup_conv_pct * 1.5)}%` }}
                  />
                </div>
                <span className="text-[10px] text-admin-muted w-12 text-right">
                  {formatInt(src.user_count)}
                </span>
              </div>
            ))}
          </div>
        </AdminPanel>

        {/* Time to convert */}
        <AdminPanel>
          <p className="text-[11px] font-semibold text-admin-text mb-3">Tempo médio por etapa</p>
          {ttc ? (
            <div className="space-y-3">
              {([
                ['Landing → Cadastro',   (ttc as JourneyTimeToConvert).landing_to_signup_insufficient ? `Dados insuficientes (N=${(ttc as JourneyTimeToConvert).landing_to_signup_n})` : `${(ttc as JourneyTimeToConvert).landing_to_signup_min} min`,             !(ttc as JourneyTimeToConvert).landing_to_signup_insufficient && (ttc as JourneyTimeToConvert).landing_to_signup_min < 60],
                ['Cadastro → Onboarding', `${(ttc as JourneyTimeToConvert).signup_to_onboarding_min} min`,         (ttc as JourneyTimeToConvert).signup_to_onboarding_min < 60],
                ['Onboarding → 1ª prova válida', `${(ttc as JourneyTimeToConvert).onboarding_to_first_exam_days} dias`,   (ttc as JourneyTimeToConvert).onboarding_to_first_exam_days < 2],
                ['1ª → 2ª prova válida',   `p50 ${(ttc as JourneyTimeToConvert).first_to_second_exam_days}d · p90 ${(ttc as JourneyTimeToConvert).first_to_second_exam_days_p90}d`,       (ttc as JourneyTimeToConvert).first_to_second_exam_days < 7],
              ] as [string, string, boolean][]).map(([label, value, ok]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-admin-muted">{label}</span>
                  <span className={cn('text-xs font-semibold', ok ? 'text-admin-success' : 'text-admin-warning')}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-4 bg-admin-raised rounded" />)}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  )
}

export default function AdminAnalytics() {
  return (
    <AdminCapabilityGate capability="intel.view">
      <AdminAnalyticsContent />
    </AdminCapabilityGate>
  )
}
