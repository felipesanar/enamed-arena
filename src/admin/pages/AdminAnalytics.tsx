import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
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

/** Opacidade decrescente do vinho ao longo do funil (forte no topo, claro no fim). */
function funnelToneOpacity(index: number, total: number): number {
  if (total <= 1) return 1
  const min = 0.3
  return Math.round((1 - (index / (total - 1)) * (1 - min)) * 100) / 100
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

function AdminAnalyticsContent() {
  const [days, setDays] = useState(30)

  const { data: funnel = [], isLoading: fLoading } = useAdminAnalyticsFunnel(days)
  const { data: timeseries = [], isLoading: tLoading } = useAdminAnalyticsTimeseries(days * 2)
  const { data: sources = [] } = useAdminAnalyticsSources(days)
  const { data: ttc } = useAdminAnalyticsTimeToConvert(days)

  const funnelSteps = funnel as FunnelStep[]
  const maxCount = funnelSteps[0]?.user_count ?? 1

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PanelQuestion
          eyebrow="Jornada"
          question="Onde as pessoas param no caminho?"
          helper="Do cadastro até a prova concluída. A maior queda mostra onde a operação perde gente."
        />
        <div className="flex shrink-0 items-center gap-1.5 bg-admin-surface border border-admin-line/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
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
      </div>

      {/* Funil: barras decrescentes em tons de vinho (forte no topo, mais claro no fim). */}
      <AdminPanel flush className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-admin-line/80 bg-admin-raised/10">
          <p className="text-micro-label text-admin-muted uppercase">Do cadastro até concluir a prova</p>
        </div>
        {fLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="relative h-10 overflow-hidden rounded bg-admin-raised">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/60 to-transparent" />
              </div>
            ))}
          </div>
        ) : funnelSteps.length === 0 ? (
          <AdminEmptyState
            title="Sem dados de jornada no período"
            description="Quando houver cadastros e provas neste intervalo, o funil aparece aqui."
          />
        ) : (
          <div className="divide-y divide-admin-line/40">
            {funnelSteps.map((step, idx) => (
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
                          <span className="text-[10px] font-semibold text-admin-muted">
                            sem rastreio nesta etapa
                          </span>
                        ) : (
                          <span className={cn('text-[10px] font-semibold', convColor(step.conversion_from_prev))}>
                            {step.conversion_from_prev}% de quem chegou na etapa anterior
                            {step.insufficient_data && (
                              <span className="ml-1 font-normal text-admin-faint">(base baixa)</span>
                            )}
                          </span>
                        )
                      )}
                      <span className="text-sm font-bold text-admin-text w-16 text-right tabular-nums">
                        {formatInt(step.user_count)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-admin-raised rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(step.user_count / maxCount) * 100}%`,
                        backgroundColor: `hsl(var(--admin-accent) / ${funnelToneOpacity(idx, funnelSteps.length)})`,
                      }}
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
        title="Novos usuários vs. 1ª prova por semana"
        data={timeseries}
        xKey="week_start"
        bars={[
          { key: 'new_users',   color: adminChartSeriesColors.primary, label: 'Cadastros' },
          { key: 'first_exams', color: adminChartSeriesColors.success, label: '1ª prova' },
        ]}
        height={140}
        isLoading={tLoading}
      />
      </AdminPanel>

      {/* Sources + TTC */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sources */}
        <AdminPanel>
          <p className="text-[11px] font-semibold text-admin-text mb-3">Origem dos usuários</p>
          <div className="space-y-2">
            {(sources as JourneySourceRow[]).map(src => (
              <div key={src.utm_source} className="flex items-center gap-2">
                <span className="text-[10px] text-admin-muted w-24 truncate">{src.utm_source}</span>
                <div className="flex-1 h-1.5 bg-admin-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-admin-accent/70 rounded-full"
                    style={{ width: `${src.signup_conv_pct == null || Number.isNaN(src.signup_conv_pct) ? 0 : Math.min(100, Math.max(0, src.signup_conv_pct * 1.5))}%` }}
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
              {(() => {
                const t = ttc as JourneyTimeToConvert
                const landingInsufficient = t.landing_to_signup_insufficient || t.landing_to_signup_min < 0
                const secondExamInsufficient = t.first_to_second_exam_n <= 0
                // [label, value, ok|null]; ok=null → estado neutro "dados insuficientes"
                const rows: [string, string, boolean | null][] = [
                  ['Visita → Cadastro',     landingInsufficient ? 'Dados insuficientes' : `${t.landing_to_signup_min} min`,   landingInsufficient ? null : t.landing_to_signup_min < 60],
                  ['Cadastro → Onboarding', `${t.signup_to_onboarding_min} min`,                                              t.signup_to_onboarding_min < 60],
                  ['Onboarding → 1ª prova', `${t.onboarding_to_first_exam_days} dias`,                                        t.onboarding_to_first_exam_days < 2],
                  ['1ª prova → 2ª prova (p90)', secondExamInsufficient ? 'Dados insuficientes' : `${t.first_to_second_exam_days_p90} dias`, secondExamInsufficient ? null : t.first_to_second_exam_days_p90 < 7],
                ]
                return rows.map(([label, value, ok]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] text-admin-muted">{label}</span>
                    <span className={cn(
                      'text-xs font-semibold',
                      ok == null ? 'text-admin-faint' : ok ? 'text-admin-success' : 'text-admin-warning',
                    )}>
                      {value}
                    </span>
                  </div>
                ))
              })()}
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
