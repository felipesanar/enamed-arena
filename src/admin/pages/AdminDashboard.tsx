// src/admin/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'
import {
  useAdminDashboardKpis,
  useAdminEventsTimeseries,
  useAdminSimuladoEngagement,
  useAdminLiveSignals,
} from '@/admin/hooks/useAdminDashboard'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { PERIOD_OPTIONS } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import { cn } from '@/lib/utils'
import type { AdminPeriod, SimuladoEngagementRow, TimeseriesRow } from '@/admin/types'

/** O dashboard só opera com os períodos suportados por AdminPeriod (7/30/90). */
const DASHBOARD_PERIOD_OPTIONS = PERIOD_OPTIONS.filter(
  (opt): opt is (typeof PERIOD_OPTIONS)[number] & { value: AdminPeriod } =>
    opt.value === 7 || opt.value === 30 || opt.value === 90,
)

/** Saudação por horário (pt-BR). */
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Primeiro nome a partir do nome completo / email. */
function firstName(name: string | null | undefined): string {
  if (!name) return ''
  const base = name.includes('@') ? name.split('@')[0] : name
  const first = base.trim().split(/\s+/)[0] ?? ''
  if (!first) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function delta(current: number, prev: number): number {
  return Math.round((current - prev) * 10) / 10
}

/** Percentual pt-BR com vírgula (ex.: 74,1%). */
function formatPct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

/** Variação em pontos percentuais, com sinal e vírgula. */
function formatPpDelta(d: number): string {
  const abs = Math.abs(d).toFixed(1).replace('.', ',')
  if (d > 0) return `+${abs}pp`
  if (d < 0) return `−${abs}pp`
  return abs + 'pp'
}

/** Variação relativa (%) entre dois valores. undefined quando não há base de comparação. */
function relativeDelta(current: number, prev: number): number | undefined {
  if (!prev || prev <= 0) return undefined
  return Math.round(((current - prev) / prev) * 1000) / 10
}

/** Texto da variação relativa, com sinal e vírgula (ex.: +12,4%). */
function formatRelativeDelta(current: number, prev: number): string | undefined {
  const d = relativeDelta(current, prev)
  if (d === undefined) return undefined
  const abs = Math.abs(d).toFixed(1).replace('.', ',')
  if (d > 0) return `+${abs}%`
  if (d < 0) return `−${abs}%`
  return `${abs}%`
}

/** Tempo relativo curto em pt-BR (ex.: 'há 8 min', 'há 2 h'). */
function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (mins < 1) return 'agora há pouco'
  if (mins < 60) return `há ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Rótulo curto do eixo X a partir de 'YYYY-MM-DD'. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso.slice(5)
  return WEEKDAY_LABELS[d.getDay()] ?? iso.slice(5)
}

/* ──────────────────────────────────────────────────────────────────────────
 * KPI card (delta colorido: verde sobe, vermelho desce, cinza estável)
 * ──────────────────────────────────────────────────────────────────────── */

interface KpiProps {
  label: string
  value: string
  delta?: number
  /** Texto do delta já formatado (ex.: '+12,4%', '−2,3pp'). Se ausente, esconde a linha. */
  deltaText?: string
  /** Quando true, delta positivo é ruim (vermelho) e negativo é bom (verde). */
  invert?: boolean
  /** Observação que substitui a linha de delta (ex.: 'sem provas no período'). */
  note?: string
  isLoading?: boolean
}

function KpiCard({ label, value, delta: d, deltaText, invert, note, isLoading }: KpiProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-admin-line/80 bg-admin-surface p-4 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
        <div className="relative mb-3 h-2.5 w-2/3 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
        <div className="relative mb-2.5 h-6 w-1/2 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
        <div className="relative h-2.5 w-1/3 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
      </div>
    )
  }

  const isUp = d !== undefined && d > 0
  const isDown = d !== undefined && d < 0
  const isStable = d !== undefined && d === 0
  const isGood = invert ? isDown : isUp
  const isBad = invert ? isUp : isDown

  return (
    <div
      className={cn(
        'rounded-xl border border-admin-line/80 bg-admin-surface p-4',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/25',
        'transition-[border-color,box-shadow] duration-[160ms] ease-out motion-reduce:transition-none',
        'hover:border-admin-line-strong hover:shadow-[0_4px_16px_rgba(26,23,21,0.06)] dark:hover:shadow-black/40',
      )}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-admin-muted">{label}</p>
      <p className="mb-1.5 text-[1.5625rem] font-extrabold leading-none tabular-nums tracking-tight text-admin-text">
        {value}
      </p>
      {note !== undefined ? (
        <p className="text-[11.5px] font-normal text-admin-faint">{note}</p>
      ) : deltaText !== undefined && !isStable ? (
        <p
          className={cn(
            'flex items-center gap-1 text-[11.5px] font-semibold',
            isGood && 'text-admin-success',
            isBad && 'text-admin-destructive',
            !isGood && !isBad && 'font-normal text-admin-faint',
          )}
        >
          {isUp && <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />}
          {isDown && <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />}
          <span>{deltaText}</span>
        </p>
      ) : (
        <p className="flex items-center gap-1 text-[11.5px] text-admin-faint">
          <Minus className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          estável
        </p>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Bloco "Precisa de atenção"
 * ──────────────────────────────────────────────────────────────────────── */

interface AttentionItem {
  count: number
  text: string
  to: string
  tone: 'warning' | 'info'
}

function AttentionBlock({
  items,
  isLoading,
}: {
  items: AttentionItem[]
  isLoading: boolean
}) {
  return (
    <div className="rounded-xl border border-admin-line/80 border-l-[3px] border-l-admin-warning bg-admin-surface p-4 shadow-sm shadow-black/[0.04] dark:shadow-black/25">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-admin-warning">
        Precisa de atenção
      </p>
      {isLoading ? (
        <div className="flex flex-wrap gap-6">
          {[0, 1].map(i => (
            <div key={i} className="relative h-5 w-52 overflow-hidden rounded bg-admin-raised">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-admin-muted">
          Nada pendente agora. Tudo em dia por aqui.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {items.map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
            >
              <span
                className={cn(
                  'text-[18px] font-extrabold tabular-nums leading-none',
                  item.tone === 'warning' ? 'text-admin-warning' : 'text-admin-info',
                )}
              >
                {item.count}
              </span>
              <span className="text-[12.5px] text-admin-text group-hover:text-admin-accent">
                {item.text}
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-admin-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-admin-accent motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Gráfico de barras "Tentativas por dia"
 * ──────────────────────────────────────────────────────────────────────── */

function AttemptsBarChart({
  data,
  isLoading,
  isError,
  onRetry,
  period,
}: {
  data: TimeseriesRow[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  period: AdminPeriod
}) {
  // Em períodos longos, mostra os últimos 14 dias para o gráfico não ficar ilegível.
  const visible = period > 14 ? data.slice(-14) : data
  const max = Math.max(1, ...visible.map(d => d.exams_started))
  const lastIndex = visible.length - 1

  return (
    <div className="rounded-xl border border-admin-line/80 bg-admin-surface p-[18px] shadow-sm shadow-black/[0.04] dark:shadow-black/25">
      <p className="text-[13px] font-bold text-admin-text">Tentativas por dia</p>
      <p className="mb-4 text-[11.5px] text-admin-muted">últimos {period} dias</p>

      {isError ? (
        <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-[12.5px] text-admin-destructive">Não deu para carregar o gráfico.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-[12px] font-semibold text-admin-accent underline-offset-2 hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex h-[130px] items-end gap-3 border-b border-admin-line-subtle pb-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="relative flex-1 overflow-hidden rounded-t-md bg-admin-raised" style={{ height: `${40 + ((i * 13) % 50)}%` }}>
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <AdminEmptyState
          eyebrow="Sem dados"
          title="Nenhuma tentativa no período"
          description="Quando os alunos começarem provas, elas aparecem aqui por dia."
          className="py-8"
        />
      ) : (
        <>
          <div className="flex h-[130px] items-end gap-3 border-b border-admin-line-subtle pb-1.5">
            {visible.map((d, i) => {
              const pct = Math.round((d.exams_started / max) * 100)
              const isToday = i === lastIndex
              return (
                <div key={d.day} className="group relative flex flex-1 flex-col items-center">
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-[height] duration-300 ease-out motion-reduce:transition-none',
                      // accent com alpha tem contraste em ambos os temas (accent-soft sumia no dark).
                      isToday ? 'bg-admin-accent' : 'bg-admin-accent/45',
                    )}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-[#1A1715] px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
                  >
                    {formatInt(d.exams_started)} tentativas
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10.5px] text-admin-faint">
            {visible.map(d => (
              <span key={d.day} className="flex-1 text-center">
                {dayLabel(d.day)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Painel "Agora" (fundo escuro, tempo real)
 * ──────────────────────────────────────────────────────────────────────── */

function NowPanel({
  liveCount,
  onlineCount,
  activeToday,
  lastActivityAt,
  topSimulados,
  isLoading,
  isError,
  onRetry,
}: {
  liveCount: number
  onlineCount: number
  activeToday: number
  lastActivityAt: string | null
  topSimulados: SimuladoEngagementRow[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col rounded-xl bg-[#1A1715] p-[18px] text-[#ECEDEE] shadow-sm shadow-black/30">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-[7px] w-[7px]">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#34D399]" />
        </span>
        <span className="text-[12px] font-semibold">Agora</span>
      </div>

      {isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <AlertCircle className="h-5 w-5 text-[#9BA1A9]" aria-hidden />
          <p className="text-[12px] text-[#9BA1A9]">Tempo real indisponível.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-[12px] font-semibold text-[#34D399] underline-offset-2 hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : isLoading ? (
        <>
          <div className="mb-1 h-9 w-16 animate-pulse rounded bg-white/10" />
          <div className="mb-5 h-3.5 w-32 animate-pulse rounded bg-white/10" />
          <div className="space-y-2.5">
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          </div>
        </>
      ) : (
        <>
          <div className="mb-1 text-[34px] font-extrabold leading-none tabular-nums tracking-tight">
            {formatInt(liveCount)}
          </div>
          <div className="mb-5 text-[12px] text-[#9BA1A9]">
            {liveCount === 1 ? 'pessoa fazendo prova' : 'pessoas fazendo prova'}
          </div>

          {liveCount === 0 ? (
            <div className="text-[12px] leading-relaxed text-[#9BA1A9]">
              <p className="mb-2.5">Ninguém em prova neste momento.</p>
              <div className="flex flex-col gap-1 text-[11.5px]">
                <span>
                  <b className="font-semibold tabular-nums text-[#ECEDEE]">{formatInt(onlineCount)}</b>{' '}
                  {onlineCount === 1 ? 'ativo' : 'ativos'} nos últimos 15 min
                </span>
                <span>
                  <b className="font-semibold tabular-nums text-[#ECEDEE]">{formatInt(activeToday)}</b>{' '}
                  {activeToday === 1 ? 'ativo' : 'ativos'} hoje
                </span>
                {lastActivityAt && <span>última atividade {timeAgo(lastActivityAt)}</span>}
              </div>
              <p className="mt-3 text-[10px] leading-snug text-[#9BA1A9]/70">
                Presença aproximada por atividade recente (sem rastreio em tempo real).
              </p>
            </div>
          ) : (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9BA1A9]">
                Simulados mais movimentados
              </div>
              <div className="flex flex-col gap-2.5">
                {topSimulados.length === 0 ? (
                  <p className="text-[12px] text-[#9BA1A9]">
                    {formatInt(onlineCount)} online nos últimos 15 minutos.
                  </p>
                ) : (
                  topSimulados.map(s => (
                    <div key={s.simulado_id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-[12px] text-[#9BA1A9]">{s.title}</span>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">
                        {formatInt(s.participants)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-4 text-[10px] leading-snug text-[#9BA1A9]/70">
                Movimento por simulado é estimado pela participação recente.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Página
 * ──────────────────────────────────────────────────────────────────────── */

function AdminDashboardContent() {
  const { period, setPeriod } = useAdminPeriod()
  const { user } = useAdminAuth()

  const kpis = useAdminDashboardKpis(period)
  const timeseries = useAdminEventsTimeseries(period)
  const engagement = useAdminSimuladoEngagement(8)
  const live = useAdminLiveSignals()

  const k = kpis.data
  const name = firstName(user?.user_metadata?.full_name ?? user?.email)

  // "Precisa de atenção": derivado dos dados que temos sem inventar status.
  // Simulados com abandono alto ou conclusão muito baixa são acionáveis hoje.
  const attentionItems: AttentionItem[] = (() => {
    const rows = engagement.data ?? []
    const items: AttentionItem[] = []

    const highAbandon = rows.filter(r => r.participants > 0 && r.abandonment_rate >= 40)
    if (highAbandon.length > 0) {
      items.push({
        count: highAbandon.length,
        text:
          highAbandon.length === 1
            ? 'simulado com muita gente desistindo no meio'
            : 'simulados com muita gente desistindo no meio',
        to: '/admin/simulados',
        tone: 'warning',
      })
    }

    const lowCompletion = rows.filter(r => r.participants >= 5 && r.completion_rate < 30)
    if (lowCompletion.length > 0) {
      items.push({
        count: lowCompletion.length,
        text:
          lowCompletion.length === 1
            ? 'simulado com conclusão abaixo de 30%'
            : 'simulados com conclusão abaixo de 30%',
        to: '/admin/simulados',
        tone: 'info',
      })
    }

    return items
  })()

  return (
    <div className="max-w-[1400px] space-y-5">
      {/* Cabeçalho: saudação + seletor de período */}
      <AdminPageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle={`Veja o que precisa de atenção e o resumo dos últimos ${period} dias.`}
        actions={
          <div
            role="group"
            aria-label="Período"
            className="inline-flex items-center gap-1 rounded-xl border border-admin-line/80 bg-admin-surface p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20"
          >
            {DASHBOARD_PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={period === opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium motion-safe:transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg',
                  period === opt.value
                    ? 'bg-admin-accent text-admin-accent-contrast shadow-sm'
                    : 'text-admin-muted hover:bg-admin-raised hover:text-admin-text',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Precisa de atenção */}
      <AttentionBlock items={attentionItems} isLoading={engagement.isLoading} />

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`Tentativas (${period}d)`}
          value={k ? formatInt(k.exams_started) : '—'}
          delta={k ? delta(k.exams_started, k.exams_started_prev) : undefined}
          deltaText={k ? formatRelativeDelta(k.exams_started, k.exams_started_prev) : undefined}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Taxa de conclusão"
          value={k ? (k.completion_valid_denom > 0 ? formatPct(k.completion_rate) : '—') : '—'}
          delta={k && k.completion_valid_denom > 0 ? delta(k.completion_rate, k.completion_rate_prev) : undefined}
          deltaText={k && k.completion_valid_denom > 0 ? formatPpDelta(delta(k.completion_rate, k.completion_rate_prev)) : undefined}
          note={k && k.completion_valid_denom === 0 ? 'sem provas oficiais no período' : undefined}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Nota média"
          value={k ? formatPct(k.avg_score) : '—'}
          delta={k ? delta(k.avg_score, k.avg_score_prev) : undefined}
          deltaText={k ? formatPpDelta(delta(k.avg_score, k.avg_score_prev)) : undefined}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Novos alunos"
          value={k ? formatInt(k.new_users) : '—'}
          delta={k ? delta(k.new_users, k.new_users_prev) : undefined}
          deltaText={k ? formatRelativeDelta(k.new_users, k.new_users_prev) : undefined}
          isLoading={kpis.isLoading}
        />
      </div>

      {kpis.isError && (
        <p className="text-xs text-admin-destructive">
          Não deu para carregar os indicadores.{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => kpis.refetch()}
          >
            Tentar de novo
          </button>
        </p>
      )}

      {/* Gráfico + painel Agora */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.7fr_1fr]">
        <AttemptsBarChart
          data={timeseries.data ?? []}
          isLoading={timeseries.isLoading}
          isError={timeseries.isError}
          onRetry={() => timeseries.refetch()}
          period={period}
        />
        <NowPanel
          liveCount={live.data?.active_exams ?? 0}
          onlineCount={live.data?.online_last_15min ?? 0}
          activeToday={live.data?.active_today ?? 0}
          lastActivityAt={live.data?.last_activity_at ?? null}
          topSimulados={(engagement.data ?? []).filter(s => s.participants > 0).slice(0, 4)}
          isLoading={live.isLoading}
          isError={live.isError}
          onRetry={() => live.refetch()}
        />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  return (
    <AdminCapabilityGate capability="dashboard.view">
      <AdminDashboardContent />
    </AdminCapabilityGate>
  )
}
