import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminTentativas')
vi.mock('@/admin/services/adminApi')

import {
  useAdminAttemptKpis,
  useAdminAttemptList,
  useAdminSimuladoList,
  useAdminCancelAttempt,
  useAdminDeleteAttempt,
} from '@/admin/hooks/useAdminTentativas'
import { adminApi } from '@/admin/services/adminApi'

const mockKpis = { total: 120, in_progress: 5, submitted: 100, expired: 15 }

const mockRows = [
  {
    attempt_id: 'a1', user_id: 'u1', full_name: 'Felipe Matos', email: 'felipe@sanar.com',
    avatar_url: null, simulado_id: 's1', sequence_number: 12, simulado_title: 'ENAMED Abril',
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
  return render(
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

  it('shows cancel button only for in_progress rows', () => {
    renderPage()
    const cancelBtns = screen.queryAllByRole('button', { name: /cancelar/i })
    expect(cancelBtns).toHaveLength(1)
  })

  it('shows delete confirmation dialog when delete button clicked', () => {
    renderPage()
    const deleteBtn = screen.getAllByRole('button', { name: /excluir/i })[0]
    fireEvent.click(deleteBtn)
    expect(screen.getByText(/confirmar exclusão/i)).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useAdminAttemptList).mockReturnValue({ data: undefined, isLoading: true, isError: false } as any)
    const { container } = renderPage()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
