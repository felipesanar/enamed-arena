import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminDashboard')
vi.mock('@/admin/hooks/useAdminAuth')
vi.mock('@/admin/services/adminApi')

import {
  useAdminDashboardKpis,
  useAdminEventsTimeseries,
  useAdminSimuladoEngagement,
  useAdminLiveSignals,
} from '@/admin/hooks/useAdminDashboard'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'
import { AdminPeriodProvider } from '@/admin/contexts/AdminPeriodContext'
import AdminDashboard from '@/admin/pages/AdminDashboard'

const mockKpis = {
  total_users: 12480,
  new_users: 184,
  new_users_prev: 170,
  exams_started: 2140,
  exams_started_prev: 1904,
  completion_rate: 74.1,
  completion_rate_prev: 76.4,
  avg_score: 68.9,
  avg_score_prev: 68.9,
  activation_rate: 41.2,
  activation_rate_prev: 39.0,
}

const mockTimeseries = [
  { day: '2026-06-18', new_users: 10, exams_started: 58, exams_completed: 40 },
  { day: '2026-06-19', new_users: 12, exams_started: 72, exams_completed: 50 },
  { day: '2026-06-20', new_users: 8, exams_started: 64, exams_completed: 41 },
  { day: '2026-06-21', new_users: 15, exams_started: 90, exams_completed: 70 },
  { day: '2026-06-22', new_users: 11, exams_started: 78, exams_completed: 55 },
  { day: '2026-06-23', new_users: 9, exams_started: 46, exams_completed: 30 },
  { day: '2026-06-24', new_users: 14, exams_started: 52, exams_completed: 35 },
]

const mockEngagement = [
  {
    simulado_id: 's1', sequence_number: 12, title: 'Clínica Médica',
    participants: 31, completion_rate: 80, avg_score: 70, abandonment_rate: 10,
  },
  {
    simulado_id: 's2', sequence_number: 11, title: 'Cirurgia Geral',
    participants: 16, completion_rate: 20, avg_score: 55, abandonment_rate: 52,
  },
]

const mockLive = { online_last_15min: 120, active_exams: 47, open_tickets: 0 }

function setHook(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAdminDashboardKpis).mockReturnValue({
    data: mockKpis, isLoading: false, isError: false, refetch: vi.fn(),
    ...(overrides.kpis as object ?? {}),
  } as any)
  vi.mocked(useAdminEventsTimeseries).mockReturnValue({
    data: mockTimeseries, isLoading: false, isError: false, refetch: vi.fn(),
    ...(overrides.timeseries as object ?? {}),
  } as any)
  vi.mocked(useAdminSimuladoEngagement).mockReturnValue({
    data: mockEngagement, isLoading: false, isError: false, refetch: vi.fn(),
    ...(overrides.engagement as object ?? {}),
  } as any)
  vi.mocked(useAdminLiveSignals).mockReturnValue({
    data: mockLive, isLoading: false, isError: false, refetch: vi.fn(),
    ...(overrides.live as object ?? {}),
  } as any)
}

function renderPage() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminPeriodProvider>
        <AdminDashboard />
      </AdminPeriodProvider>
    </MemoryRouter>,
  )
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(useAdminAuth).mockReturnValue({
      user: { user_metadata: { full_name: 'Felipe Souza' }, email: 'felipe@sanar.com' },
    } as any)
    setHook()
  })

  it('greets the operator by first name', () => {
    renderPage()
    // saudação varia com o horário; o nome é estável
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Felipe')
  })

  it('shows the four KPIs', () => {
    renderPage()
    expect(screen.getByText('Tentativas (7d)')).toBeInTheDocument()
    expect(screen.getByText('Taxa de conclusão')).toBeInTheDocument()
    expect(screen.getByText('Nota média')).toBeInTheDocument()
    expect(screen.getByText('Novos alunos')).toBeInTheDocument()
    expect(screen.getByText('2.140')).toBeInTheDocument()
    expect(screen.getByText('74,1%')).toBeInTheDocument()
  })

  it('shows a stable label when a metric did not move', () => {
    renderPage()
    // Nota média 68,9 vs 68,9 -> estável
    expect(screen.getByText('estável')).toBeInTheDocument()
  })

  it('renders the "Precisa de atenção" block with derived items', () => {
    renderPage()
    expect(screen.getByText('Precisa de atenção')).toBeInTheDocument()
    // s2 tem abandono 52% (>=40) e conclusão 20% com 16 participantes (<30 e >=5)
    expect(screen.getByText(/desistindo no meio/i)).toBeInTheDocument()
    expect(screen.getByText(/conclusão abaixo de 30%/i)).toBeInTheDocument()
  })

  it('shows "nada pendente" when there is nothing to act on', () => {
    setHook({ engagement: { data: [] } })
    renderPage()
    expect(screen.getByText(/nada pendente agora/i)).toBeInTheDocument()
  })

  it('renders the live "Agora" panel with the live count', () => {
    renderPage()
    expect(screen.getByText('Agora')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('pessoas fazendo prova')).toBeInTheDocument()
  })

  it('falls back gracefully when nobody is in an exam', () => {
    setHook({ live: { data: { online_last_15min: 8, active_exams: 0, open_tickets: 0 } } })
    renderPage()
    expect(screen.getByText(/ninguém em prova neste momento/i)).toBeInTheDocument()
  })

  it('switches period when a segmented option is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '30 dias' }))
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Tentativas (30d)')).toBeInTheDocument()
  })

  it('renders the attempts-per-day chart heading', () => {
    renderPage()
    expect(screen.getByText('Tentativas por dia')).toBeInTheDocument()
  })

  it('shows a retry affordance when KPIs fail to load', () => {
    setHook({ kpis: { data: undefined, isError: true } })
    renderPage()
    expect(screen.getByText(/não deu para carregar os indicadores/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument()
  })

  it('renders loading skeletons without crashing', () => {
    setHook({
      kpis: { data: undefined, isLoading: true },
      timeseries: { data: undefined, isLoading: true },
      engagement: { data: undefined, isLoading: true },
      live: { data: undefined, isLoading: true },
    })
    const { container } = renderPage()
    expect(container.querySelector('.animate-\\[shimmer_1\\.4s_infinite\\]')).toBeTruthy()
  })
})
