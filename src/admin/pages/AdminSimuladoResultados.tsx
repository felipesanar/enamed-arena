import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useParams, Link } from 'react-router-dom'
import { useState, useMemo, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  useAdminSimuladoDetailStats,
  useAdminSimuladoQuestionStats,
} from '@/admin/hooks/useAdminSimuladosAnalytics'
import { useSimuladoResultsRoster } from '@/admin/hooks/useSimuladoResultsRoster'
import { adminApi } from '@/admin/services/adminApi'
import type { SimuladoResultRow, ResultsRosterParams } from '@/admin/services/adminApi'
import type { SimuladoQuestionStat } from '@/admin/types'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminTrendChart } from '@/admin/components/ui/AdminTrendChart'
import { AdminBarList } from '@/admin/components/ui/AdminBarList'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminDataTable } from '@/admin/components/ui/AdminDataTable'
import { formatInt } from '@/admin/lib/format'
import { toast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { exportResultsRosterXlsx } from '@/admin/utils/exportResultsRoster'
import { Download } from 'lucide-react'

// ─── helpers ───────────────────────────────────────────────────────────────

function discriminationLabel(index: number): { label: string; description: string; cls: string } {
  if (index >= 30) return { label: 'Diferencia bem', description: 'Quem estudou acerta, quem não estudou erra', cls: 'text-admin-success' }
  if (index >= 10) return { label: 'Diferencia pouco', description: 'Não separa bem preparados de não preparados', cls: 'text-admin-warning' }
  if (index >= 0) return { label: 'Não diferencia', description: 'Todos acertam ou todos erram igualmente', cls: 'text-admin-destructive' }
  return { label: 'Questão confusa', description: 'Os melhores alunos erram mais que os piores', cls: 'text-admin-destructive' }
}

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Roster columns ─────────────────────────────────────────────────────────

function buildColumns(totalCount: number) {
  return [
    {
      key: 'rank',
      label: '#',
      width: '44px',
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-admin-muted text-xs">{String(row.rank ?? '')}</span>
      ),
    },
    {
      key: 'name',
      label: 'Nome',
      width: '1fr',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="font-medium text-admin-text truncate block" title={String(row.name ?? '')}>
          {row.name ? String(row.name) : <span className="text-admin-faint">—</span>}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'E-mail',
      width: '1.2fr',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-admin-muted text-xs truncate block" title={String(row.email ?? '')}>
          {row.email ? String(row.email) : '—'}
        </span>
      ),
    },
    {
      key: 'segment',
      label: 'Segmento',
      width: '90px',
      sortable: true,
      render: (row: Record<string, unknown>) => {
        const seg = String(row.segment ?? '')
        const cls = seg === 'pro'
          ? 'bg-admin-accent/10 text-admin-accent border-admin-accent/30'
          : seg === 'standard'
            ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
            : 'bg-admin-raised text-admin-muted border-admin-line'
        return <Badge variant="outline" className={cn('text-[10px]', cls)}>{seg}</Badge>
      },
    },
    {
      key: 'institution',
      label: 'Instituição',
      width: '120px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-xs text-admin-muted truncate block" title={String(row.institution ?? '')}>
          {row.institution ? String(row.institution) : '—'}
        </span>
      ),
    },
    {
      key: 'specialty',
      label: 'Especialidade',
      width: '120px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-xs text-admin-muted truncate block" title={String(row.specialty ?? '')}>
          {row.specialty ? String(row.specialty) : '—'}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Nota',
      width: '72px',
      sortable: true,
      render: (row: Record<string, unknown>) => {
        const s = row.score
        if (s == null) return <span className="text-admin-faint text-xs">—</span>
        const n = Number(s)
        const cls = n >= 70 ? 'text-admin-success' : n >= 50 ? 'text-admin-warning' : 'text-admin-destructive'
        return <span className={cn('font-semibold text-xs', cls)}>{n.toFixed(1)}%</span>
      },
    },
    {
      key: 'correct_count',
      label: 'Acertos',
      width: '80px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-xs text-admin-text tabular-nums">
          {String(row.correct_count ?? 0)}/{totalCount || String(row.total_count ?? '?')}
        </span>
      ),
    },
    {
      key: 'duration_seconds',
      label: 'Tempo',
      width: '72px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-xs text-admin-muted tabular-nums">
          {fmtDuration(Number(row.duration_seconds ?? 0))}
        </span>
      ),
    },
    {
      key: 'submitted_at',
      label: 'Concluído',
      width: '110px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-[10px] text-admin-muted tabular-nums">
          {row.submitted_at ? fmtDate(String(row.submitted_at)) : '—'}
        </span>
      ),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      width: '70px',
      render: (row: Record<string, unknown>) => {
        const valid = Boolean(row.is_within_window)
        return (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              valid
                ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
                : 'bg-admin-raised text-admin-muted border-admin-line',
            )}
          >
            {valid ? 'Válido' : 'Treino'}
          </Badge>
        )
      },
    },
  ]
}

// ─── Aggregate helpers ───────────────────────────────────────────────────────

function aggregateBySegment(rows: SimuladoResultRow[]): { label: string; value: number; sublabel?: string }[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const r of rows) {
    if (r.score == null) continue
    const entry = map.get(r.segment) ?? { total: 0, count: 0 }
    entry.total += r.score
    entry.count += 1
    map.set(r.segment, entry)
  }
  return Array.from(map.entries())
    .map(([seg, { total, count }]) => ({
      label: seg,
      value: count > 0 ? total / count : 0,
      sublabel: `${count} concluinte${count !== 1 ? 's' : ''}`,
    }))
    .sort((a, b) => b.value - a.value)
}

function aggregateByInstitution(rows: SimuladoResultRow[]): { label: string; value: number; sublabel?: string }[] {
  const map = new Map<string, { totalScore: number; count: number }>()
  for (const r of rows) {
    if (!r.institution) continue
    const entry = map.get(r.institution) ?? { totalScore: 0, count: 0 }
    entry.count += 1
    if (r.score != null) entry.totalScore += r.score
    map.set(r.institution, entry)
  }
  return Array.from(map.entries())
    .map(([inst, { totalScore, count }]) => ({
      label: inst,
      value: count,
      sublabel: count > 0 ? `média ${(totalScore / count).toFixed(1)}%` : undefined,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15)
}

// ─── Main content ─────────────────────────────────────────────────────────────

function AdminSimuladoResultadosContent() {
  const { id } = useParams<{ id: string }>()
  // — Macro data
  const { data: stats, isLoading: statsLoading } = useAdminSimuladoDetailStats(id!)
  const { data: questions = [], isLoading: qLoading } = useAdminSimuladoQuestionStats(id!)

  const { data: scoreDistribution = [], isLoading: distLoading } = useQuery({
    queryKey: ['admin', 'score-distribution', id],
    queryFn: () => adminApi.getScoreDistribution(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const { data: areaPerformance = [], isLoading: areaLoading } = useQuery({
    queryKey: ['admin', 'performance-by-area', id, 'all'],
    queryFn: () => adminApi.getPerformanceByArea(id!, 'all'),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  // — Roster state
  const LIMIT = 50
  const [sort, setSort] = useState('score')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [scope, setScope] = useState<'valid' | 'training' | 'all'>('valid')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [exportingXlsx, setExportingXlsx] = useState(false)

  // debounce search
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback((v: string) => {
    setSearch(v)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(v)
      setPage(0)
    }, 300)
  }, [])

  const rosterParams: ResultsRosterParams = {
    simuladoId: id!,
    sort,
    dir,
    scope,
    search: debouncedSearch,
    segment: 'all',
    institution: 'all',
    limit: LIMIT,
    offset: page * LIMIT,
  }

  const { rows, totalRows, isLoading: rosterLoading, isFetching: rosterFetching } = useSimuladoResultsRoster(rosterParams)

  // — Aggregate data: fetch up to 1000 rows for client-side segment/institution panels
  const { data: aggregateRows = [] } = useQuery({
    queryKey: ['admin', 'simulado-results-aggregate', id, scope],
    queryFn: () => adminApi.getSimuladoResultsRoster({
      simuladoId: id!,
      sort: 'score',
      dir: 'desc',
      scope,
      search: '',
      segment: 'all',
      institution: 'all',
      limit: 1000,
      offset: 0,
    }),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const aggregateTotal = aggregateRows[0]?.total_rows ?? 0
  const showAggregateCap = aggregateTotal > aggregateRows.length && aggregateRows.length > 0

  const segmentItems = useMemo(() => aggregateBySegment(aggregateRows), [aggregateRows])
  const institutionItems = useMemo(() => aggregateByInstitution(aggregateRows), [aggregateRows])

  const areaBarItems = useMemo(
    () => areaPerformance.map(a => ({ label: a.area, value: a.correct_rate, sublabel: `${a.n_users} usuários` })),
    [areaPerformance],
  )

  const scoreDistChartData = useMemo(
    () => scoreDistribution.map(b => ({ label: b.bucket_label, count: b.count })),
    [scoreDistribution],
  )

  // — Sort handler
  const handleSort = useCallback((key: string) => {
    if (key === sort) {
      setDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(key)
      setDir('desc')
    }
    setPage(0)
  }, [sort])

  // — Export
  const handleExport = useCallback(async () => {
    if (!id) return
    setExportingXlsx(true)
    toast({ title: 'Gerando planilha…' })
    try {
      const allRows: SimuladoResultRow[] = []
      let offset = 0
      const exportTotal = totalRows

      while (true) {
        const batch = await adminApi.getSimuladoResultsRoster({
          simuladoId: id,
          sort,
          dir,
          scope,
          search: debouncedSearch,
          segment: 'all',
          institution: 'all',
          limit: 1000,
          offset,
        })
        if (batch.length === 0) break
        allRows.push(...batch)
        offset += 1000
        if (allRows.length >= exportTotal) break
      }

      logger.log(`[AdminSimuladoResultados] export: ${allRows.length} rows`)
      const title = stats ? `${stats.sequence_number}_${stats.title}` : id
      await exportResultsRosterXlsx(allRows, title)
      toast({ title: 'Download iniciado!' })
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' })
    } finally {
      setExportingXlsx(false)
    }
  }, [id, sort, dir, scope, debouncedSearch, totalRows, stats])

  // — Roster columns (recompute only when total_count changes)
  const totalCount = rows[0]?.total_count ?? 0
  const columns = useMemo(() => buildColumns(totalCount), [totalCount])

  // — Pagination
  const offset = page * LIMIT
  const canPrev = page > 0
  const canNext = offset + LIMIT < totalRows

  const scopeLabels: Record<string, string> = { valid: 'Válidos', training: 'Treino', all: 'Todos' }

  return (
    <div className="max-w-[1400px] space-y-6">
      <AdminPageHeader
        title="Resultados"
        subtitle={stats ? `#${stats.sequence_number} — ${stats.title}` : 'Carregando…'}
        actions={
          <Link
            to="/admin/simulados"
            className="text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
          >
            ← Voltar aos simulados
          </Link>
        }
      />

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <section>
        <AdminSectionHeader title="Métricas gerais" />
        {statsLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <AdminStatCard key={i} label="..." value="..." isLoading />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdminStatCard label="Participantes" value={formatInt(stats.participants)} />
            <AdminStatCard label="Taxa de conclusão" value={`${stats.completion_rate.toFixed(1)}%`} />
            <AdminStatCard label="Média geral" value={`${stats.avg_score.toFixed(1)}%`} />
            <AdminStatCard label="Abandono" value={`${stats.abandonment_rate.toFixed(1)}%`} invertDelta />
            <AdminStatCard label="Tempo médio" value={`${stats.avg_time_minutes.toFixed(0)} min`} />
          </div>
        ) : null}
      </section>

      {/* ── Distribuição + Área side-by-side ──────────────────────────────── */}
      <section>
        <AdminSectionHeader title="Distribuição de notas e acerto por área" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AdminTrendChart
            title="Distribuição de notas"
            data={scoreDistChartData}
            xKey="label"
            type="bar"
            bars={[{ key: 'count', color: 'hsl(var(--admin-accent))', label: 'Concluintes' }]}
            height={150}
            isLoading={distLoading}
          />

          <AdminPanel>
            <p className="text-[11px] font-semibold text-admin-text mb-3">Acerto por grande área</p>
            {areaLoading ? (
              <AdminBarList items={[]} isLoading />
            ) : areaBarItems.length === 0 ? (
              <AdminEmptyState title="Sem dados de área" />
            ) : (
              <AdminBarList
                items={areaBarItems}
                goodAt={70}
                warnAt={50}
                valueSuffix="%"
                max={100}
              />
            )}
          </AdminPanel>
        </div>
      </section>

      {/* ── Por segmento + Top instituições ───────────────────────────────── */}
      <section>
        <AdminSectionHeader title="Por segmento e instituição" />
        {showAggregateCap && (
          <p className="text-[10px] text-admin-faint mb-2">
            Agregado sobre os primeiros {aggregateRows.length} de {formatInt(aggregateTotal)} concluintes.
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AdminPanel>
            <p className="text-[11px] font-semibold text-admin-text mb-3">Média por segmento</p>
            {segmentItems.length === 0 ? (
              <AdminEmptyState title="Sem dados" />
            ) : (
              <AdminBarList
                items={segmentItems}
                goodAt={70}
                warnAt={50}
                valueSuffix="%"
                max={100}
              />
            )}
          </AdminPanel>

          <AdminPanel>
            <p className="text-[11px] font-semibold text-admin-text mb-3">Top instituições (por participantes)</p>
            {institutionItems.length === 0 ? (
              <AdminEmptyState title="Sem dados" />
            ) : (
              <AdminBarList items={institutionItems} />
            )}
          </AdminPanel>
        </div>
      </section>

      {/* ── Por questão ───────────────────────────────────────────────────── */}
      <section>
        <AdminSectionHeader title="Analytics por questão" hook={`${questions.length} questões`} />
        {qLoading ? (
          <div className="bg-admin-surface border border-admin-line rounded-lg animate-pulse h-32" />
        ) : questions.length === 0 ? (
          <AdminEmptyState title="Sem dados suficientes para esta análise" />
        ) : (
          <div className="bg-admin-surface border border-admin-line rounded-lg overflow-hidden">
            <div
              className="grid border-b border-admin-line text-[9px] font-bold text-admin-faint uppercase tracking-wide"
              style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}
            >
              {['Q', 'Enunciado', 'Taxa de acerto', 'Qualidade da questão', 'Erro mais comum'].map(h => (
                <div key={h} className="px-3 py-2">{h}</div>
              ))}
            </div>
            {questions.map((q: SimuladoQuestionStat) => {
              const barPct = Math.min(100, Math.max(0, q.correct_rate))
              const barColor = barPct >= 70 ? 'bg-admin-success' : barPct >= 40 ? 'bg-admin-warning' : 'bg-admin-destructive'
              const disc = discriminationLabel(q.discrimination_index)
              return (
                <div
                  key={q.question_number}
                  className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/20 items-center"
                  style={{ gridTemplateColumns: '40px 1fr 160px 140px 120px' }}
                >
                  <div className="px-3 py-2.5 text-xs font-bold text-admin-muted">Q{q.question_number}</div>
                  <div className="px-3 py-2.5 text-[11px] text-admin-text truncate max-w-xs" title={q.text}>
                    {q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-admin-raised rounded-full">
                        <div className={cn('h-1.5 rounded-full', barColor)} style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-admin-text w-10 text-right">
                        {q.correct_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5" title={disc.description}>
                    <span className={cn('text-[11px] font-semibold', disc.cls)}>{disc.label}</span>
                    <p className="text-[9px] text-admin-muted">{disc.description}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    {q.most_common_wrong_label ? (
                      <>
                        <span className="text-[10px] bg-admin-raised/60 border border-admin-line text-admin-muted px-1.5 py-0.5 rounded">
                          Alt. {q.most_common_wrong_label}
                        </span>
                        <span className="text-[9px] text-admin-muted ml-1">({q.most_common_wrong_pct?.toFixed(1)}%)</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-admin-faint">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Roster ─────────────────────────────────────────────────────────── */}
      <section>
        <AdminSectionHeader
          title="Concluintes"
          hook={rosterLoading ? '…' : `${formatInt(totalRows)} registros`}
        />

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="h-8 text-xs w-56 bg-admin-surface border-admin-line"
          />

          {/* Scope toggle */}
          <div className="flex items-center rounded-lg border border-admin-line overflow-hidden">
            {(['valid', 'training', 'all'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setScope(s); setPage(0) }}
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors',
                  scope === s
                    ? 'bg-admin-accent text-white'
                    : 'bg-admin-surface text-admin-muted hover:bg-admin-raised',
                )}
              >
                {scopeLabels[s]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-admin-line"
            disabled={exportingXlsx || totalRows === 0}
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Exportar XLSX
          </Button>
        </div>

        {/* Table */}
        <div className={cn('transition-opacity', rosterFetching && !rosterLoading && 'opacity-70')}>
          <AdminDataTable
            columns={columns as any}
            data={rows as unknown as Record<string, unknown>[]}
            compact
            isLoading={rosterLoading}
            emptyMessage="Nenhum concluinte encontrado com esses filtros."
            sortKey={sort}
            sortDir={dir}
            onSort={handleSort}
          />
        </div>

        {/* Pagination */}
        {!rosterLoading && totalRows > 0 && (
          <div className="flex items-center justify-between mt-3 text-xs text-admin-muted">
            <span>
              {formatInt(offset + 1)}–{formatInt(Math.min(offset + LIMIT, totalRows))} de {formatInt(totalRows)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-admin-line"
                disabled={!canPrev}
                onClick={() => setPage(p => p - 1)}
              >
                ← Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-admin-line"
                disabled={!canNext}
                onClick={() => setPage(p => p + 1)}
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default function AdminSimuladoResultados() {
  return (
    <AdminCapabilityGate capability="results.view">
      <AdminSimuladoResultadosContent />
    </AdminCapabilityGate>
  )
}
