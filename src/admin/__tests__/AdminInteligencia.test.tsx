import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'
import { visibleNav } from '@/admin/lib/navigation'

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
  return renderWithAccess(<MemoryRouter><AdminInteligencia /></MemoryRouter>)
}

describe('AdminInteligencia', () => {
  beforeEach(() => {
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
    expect(screen.getByText('Retenção por coorte')).toBeInTheDocument()
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
