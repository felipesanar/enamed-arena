import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminDataTable } from '@/admin/components/ui/AdminDataTable'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminBarList } from '@/admin/components/ui/AdminBarList'
import { AdminCohortMatrix } from '@/admin/components/ui/AdminCohortMatrix'
import { AdminInsightCard } from '@/admin/components/ui/AdminInsightCard'
import { PERIOD_OPTIONS, SEGMENT_META } from '@/admin/lib/constants'
import { formatInt } from '@/admin/lib/format'
import { adminChartSeriesColors } from '@/admin/lib/adminChartTheme'
import {
  useAdminCohortRetention,
  useAdminPerformanceByArea,
  useAdminPerformanceByTheme,
  useAdminScoreDistribution,
  useAdminScoreEvolution,
  useAdminEngagementMetrics,
  useAdminSegmentBreakdown,
  useAdminIntelInsights,
} from '@/admin/hooks/useAdminInteligencia'
import type {
  AreaPerformanceRow,
  ThemePerformanceRow,
  ScoreBucket,
  ScoreEvolutionRow,
  SegmentBreakdownRow,
  CohortRetentionRow,
  IntelInsight,
} from '@/admin/types'

/** Mantém os mesmos períodos exibidos nas demais páginas de inteligência (7/30/90). */
const PERIODS = PERIOD_OPTIONS.filter(opt => opt.value !== 14)

const SEGMENTS = [
  { label: 'Todos', value: 'all' },
  ...(['guest', 'standard', 'pro'] as const).map(value => ({
    label: SEGMENT_META[value].label,
    value,
  })),
]

const TOGGLE_GROUP =
  'flex items-center gap-1.5 bg-admin-surface border border-admin-line/80 rounded-xl p-1 shadow-sm shadow-black/[0.03] dark:shadow-black/20'

function toggleBtn(active: boolean) {
  return cn(
    'px-3 py-1.5 rounded-lg text-xs font-medium motion-safe:transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg',
    active
      ? 'bg-admin-accent text-admin-accent-contrast shadow-sm'
      : 'text-admin-muted hover:text-admin-text hover:bg-admin-raised',
  )
}

const NATIVE_SELECT =
  'h-8 rounded-lg border border-admin-line/80 bg-admin-surface px-2.5 text-xs font-medium text-admin-text shadow-sm shadow-black/[0.03] dark:shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-bg'

const SECTION_LABEL = 'text-micro-label text-admin-muted uppercase mb-3'

function ErrorNote({ message }: { message?: string }) {
  return (
    <p className="text-xs text-admin-destructive">
      {message ?? 'Não foi possível carregar os dados.'}
    </p>
  )
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function AdminInteligenciaContent() {
  const navigate = useNavigate()

  const [days, setDays] = useState(30)
  const [segment, setSegment] = useState('all')
  const [simuladoId, setSimuladoId] = useState<string | null>(null)
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  // ── Data
  const insightsQ = useAdminIntelInsights()
  const areasQ = useAdminPerformanceByArea(simuladoId, segment)
  const evolutionQ = useAdminScoreEvolution()
  const distQ = useAdminScoreDistribution(simuladoId)
  const cohortsQ = useAdminCohortRetention(6)
  const engagementQ = useAdminEngagementMetrics(days)
  const segmentsQ = useAdminSegmentBreakdown()

  const insights = (insightsQ.data ?? []) as IntelInsight[]
  // areas/evolution alimentam deps de useMemo/useEffect — memoizados para identidade estável.
  const areas = useMemo(() => (areasQ.data ?? []) as AreaPerformanceRow[], [areasQ.data])
  const evolution = useMemo(() => (evolutionQ.data ?? []) as ScoreEvolutionRow[], [evolutionQ.data])
  const dist = (distQ.data ?? []) as ScoreBucket[]
  const cohorts = (cohortsQ.data ?? []) as CohortRetentionRow[]
  const segments = (segmentsQ.data ?? []) as SegmentBreakdownRow[]
  const metrics = engagementQ.data ?? null

  // Lista de simulados para o filtro de área/distribuição (derivada da evolução).
  const simuladoOptions = useMemo(
    () =>
      evolution
        .slice()
        .sort((a, b) => a.sequence_number - b.sequence_number)
        .map(r => ({ id: r.simulado_id, label: `#${r.sequence_number} ${r.title}` })),
    [evolution],
  )

  // Área inspecionada para temas: default = pior área (areas vem ordenado por correct_rate asc).
  const worstArea = areas.length > 0 ? areas[0].area : null
  const activeArea = expandedArea ?? worstArea

  // Se a lista de áreas mudar e a área selecionada sumir, reseta a seleção manual.
  useEffect(() => {
    if (expandedArea && !areas.some(a => a.area === expandedArea)) {
      setExpandedArea(null)
    }
  }, [areas, expandedArea])

  const themesQ = useAdminPerformanceByTheme(simuladoId, activeArea, !!activeArea)
  const themes = (themesQ.data ?? []) as ThemePerformanceRow[]

  // ── Evolução: KPIs derivados
  const avgGeral =
    evolution.length > 0
      ? round1(evolution.reduce((acc, r) => acc + r.avg_score, 0) / evolution.length)
      : 0
  const bestSim = evolution.length
    ? evolution.reduce((best, r) => (r.avg_score > best.avg_score ? r : best))
    : null
  const worstSim = evolution.length
    ? evolution.reduce((w, r) => (r.avg_score < w.avg_score ? r : w))
    : null

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminPageHeader
        title="Panorama"
        subtitle="Inteligência sobre desempenho, engajamento e coortes — dados reais da plataforma."
        actions={
          <>
            <div className={TOGGLE_GROUP}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  aria-label={p.label}
                  aria-pressed={days === p.value}
                  onClick={() => setDays(p.value)}
                  className={toggleBtn(days === p.value)}
                >{p.label}</button>
              ))}
            </div>
            <div className="w-px h-5 bg-admin-line" />
            <div className={TOGGLE_GROUP}>
              {SEGMENTS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  aria-label={s.label}
                  aria-pressed={segment === s.value}
                  onClick={() => setSegment(s.value)}
                  className={toggleBtn(segment === s.value)}
                >{s.label}</button>
              ))}
            </div>
          </>
        }
      />

      {/* 1 ── Insights */}
      <section id="insights">
        <p className={SECTION_LABEL}>Insights</p>
        {insightsQ.isError ? (
          <AdminPanel><ErrorNote message={(insightsQ.error as Error)?.message} /></AdminPanel>
        ) : insightsQ.isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-[68px] animate-pulse rounded-lg border border-admin-line bg-admin-surface" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <AdminPanel>
            <AdminEmptyState title="Tudo sob controle" description="Nenhum alerta no momento." />
          </AdminPanel>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insights.map(insight => (
              <AdminInsightCard
                key={insight.id}
                insight={insight}
                onNavigate={route => {
                  const hash = route.split('#')[1]
                  if (hash) {
                    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    navigate(route)
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* 2 ── Desempenho por área */}
      <section id="areas">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-micro-label text-admin-muted uppercase">Desempenho por área</p>
          <select
            aria-label="Filtrar por simulado"
            className={NATIVE_SELECT}
            value={simuladoId ?? ''}
            onChange={e => setSimuladoId(e.target.value || null)}
          >
            <option value="">Todos os simulados</option>
            {simuladoOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {areasQ.isError ? (
          <AdminPanel><ErrorNote message={(areasQ.error as Error)?.message} /></AdminPanel>
        ) : !areasQ.isLoading && areas.length === 0 ? (
          <AdminPanel><AdminEmptyState title="Sem dados de desempenho" /></AdminPanel>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AdminPanel>
              <p className="text-[11px] font-semibold text-admin-text mb-3">Taxa de acerto por área</p>
              <AdminBarList
                isLoading={areasQ.isLoading}
                items={areas.map(a => ({
                  label: a.area,
                  value: a.correct_rate,
                  sublabel: `${a.n_questions} questões · ${formatInt(a.total_responses)} respostas`,
                }))}
                goodAt={70}
                warnAt={60}
                valueSuffix="%"
                embedded
              />
            </AdminPanel>

            <AdminPanel>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[11px] font-semibold text-admin-text">Temas mais difíceis</p>
                <select
                  aria-label="Inspecionar área"
                  className={NATIVE_SELECT}
                  value={activeArea ?? ''}
                  onChange={e => setExpandedArea(e.target.value || null)}
                >
                  {areas.map(a => (
                    <option key={a.area} value={a.area}>{a.area}</option>
                  ))}
                </select>
              </div>
              {themesQ.isError ? (
                <ErrorNote message={(themesQ.error as Error)?.message} />
              ) : !themesQ.isLoading && themes.length === 0 ? (
                <AdminEmptyState title="Sem temas para esta área" />
              ) : (
                <AdminBarList
                  isLoading={themesQ.isLoading}
                  items={themes
                    .slice()
                    .sort((a, b) => a.correct_rate - b.correct_rate)
                    .slice(0, 8)
                    .map(t => ({
                      label: t.theme,
                      value: t.correct_rate,
                      sublabel: `${formatInt(t.total_responses)} respostas`,
                    }))}
                  goodAt={70}
                  warnAt={60}
                  valueSuffix="%"
                  embedded
                />
              )}
            </AdminPanel>
          </div>
        )}
      </section>

      {/* 3 ── Evolução de notas */}
      <section id="evolucao">
        <p className={SECTION_LABEL}>Evolução de notas</p>
        {evolutionQ.isError ? (
          <AdminPanel><ErrorNote message={(evolutionQ.error as Error)?.message} /></AdminPanel>
        ) : !evolutionQ.isLoading && evolution.length === 0 ? (
          <AdminPanel><AdminEmptyState title="Sem simulados avaliados" /></AdminPanel>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AdminStatCard
                isLoading={evolutionQ.isLoading}
                label="Média geral"
                value={`${avgGeral}%`}
              />
              <AdminStatCard
                isLoading={evolutionQ.isLoading}
                label="Melhor simulado"
                value={bestSim ? `${round1(bestSim.avg_score)}%` : '—'}
                deltaLabel={bestSim ? `#${bestSim.sequence_number}` : undefined}
              />
              <AdminStatCard
                isLoading={evolutionQ.isLoading}
                label="Pior simulado"
                value={worstSim ? `${round1(worstSim.avg_score)}%` : '—'}
                deltaLabel={worstSim ? `#${worstSim.sequence_number}` : undefined}
              />
            </div>
            <AdminPanel>
              <AdminTrendChart
                title="Média × Mediana por simulado"
                type="line"
                data={evolution}
                xKey="sequence_number"
                lines={[
                  { key: 'avg_score', color: adminChartSeriesColors.primary, label: 'Média' },
                  { key: 'median_score', color: adminChartSeriesColors.info, label: 'Mediana' },
                ]}
                height={200}
                isLoading={evolutionQ.isLoading}
                embedded
              />
            </AdminPanel>
          </div>
        )}
      </section>

      {/* 4 ── Distribuição de notas */}
      <section id="distribuicao">
        <p className={SECTION_LABEL}>Distribuição de notas</p>
        {distQ.isError ? (
          <AdminPanel><ErrorNote message={(distQ.error as Error)?.message} /></AdminPanel>
        ) : !distQ.isLoading && dist.length === 0 ? (
          <AdminPanel><AdminEmptyState title="Sem distribuição no período" /></AdminPanel>
        ) : (
          <AdminPanel>
            <AdminTrendChart
              title="Alunos por faixa de nota"
              type="bar"
              data={dist}
              xKey="bucket_label"
              bars={[{ key: 'count', color: adminChartSeriesColors.primary, label: 'Alunos' }]}
              height={180}
              isLoading={distQ.isLoading}
              embedded
            />
          </AdminPanel>
        )}
      </section>

      {/* 5 ── Retenção por coorte */}
      <section id="cohorts">
        <p className={SECTION_LABEL}>Retenção por coorte</p>
        {cohortsQ.isError ? (
          <AdminPanel><ErrorNote message={(cohortsQ.error as Error)?.message} /></AdminPanel>
        ) : !cohortsQ.isLoading && cohorts.length === 0 ? (
          <AdminPanel><AdminEmptyState title="Sem coortes para exibir" /></AdminPanel>
        ) : (
          <AdminCohortMatrix rows={cohorts} isLoading={cohortsQ.isLoading} />
        )}
      </section>

      {/* 6 ── Engajamento & integridade */}
      <section id="engajamento">
        <p className={SECTION_LABEL}>Engajamento &amp; integridade</p>
        {engagementQ.isError ? (
          <AdminPanel><ErrorNote message={(engagementQ.error as Error)?.message} /></AdminPanel>
        ) : !engagementQ.isLoading && !metrics ? (
          <AdminPanel><AdminEmptyState title="Sem métricas no período" /></AdminPanel>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminStatCard
              isLoading={engagementQ.isLoading}
              label="Abandono"
              value={metrics ? `${metrics.abandonment_rate}%` : '—'}
              delta={metrics ? round1(metrics.abandonment_rate - metrics.abandonment_rate_prev) : undefined}
              deltaLabel={metrics ? 'p.p. vs período anterior' : undefined}
              invertDelta
            />
            <AdminStatCard
              isLoading={engagementQ.isLoading}
              label="Tempo médio"
              value={metrics ? `${round1(metrics.avg_minutes)} min` : '—'}
            />
            <AdminStatCard
              isLoading={engagementQ.isLoading}
              label="Saídas de aba (média)"
              value={metrics ? round1(metrics.avg_tab_exits) : '—'}
            />
            <AdminStatCard
              isLoading={engagementQ.isLoading}
              label="Flag integridade"
              value={metrics ? `${metrics.high_integrity_flag_pct}%` : '—'}
            />
          </div>
        )}
      </section>

      {/* 7 ── Segmentos */}
      <section id="segmentos">
        <p className={SECTION_LABEL}>Segmentos</p>
        {segmentsQ.isError ? (
          <AdminPanel><ErrorNote message={(segmentsQ.error as Error)?.message} /></AdminPanel>
        ) : (
          <AdminDataTable<SegmentBreakdownRow>
            isLoading={segmentsQ.isLoading}
            data={segments}
            emptyMessage="Sem segmentos para exibir."
            columns={[
              { key: 'segment', label: 'Segmento', render: r => SEGMENT_META[r.segment]?.label ?? r.segment },
              { key: 'users', label: 'Usuários', render: r => formatInt(r.users) },
              { key: 'participation_rate', label: 'Participação', render: r => `${r.participation_rate}%` },
              { key: 'avg_score', label: 'Média', render: r => `${r.avg_score}%` },
              { key: 'avg_attempts', label: 'Tentativas/usuário', render: r => r.avg_attempts },
            ]}
          />
        )}
      </section>
    </div>
  )
}

export default function AdminInteligencia() {
  return (
    <AdminCapabilityGate capability="intel.view">
      <AdminInteligenciaContent />
    </AdminCapabilityGate>
  )
}
