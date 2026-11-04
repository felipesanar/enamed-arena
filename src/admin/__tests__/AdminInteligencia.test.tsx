import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'
import { visibleNav } from '@/admin/lib/navigation'
import { AdminPeriodProvider, useAdminPeriod } from '@/admin/contexts/AdminPeriodContext'
import { useEffect } from 'react'

const report = vi.hoisted(() => ({ enabled: false }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'intel-operator' }, loading: false }) }))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => report.enabled }))
vi.mock('@/admin/components/ui/AdminTrendChart', () => ({ AdminTrendChart: ({ title, data }: { title: string; data: unknown[] }) => <div data-testid="chart" aria-label={title}>{JSON.stringify(data)}</div> }))

vi.mock('@/admin/hooks/useAdminInteligencia')

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

import AdminInteligencia from '@/admin/pages/AdminInteligencia'

const empty = { data: [], isLoading: false, isError: false } as any
const emptyObj = { data: null, isLoading: false, isError: false } as any

function setAllEmpty() {
  vi.mocked(useAdminIntelInsights).mockReturnValue(empty)
  vi.mocked(useAdminPerformanceByArea).mockReturnValue(empty)
  vi.mocked(useAdminPerformanceByTheme).mockReturnValue(empty)
  vi.mocked(useAdminScoreEvolution).mockReturnValue(empty)
  vi.mocked(useAdminScoreDistribution).mockReturnValue(empty)
  vi.mocked(useAdminCohortRetention).mockReturnValue(empty)
  vi.mocked(useAdminEngagementMetrics).mockReturnValue(emptyObj)
  vi.mocked(useAdminSegmentBreakdown).mockReturnValue(empty)
}

function renderPage() {
  return renderWithAccess(<MemoryRouter><AdminPeriodProvider><Catalog /><AdminInteligencia /></AdminPeriodProvider></MemoryRouter>)
}

function Catalog() {
  const c = useAdminPeriod()
  useEffect(() => { c.setReportCatalog({ status: 'ready', editions: [{ id: 'a', label: 'Edição A' }, { id: 'b', label: 'Edição B' }] }) }, [c.setReportCatalog])
  return <><button onClick={() => c.setReportEditionId('a')}>Escolher A</button><button onClick={() => c.setReportEditionId('b')}>Escolher B</button></>
}

describe('AdminInteligencia', () => {
  beforeEach(() => {
    sessionStorage.clear()
    report.enabled = false
    vi.clearAllMocks()
    setAllEmpty()
  })

  it('renders the page question and all section headings without crashing on empty data', () => {
    renderPage()
    expect(screen.getByText('Como está a operação como um todo?')).toBeInTheDocument()
    expect(screen.getByText('Visão geral')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Desempenho por área')).toBeInTheDocument()
    expect(screen.getByText('Evolução de notas')).toBeInTheDocument()
    expect(screen.getByText('Distribuição de notas')).toBeInTheDocument()
    expect(screen.getByText('Ativação acumulada por coorte')).toBeInTheDocument()
    expect(screen.getByText(/Engajamento/)).toBeInTheDocument()
    expect(screen.getByText('Segmentos')).toBeInTheDocument()
  })

  it('shows the "all clear" empty state when there are no insights', () => {
    renderPage()
    expect(screen.getByText('Tudo sob controle')).toBeInTheDocument()
  })

  it('renders insight cards when present', () => {
    vi.mocked(useAdminIntelInsights).mockReturnValue({
      data: [
        {
          id: 'i1',
          severity: 'critical',
          category: 'desempenho',
          title: 'Área crítica: Cardiologia',
          detail: 'Taxa de acerto abaixo de 50%.',
          metric_value: 48,
          metric_unit: 'percent',
          route: '/admin/inteligencia#areas',
        },
      ],
      isLoading: false,
      isError: false,
    } as any)
    renderPage()
    expect(screen.getByText('Área crítica: Cardiologia')).toBeInTheDocument()
    expect(screen.queryByText('Tudo sob controle')).not.toBeInTheDocument()
  })

  it('separates A/B simulado 1 charts/labels without global avg/best/worst', () => {
    report.enabled = true
    vi.mocked(useAdminScoreEvolution).mockReturnValue({ ...empty, isSuccess: true, data: [
      { edition_id: 'a', edition_code: 'A', edition_label: 'Edição A', simulado_id: 'sa', sequence_number: 1, title: 'Um', avg_score: 40, median_score: 40, participants: 2 },
      { edition_id: 'b', edition_code: 'B', edition_label: 'Edição B', simulado_id: 'sb', sequence_number: 1, title: 'Outro', avg_score: 80, median_score: 80, participants: 3 },
    ] } as never)
    renderPage()
    expect(screen.getByRole('option', { name: 'A · Simulado 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B · Simulado 1' })).toBeInTheDocument()
    const charts = screen.getAllByTestId('chart')
    expect(charts).toHaveLength(2)
    expect(charts[0]).toHaveTextContent('"simulado_id":"sa"')
    expect(charts[0]).not.toHaveTextContent('"simulado_id":"sb"')
    expect(charts[1]).toHaveTextContent('"simulado_id":"sb"')
    expect(screen.queryByText('Média geral')).not.toBeInTheDocument()
    expect(screen.queryByText('Nota média')).not.toBeInTheDocument()
    expect(screen.queryByText('Melhor simulado')).not.toBeInTheDocument()
    expect(screen.queryByText('60%')).not.toBeInTheDocument()
    expect(screen.getByText(/Esta distribuição não estima proficiência/)).toBeInTheDocument()
    expect(screen.getByLabelText('Período legado do engajamento')).toBeInTheDocument()
    expect(useAdminScoreEvolution).toHaveBeenLastCalledWith(expect.objectContaining({ editionId: null }), true)
  })

  it('resets simulado immediately when the global edition changes', () => {
    report.enabled = true
    vi.mocked(useAdminScoreEvolution).mockReturnValue({ ...empty, isSuccess: true, data: [
      { edition_id: 'a', edition_code: 'A', simulado_id: 'sa', sequence_number: 1, avg_score: 50, participants: 1 },
    ] } as never)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher A' }))
    fireEvent.change(screen.getByLabelText('Filtrar por simulado'), { target: { value: 'sa' } })
    expect(useAdminPerformanceByArea).toHaveBeenLastCalledWith('sa', 'all', expect.objectContaining({ editionId: 'a' }), true)
    fireEvent.click(screen.getByRole('button', { name: 'Escolher B' }))
    expect(useAdminPerformanceByArea).toHaveBeenLastCalledWith(null, 'all', expect.objectContaining({ editionId: 'b' }), true)
    expect(screen.getByLabelText('Filtrar por simulado')).toHaveValue('')
    expect(screen.getByText('Sem dados de desempenho')).toBeInTheDocument()
  })

  it('keeps unknown metadata isolated and never infers an edition by position', () => {
    report.enabled = true
    vi.mocked(useAdminScoreEvolution).mockReturnValue({ ...empty, data: [
      { simulado_id: 'x', sequence_number: 1, avg_score: 50, participants: 1 },
      { simulado_id: 'y', sequence_number: 1, avg_score: 60, participants: 1 },
    ] } as never)
    renderPage()
    expect(screen.getAllByTestId('chart')).toHaveLength(2)
    expect(screen.getAllByText(/Metadados de edição ausentes/)).toHaveLength(2)
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument()
  })
})

describe('navigation — Visão geral', () => {
  it('lists Visão geral as the first Análise item for intel.view', () => {
    const groups = visibleNav(new Set(['intel.view']))
    const analise = groups.find(g => g.title === 'Análise')
    expect(analise).toBeDefined()
    expect(analise!.items[0].label).toBe('Visão geral')
    expect(analise!.items[0].to).toBe('/admin/inteligencia')
  })
})
