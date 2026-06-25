import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminAnalytics')
vi.mock('@/admin/components/ui/AdminTrendChart', (): Record<string, unknown> => ({
  AdminTrendChart: (): null => null,
}))

import {
  useAdminAnalyticsFunnel,
  useAdminAnalyticsTimeseries,
  useAdminAnalyticsSources,
  useAdminAnalyticsTimeToConvert,
} from '@/admin/hooks/useAdminAnalytics'

// Funil reestruturado: 5 passos, sem landing; primeiro passo (Cadastrou-se) sem conversão de origem.
const mockFunnel = [
  { step_order: 1, step_label: 'Cadastrou-se',           user_count: 2800, conversion_from_prev: null, insufficient_data: false },
  { step_order: 2, step_label: 'Concluiu onboarding',    user_count: 2000, conversion_from_prev: 71, insufficient_data: false },
  { step_order: 3, step_label: 'Iniciou prova',          user_count: 1400, conversion_from_prev: 70, insufficient_data: false },
  { step_order: 4, step_label: 'Submeteu prova válida',  user_count: 1100, conversion_from_prev: 79, insufficient_data: false },
  { step_order: 5, step_label: 'Retornou (2+ provas)',   user_count: 450,  conversion_from_prev: 41, insufficient_data: false },
]

const mockTimeseries = [
  { week_start: '2026-03-23', new_users: 80,  first_exams: 55, started_attempts: 70 },
  { week_start: '2026-03-30', new_users: 110, first_exams: 70, started_attempts: 95 },
]

const mockSources = [
  { utm_source: 'organic',   user_count: 1900, signup_conv_pct: 68 },
  { utm_source: 'instagram', user_count: 315,  signup_conv_pct: 11 },
]

const mockTtc = {
  landing_to_signup_min: 2,
  signup_to_onboarding_min: 4,
  onboarding_to_first_exam_days: 3.2,
  first_to_second_exam_days: 12.4,
  landing_to_signup_n: 12,
  landing_to_signup_insufficient: false,
  first_to_second_exam_days_p90: 20.0,
  first_to_second_exam_n: 8,
}

function renderPage() {
  return renderWithAccess(<MemoryRouter><AdminAnalytics /></MemoryRouter>)
}

import AdminAnalytics from '@/admin/pages/AdminAnalytics'

describe('AdminAnalytics', () => {
  beforeEach(() => {
    vi.mocked(useAdminAnalyticsFunnel).mockReturnValue({ data: mockFunnel, isLoading: false } as any)
    vi.mocked(useAdminAnalyticsTimeseries).mockReturnValue({ data: mockTimeseries, isLoading: false } as any)
    vi.mocked(useAdminAnalyticsSources).mockReturnValue({ data: mockSources, isLoading: false } as any)
    vi.mocked(useAdminAnalyticsTimeToConvert).mockReturnValue({ data: mockTtc, isLoading: false } as any)
  })

  it('renders the restructured funnel step labels (no landing step)', () => {
    renderPage()
    expect(screen.queryByText('Visitou landing')).not.toBeInTheDocument()
    expect(screen.getByText('Cadastrou-se')).toBeInTheDocument()
    expect(screen.getByText('Submeteu prova válida')).toBeInTheDocument()
    expect(screen.getByText('Retornou (2+ provas)')).toBeInTheDocument()
  })

  it('renders utm source rows', () => {
    renderPage()
    expect(screen.getByText('organic')).toBeInTheDocument()
    expect(screen.getByText('instagram')).toBeInTheDocument()
  })

  it('renders time-to-convert values', () => {
    renderPage()
    expect(screen.getByText('2 min')).toBeInTheDocument()
    expect(screen.getByText('p50 12.4d · p90 20d')).toBeInTheDocument()
  })

  it('period pill change updates hooks with new days param', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }))
    expect(vi.mocked(useAdminAnalyticsFunnel)).toHaveBeenCalledWith(7)
  })
})
