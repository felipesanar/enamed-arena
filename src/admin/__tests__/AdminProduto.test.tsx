import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminProduto')

import {
  useAdminProdutoSegmentedFunnel,
  useAdminProdutoFriction,
  useAdminProdutoFeatureAdoption,
  useAdminProdutoTopEvents,
} from '@/admin/hooks/useAdminProduto'

const mockFunnel = [
  { step_order: 1, step_label: 'Cadastrou', guest_count: 500, guest_pct: 100, standard_count: 300, standard_pct: 100, pro_count: 200, pro_pct: 100 },
  { step_order: 2, step_label: 'Onboarding', guest_count: 300, guest_pct: 60, standard_count: 270, standard_pct: 90, pro_count: 190, pro_pct: 95 },
]

const mockFriction = [
  { key: 'post_exam_churn', title: 'Abandono pós-1ª prova', event_name: 'exam_submitted', metric_value: 62, metric_unit: 'percent', severity: 'critical' },
  { key: 'onb_dropout', title: 'Dropout no onboarding', event_name: 'signup', metric_value: 15, metric_unit: 'percent', severity: 'healthy' },
]

const mockAdoption = [
  { feature: 'Ver resultado', event_name: 'resultado_viewed', adoption_pct: 78 },
  { feature: 'Caderno de Erros', event_name: 'caderno_erros_viewed', adoption_pct: 34 },
]

const mockTopEvents = [
  { event_name: 'exam_started', cnt: 1420 },
  { event_name: 'resultado_viewed', cnt: 980 },
]

function renderPage() {
  return render(<MemoryRouter><AdminProduto /></MemoryRouter>)
}

import AdminProduto from '@/admin/pages/AdminProduto'

describe('AdminProduto', () => {
  beforeEach(() => {
    vi.mocked(useAdminProdutoSegmentedFunnel).mockReturnValue({ data: mockFunnel, isLoading: false } as any)
    vi.mocked(useAdminProdutoFriction).mockReturnValue({ data: mockFriction, isLoading: false } as any)
    vi.mocked(useAdminProdutoFeatureAdoption).mockReturnValue({ data: mockAdoption, isLoading: false } as any)
    vi.mocked(useAdminProdutoTopEvents).mockReturnValue({ data: mockTopEvents, isLoading: false } as any)
  })

  it('renders funnel step labels', () => {
    renderPage()
    expect(screen.getAllByText('Cadastrou').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Onboarding').length).toBeGreaterThan(0)
  })

  it('renders friction severity badge for critical item', () => {
    renderPage()
    expect(screen.getByText('Abandono pós-1ª prova')).toBeInTheDocument()
  })

  it('renders feature adoption bars', () => {
    renderPage()
    expect(screen.getByText('Ver resultado')).toBeInTheDocument()
    expect(screen.getByText('Caderno de Erros')).toBeInTheDocument()
  })

  it('renders top event names', () => {
    renderPage()
    expect(screen.getByText('exam_started')).toBeInTheDocument()
  })
})
