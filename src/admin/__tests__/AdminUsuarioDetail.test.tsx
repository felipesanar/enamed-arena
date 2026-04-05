import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('@/admin/hooks/useAdminUsuarios')
vi.mock('@/admin/services/adminApi')

import { useAdminUser, useAdminUserAttempts } from '@/admin/hooks/useAdminUsuarios'
import { adminApi } from '@/admin/services/adminApi'

const mockUser: Record<string, unknown> = {
  user_id: 'u1',
  full_name: 'Felipe Matos',
  email: 'felipe@sanar.com',
  avatar_url: null,
  segment: 'pro' as const,
  created_at: '2026-03-12T10:00:00Z',
  last_sign_in_at: '2026-04-04T08:00:00Z',
  specialty: 'Clínica Médica',
  target_institutions: ['USP', 'UNIFESP'],
  avg_score: 74.2,
  best_score: 88.0,
  last_score: 71.5,
  total_attempts: 8,
  last_finished_at: '2026-04-04T12:00:00Z',
  is_admin: false,
}

const mockAttempts = [
  {
    attempt_id: 'a1', simulado_id: 's1', sequence_number: 12,
    simulado_title: 'ENAMED Abril 2026', created_at: '2026-04-04T10:00:00Z',
    status: 'submitted', score_percentage: 71.5, ranking_position: 23,
  },
]

function renderDetail(userId = 'u1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/usuarios/${userId}`]}>
      <Routes>
        <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

import AdminUsuarioDetail from '@/admin/pages/AdminUsuarioDetail'

describe('AdminUsuarioDetail', () => {
  beforeEach(() => {
    vi.mocked(useAdminUser).mockReturnValue({
      data: mockUser, isLoading: false, isError: false,
    } as any)
    vi.mocked(useAdminUserAttempts).mockReturnValue({
      data: mockAttempts, isLoading: false, isError: false,
    } as any)
    vi.mocked(adminApi.setUserSegment).mockResolvedValue(undefined)
    vi.mocked(adminApi.setUserRole).mockResolvedValue(undefined)
    vi.mocked(adminApi.resetUserOnboarding).mockResolvedValue(undefined)
  })

  it('renders user name, email and segment', () => {
    renderDetail()
    expect(screen.getAllByText('Felipe Matos').length).toBeGreaterThan(0)
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getAllByText('PRO').length).toBeGreaterThan(0)
  })

  it('renders performance KPIs', () => {
    renderDetail()
    expect(screen.getByText('74.2%')).toBeInTheDocument()
    expect(screen.getByText('88.0%')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders onboarding specialty and institutions', () => {
    renderDetail()
    expect(screen.getByText('Clínica Médica')).toBeInTheDocument()
    expect(screen.getByText('USP')).toBeInTheDocument()
    expect(screen.getByText('UNIFESP')).toBeInTheDocument()
  })

  it('renders attempt history', () => {
    renderDetail()
    expect(screen.getByText('ENAMED Abril 2026')).toBeInTheDocument()
    expect(screen.getAllByText('71.5%').length).toBeGreaterThan(0)
    expect(screen.getByText('23º')).toBeInTheDocument()
  })

  it('shows delete confirmation modal before deleting', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /excluir/i }))
    expect(screen.getByText(/confirmar exclusão/i)).toBeInTheDocument()
  })
})
