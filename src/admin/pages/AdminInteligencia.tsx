import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useAppConfig } from '@/hooks/useAppConfig'
import { useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
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

/**
 * Abertura de cada painel de Análise: o nome do painel, a pergunta que ele
 * responde e uma linha de apoio. Ajuda quem chega novo a saber se está na tela
 * certa sem precisar abrir as outras.
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

function editionSimLabel(row: ScoreEvolutionRow) {
  return `${row.edition_code || row.edition_label || 'Edição não informada'} · Simulado ${row.sequence_number}`
}

function EditionEvolution({ rows }: { rows: ScoreEvolutionRow[] }) {
  const groups = new Map<string, ScoreEvolutionRow[]>()
  for (const row of rows) {
    // Missing edition metadata cannot establish comparability, even between two rows.
    const key = row.edition_id ?? `unknown:${row.simulado_id}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return <div className="space-y-4">
    <p className="text-sm text-admin-muted">Percentuais brutos comparados somente dentro de cada edição. Não representam uma escala oficial comum de proficiência.</p>
    {[...groups].map(([id, group]) => {
      const sorted = group.slice().sort((a, b) => a.sequence_number - b.sequence_number || a.simulado_id.localeCompare(b.simulado_id))
      const best = sorted.reduce((a, b) => a.avg_score >= b.avg_score ? a : b)
      const worst = sorted.reduce((a, b) => a.avg_score <= b.avg_score ? a : b)
      const label = sorted[0].edition_label || sorted[0].edition_code || 'Edição não informada'
      return <section key={id} aria-label={`Evolução: ${label}`} className="space-y-3">
        <h2 className="text-sm font-semibold text-admin-text">{label}</h2>
        {!sorted[0].edition_id && <p className="text-sm text-admin-muted">Metadados de edição ausentes. Este simulado é exibido isoladamente, sem atribuição por posição ou ano.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminStatCard label="Média da edição" value={`${round1(sorted.reduce((n, r) => n + r.avg_score, 0) / sorted.length)}%`} />
          <AdminStatCard label="Melhor simulado da edição" value={`${round1(best.avg_score)}%`} deltaLabel={editionSimLabel(best)} />
          <AdminStatCard label="Pior simulado da edição" value={`${round1(worst.avg_score)}%`} deltaLabel={editionSimLabel(worst)} />
        </div>
        <AdminPanel><AdminTrendChart title={`Média × Mediana · ${label}`} type="line"
          data={sorted.map(r => ({ ...r, reportLabel: editionSimLabel(r), reportKey: `${id}:${r.simulado_id}` }))} xKey="sequence_number"
          lines={[{ key: 'avg_score', color: adminChartSeriesColors.primary, label: 'Média' }, { key: 'median_score', color: adminChartSeriesColors.info, label: 'Mediana' }]} height={200} embedded /></AdminPanel>
        <ul aria-label={`Simulados de ${label}`} className="text-xs text-admin-muted">{sorted.map(r => <li key={`${id}:${r.simulado_id}`}>{editionSimLabel(r)}</li>)}</ul>
      </section>
    })}
  </div>
}

function AdminInteligenciaContent() {
  const navigate = useNavigate()
  const editionsEnabled = useAppConfig('editions_ui')
  const { reportScope, reportError, reportEditionId, period, setPeriod } = useAdminPeriod()
  const scope = editionsEnabled ? reportScope : undefined
  const ready = !editionsEnabled || !!scope
  const comparable = !editionsEnabled || reportEditionId !== null

  const [days, setDays] = useState(30)
  const [segment, setSegment] = useState('all')
  const [simuladoSelection, setSimuladoSelection] = useState<{ id: string | null; edition: string | null }>({ id: null, edition: reportEditionId })
  const simuladoId = editionsEnabled && simuladoSelection.edition !== reportEditionId ? null : simuladoSelection.id
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  // ── Data
  const insightsQ = useAdminIntelInsights(scope, ready)
  const areasQ = useAdminPerformanceByArea(simuladoId, segment, scope, ready && comparable)
  const evolutionQ = useAdminScoreEvolution(scope, ready)
  const distQ = useAdminScoreDistribution(simuladoId, scope, ready && comparable)
  const cohortsQ = useAdminCohortRetention(6, scope, ready)
  const engagementQ = useAdminEngagementMetrics(editionsEnabled ? period : days)
  const segmentsQ = useAdminSegmentBreakdown(scope, ready)

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
        .map(r => ({ id: r.simulado_id, key: `${r.edition_id ?? 'unknown'}:${r.simulado_id}`, label: editionsEnabled ? editionSimLabel(r) : `#${r.sequence_number} ${r.title}` })),
    [evolution, editionsEnabled],
  )

  // Área inspecionada para temas: default = pior área (areas vem ordenado por correct_rate asc).
  const worstArea = areas.length > 0 ? areas[0].area : null
  const activeArea = editionsEnabled && simuladoSelection.edition !== reportEditionId ? worstArea : expandedArea ?? worstArea

  useEffect(() => {
    if (editionsEnabled) {
      setSimuladoSelection(current => current.edition !== reportEditionId ? { id: null, edition: reportEditionId } : current)
      setExpandedArea(null)
    }
  }, [reportEditionId, editionsEnabled])
  useEffect(() => {
    if (editionsEnabled && evolutionQ.isSuccess && simuladoId && !evolution.some(r => r.simulado_id === simuladoId)) {
      setSimuladoSelection({ id: null, edition: reportEditionId })
      setExpandedArea(null)
    }
  }, [editionsEnabled, evolutionQ.isSuccess, evolution, simuladoId, reportEditionId])

  // Se a lista de áreas mudar e a área selecionada sumir, reseta a seleção manual.
  useEffect(() => {
    if (expandedArea && !areas.some(a => a.area === expandedArea)) {
      setExpandedArea(null)
    }
  }, [areas, expandedArea])

  const themesQ = useAdminPerformanceByTheme(simuladoId, activeArea, !!activeArea && ready && comparable, scope)
  const themes = (themesQ.data ?? []) as ThemePerformanceRow[]

  // ── Evolução: KPIs derivados
  const avgGeral =
    !editionsEnabled && evolution.length > 0
      ? round1(evolution.reduce((acc, r) => acc + r.avg_score, 0) / evolution.length)
      : 0
  const totalParticipants = evolution.reduce((acc, r) => acc + r.participants, 0)
  const bestSim = !editionsEnabled && evolution.length
    ? evolution.reduce((best, r) => (r.avg_score > best.avg_score ? r : best))
    : null
  const worstSim = !editionsEnabled && evolution.length
    ? evolution.reduce((w, r) => (r.avg_score < w.avg_score ? r : w))
    : null

  if (!ready) return <AdminPanel><p role="status" className="text-sm text-admin-text">{reportError ?? 'Valide os filtros para carregar os relatórios.'}</p></AdminPanel>

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <PanelQuestion
          eyebrow="Visão geral"
          question="Como está a operação como um todo?"
          helper="O resumo de tudo num lugar só: desempenho, engajamento e coortes com dados reais da plataforma."
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!editionsEnabled && <div className={TOGGLE_GROUP}>
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
          </div>}
          {!editionsEnabled && <div className="w-px h-5 bg-admin-line" />}
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
        </div>
      </div>

      {/* Resumo de topo: três números que respondem à pergunta de cara. */}
      <section aria-label="Resumo da operação">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {!editionsEnabled && <AdminStatCard
            isLoading={engagementQ.isLoading}
            label="Provas iniciadas no período"
            value={metrics ? formatInt(metrics.started) : '—'}
          />}
          <AdminStatCard
            isLoading={evolutionQ.isLoading}
            label="Provas avaliadas"
            value={evolution.length > 0 ? formatInt(totalParticipants) : '—'}
          />
          {!editionsEnabled && <AdminStatCard
            isLoading={evolutionQ.isLoading}
            label="Nota média"
            value={evolution.length > 0 ? `${avgGeral}%` : '—'}
          />}
        </div>
      </section>

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-micro-label text-admin-muted uppercase">Desempenho por área</p>
          <select
            aria-label="Filtrar por simulado"
            className={NATIVE_SELECT}
            value={simuladoId ?? ''}
            disabled={!comparable}
            onChange={e => { setSimuladoSelection({ id: e.target.value || null, edition: reportEditionId }); setExpandedArea(null) }}
          >
            <option value="">Todos os simulados</option>
            {simuladoOptions.map(o => (
              <option key={o.key} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {!comparable ? <AdminPanel><p className="text-sm text-admin-muted">Escolha uma edição para comparar percentuais de acerto por área. Resultados brutos de edições diferentes não estimam proficiência comum.</p></AdminPanel> : areasQ.isError ? (
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
        ) : editionsEnabled ? (
          <EditionEvolution rows={evolution} />
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
        {!comparable ? <AdminPanel><p className="text-sm text-admin-muted">Escolha uma edição para ver a distribuição de percentuais brutos. Esta distribuição não estima proficiência nem uma escala oficial comum.</p></AdminPanel> : distQ.isError ? (
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

      {/* 5 ── Ativação acumulada por coorte */}
      <section id="cohorts">
        <p className={SECTION_LABEL}>Ativação acumulada por coorte</p>
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
        {editionsEnabled && <div className="mb-4 space-y-2">
          <p className="text-sm text-admin-muted">Visão legada: engajamento não está disponível por edição ou intervalo livre. Os controles globais não se aplicam a esta seção.</p>
          <label htmlFor="engagement-legacy-period" className="block text-xs font-semibold text-admin-text">Período legado do engajamento</label>
          <select id="engagement-legacy-period" className={`${NATIVE_SELECT} min-h-11 max-w-full`} value={period} onChange={e => setPeriod(Number(e.target.value) as 7 | 30 | 90)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <p className="text-sm text-admin-text">Provas iniciadas no período legado: {metrics ? formatInt(metrics.started) : '—'}</p>
        </div>}
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
              { key: 'avg_score', label: 'Média', render: r => comparable ? `${r.avg_score}%` : 'Selecione uma edição' },
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
