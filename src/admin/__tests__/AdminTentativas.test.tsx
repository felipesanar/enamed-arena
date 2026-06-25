import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminTentativas')
vi.mock('@/admin/services/adminApi')

import {
  useAdminAttemptKpis,
  useAdminAttemptList,
  useAdminSimuladoList,
  useAdminCancelAttempt,
  useAdminDeleteAttempt,
} from '@/admin/hooks/useAdminTentativas'

const mockKpis = {
  total: 120, in_progress: 5, submitted: 100, expired: 15, offline_pending: 0,
  submitted_valid: 92, in_progress_valid: 4, offline_pending_valid: 0,
}

const mockRows = [
  {
    attempt_id: 'a1', user_id: 'u1', full_name: 'Felipe Matos', email: 'felipe@sanar.com',
    avatar_url: null as string | null, simulado_id: 's1', sequence_number: 12, simulado_title: 'ENAMED Abril',
    created_at: '2026-04-04T10:00:00Z', status: 'submitted', score_percentage: 71.5,
    ranking_position: 23, total_count: 120,
  },
  {
    attempt_id: 'a2', user_id: 'u2', full_name: 'Ana Silva', email: 'ana@gmail.com',
    avatar_url: null, simulado_id: 's1', sequence_number: 12, simulado_title: 'ENAMED Abril',
    created_at: '2026-04-04T11:00:00Z', status: 'in_progress', score_percentage: null,
    ranking_position: null, total_count: 120,
  },
]

function renderPage() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminTentativas />
    </MemoryRouter>
  )
}

import AdminTentativas from '@/admin/pages/AdminTentativas'

describe('AdminTentativas', () => {
  beforeEach(() => {
    vi.mocked(useAdminAttemptKpis).mockReturnValue({ data: mockKpis, isLoading: false, isError: false } as any)
    vi.mocked(useAdminAttemptList).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as any)
    vi.mocked(useAdminSimuladoList).mockReturnValue({ data: [], isLoading: false } as any)
    vi.mocked(useAdminCancelAttempt).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminDeleteAttempt).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  })

  it('renders KPI values', () => {
    renderPage()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('renders attempt rows with user names and emails', () => {
    renderPage()
    expect(screen.getByText('Felipe Matos')).toBeInTheDocument()
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('shows the segmented status filter with friendly labels', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Todas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Em andamento' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Concluídas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Offline/pendente' })).toBeInTheDocument()
  })

  it('renders the Offline/pendente KPI card and the "válidas" hint on Concluídas', () => {
    renderPage()
    // O card de offline tem o mesmo rótulo da aba — há dois nós com esse texto.
    expect(screen.getAllByText('Offline/pendente').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('92 válidas')).toBeInTheDocument()
  })

  it('filters by offline_pending when clicking the tab', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Offline/pendente' }))
    const calls = vi.mocked(useAdminAttemptList).mock.calls
    // o status é o 3º argumento posicional (search, simuladoId, status, days, page)
    expect(calls.some(c => c[2] === 'offline_pending')).toBe(true)
  })

  it('shows "Encerrar" only for in-progress rows', () => {
    renderPage()
    // Apenas a linha em andamento (Ana) ganha "Encerrar".
    const encerrar = screen.getAllByRole('button', { name: 'Encerrar' })
    expect(encerrar).toHaveLength(1)
  })

  it('shows "Excluir" for concluded/expired rows', () => {
    renderPage()
    // A linha concluída (Felipe) ganha "Excluir"; a em andamento não.
    const excluir = screen.getAllByRole('button', { name: 'Excluir' })
    expect(excluir).toHaveLength(1)
  })

  it('renders the fixed legend explaining Encerrar vs Excluir before any click', () => {
    renderPage()
    expect(screen.getByText(/finaliza a prova em andamento/i)).toBeInTheDocument()
    expect(screen.getByText(/apaga a tentativa e a nota do histórico/i)).toBeInTheDocument()
  })

  it('opens the encerrar confirmation when clicking Encerrar', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    expect(screen.getByText(/encerrar esta tentativa\?/i)).toBeInTheDocument()
  })

  it('opens the delete confirmation when clicking Excluir', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(screen.getByText(/excluir esta tentativa\?/i)).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useAdminAttemptList).mockReturnValue({ data: undefined, isLoading: true, isError: false } as any)
    const { container } = renderPage()
    expect(container.querySelector('.animate-\\[shimmer_1\\.4s_infinite\\]')).toBeInTheDocument()
    // Sem dados, a legenda não aparece durante o carregamento.
    expect(screen.queryByText(/finaliza a prova em andamento/i)).not.toBeInTheDocument()
  })

  it('shows empty state when there are no rows', () => {
    vi.mocked(useAdminAttemptList).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    expect(screen.getByText('Nenhuma tentativa encontrada')).toBeInTheDocument()
  })

  it('shows error state when the list fails to load', () => {
    vi.mocked(useAdminAttemptList).mockReturnValue({ data: undefined, isLoading: false, isError: true } as any)
    renderPage()
    expect(screen.getByText(/não foi possível carregar as tentativas/i)).toBeInTheDocument()
  })
})
