import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import {
  useAdminAnalyticsFunnel,
  useAdminAnalyticsTimeseries,
  useAdminAnalyticsSources,
  useAdminAnalyticsTimeToConvert,
} from '@/admin/hooks/useAdminAnalytics'
import type { FunnelStep, JourneySourceRow, JourneyTimeToConvert } from '@/admin/types'

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

function convColor(pct: number) {
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30)

  const { data: funnel = [], isLoading: fLoading } = useAdminAnalyticsFunnel(days)
  const { data: timeseries = [], isLoading: tLoading } = useAdminAnalyticsTimeseries(days * 2)
  const { data: sources = [] } = useAdminAnalyticsSources(days)
  const { data: ttc } = useAdminAnalyticsTimeToConvert(days)

  const maxCount = funnel[0]?.user_count ?? 1

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-heading-1 text-foreground">Analytics — Jornada do Usuário</h1>
        <p className="text-caption text-muted-foreground">Funil de conversão sequencial e origens de aquisição</p>
      </div>

      {/* Period pills */}
      <div className="flex gap-2">
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

      {/* Funnel steps */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Funil de Conversão</p>
        </div>
        {fLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {(funnel as FunnelStep[]).map((step, idx) => (
              <div key={step.step_order} className="flex items-center gap-4 px-4 py-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {step.step_order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{step.step_label}</span>
                    <div className="flex items-center gap-3">
                      {idx > 0 && (
                        <span className={cn('text-[10px] font-semibold', convColor(step.conversion_from_prev))}>
                          {step.conversion_from_prev}%
                        </span>
                      )}
                      <span className="text-sm font-bold text-foreground w-16 text-right">
                        {step.user_count.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(step.user_count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly chart */}
      <AdminTrendChart
        title="Novos usuários vs. 1ª prova por semana"
        data={timeseries}
        xKey="week_start"
        bars={[
          { key: 'new_users',   color: 'hsl(var(--primary))', label: 'Cadastros' },
          { key: 'first_exams', color: '#34d399',             label: '1ª prova' },
        ]}
        height={140}
        isLoading={tLoading}
      />

      {/* Sources + TTC */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sources */}
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[11px] font-semibold text-foreground mb-3">Origem dos Usuários (UTM Source)</p>
          <div className="space-y-2">
            {(sources as JourneySourceRow[]).map(src => (
              <div key={src.utm_source} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24 truncate">{src.utm_source}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full"
                    style={{ width: `${Math.min(100, src.signup_conv_pct * 1.5)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground w-12 text-right">
                  {src.user_count.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Time to convert */}
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-[11px] font-semibold text-foreground mb-3">Tempo médio por etapa</p>
          {ttc ? (
            <div className="space-y-3">
              {([
                ['Landing → Cadastro',   `${(ttc as JourneyTimeToConvert).landing_to_signup_min} min`,             (ttc as JourneyTimeToConvert).landing_to_signup_min < 60],
                ['Cadastro → Onboarding', `${(ttc as JourneyTimeToConvert).signup_to_onboarding_min} min`,         (ttc as JourneyTimeToConvert).signup_to_onboarding_min < 60],
                ['Onboarding → 1ª prova', `${(ttc as JourneyTimeToConvert).onboarding_to_first_exam_days} dias`,   (ttc as JourneyTimeToConvert).onboarding_to_first_exam_days < 2],
                ['1ª prova → 2ª prova',   `${(ttc as JourneyTimeToConvert).first_to_second_exam_days} dias`,       (ttc as JourneyTimeToConvert).first_to_second_exam_days < 7],
              ] as [string, string, boolean][]).map(([label, value, ok]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <span className={cn('text-xs font-semibold', ok ? 'text-emerald-400' : 'text-yellow-400')}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-pulse space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
