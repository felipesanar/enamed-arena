import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithAccess, ALL_CAPABILITIES } from './test-utils'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'

vi.mock('@/admin/hooks/useAdminUsuarios')
vi.mock('@/admin/services/adminApi')

import {
  useAdminUser,
  useAdminUserAttempts,
  useAdminAttemptQuestions,
  useAdminSetUserSegment,
  useAdminSetUserRole,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'
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
  roles: ['support'],
}

const mockAttempts = [
  {
    attempt_id: 'a1', simulado_id: 's1', sequence_number: 12,
    simulado_title: 'ENAMED Abril 2026', created_at: '2026-04-04T10:00:00Z',
    status: 'submitted', score_percentage: 71.5, ranking_position: 23,
    is_within_window: true,
  },
]

const mockAttemptQuestions = [
  {
    question_id: 'q1', question_number: 1, area: 'Pediatria', theme: 'Neonatologia',
    difficulty: 'media', question_text: 'Enunciado da questão 1', was_answered: true,
    is_correct: false, selected_label: 'A', selected_text: 'Alt A', correct_label: 'D',
    correct_text: 'Alt D', ai_suggested_reason: null, confidence: null,
  },
]

const setRoleMutate = vi.fn()

function detailUi(userId = 'u1') {
  return (
    <MemoryRouter initialEntries={[`/admin/usuarios/${userId}`]}>
      <Routes>
        <Route path="/admin/usuarios/:id" element={<AdminUsuarioDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderDetail(userId = 'u1') {
  return renderWithAccess(detailUi(userId))
}

import AdminUsuarioDetail from '@/admin/pages/AdminUsuarioDetail'

describe('AdminUsuarioDetail', () => {
  beforeEach(() => {
    setRoleMutate.mockClear()
    vi.mocked(useAdminUser).mockReturnValue({
      data: mockUser, isLoading: false, isError: false,
    } as any)
    vi.mocked(useAdminUserAttempts).mockReturnValue({
      data: mockAttempts, isLoading: false, isError: false,
    } as any)
    vi.mocked(useAdminAttemptQuestions).mockReturnValue({
      data: mockAttemptQuestions, isLoading: false, isError: false,
    } as any)
    vi.mocked(useAdminSetUserSegment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminSetUserRole).mockReturnValue({ mutate: setRoleMutate, isPending: false } as any)
    vi.mocked(useAdminResetUserOnboarding).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminDeleteUser).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
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

  it('opens the per-question drill-down when an attempt row is clicked', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /ver questões da tentativa #12/i }))
    // Dialog shows the per-question breakdown (selected vs correct labels)
    expect(screen.getByText(/Enunciado da questão 1/)).toBeInTheDocument()
    expect(screen.getByText(/Correta/)).toBeInTheDocument()
  })

  it('shows delete confirmation modal before deleting', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /^excluir$/i }))
    expect(screen.getByText(/confirmar exclusão/i)).toBeInTheDocument()
  })

  describe('Acesso ao painel (roles)', () => {
    it('shows the roles section when user has roles.manage', () => {
      renderDetail()
      expect(screen.getByText('Acesso ao painel')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Editor de conteúdo')).toBeInTheDocument()
      expect(screen.getByText('Suporte')).toBeInTheDocument()
      expect(screen.getByText('Analista')).toBeInTheDocument()
    })

    it('checks granted roles and unchecks the rest', () => {
      renderDetail()
      const support = screen.getByRole('checkbox', { name: /suporte/i }) as HTMLInputElement
      const admin = screen.getByRole('checkbox', { name: /admin/i }) as HTMLInputElement
      expect(support.checked).toBe(true)
      expect(admin.checked).toBe(false)
    })

    it('hides the roles section without roles.manage capability', () => {
      const caps = ALL_CAPABILITIES.filter(c => c !== 'roles.manage')
      render(
        <AdminAccessProvider roles={['support']} capabilities={caps}>
          {detailUi()}
        </AdminAccessProvider>,
      )
      expect(screen.queryByText('Acesso ao painel')).not.toBeInTheDocument()
    })

    it('toggling a checkbox triggers the role mutation', () => {
      renderDetail()
      fireEvent.click(screen.getByRole('checkbox', { name: /editor de conteúdo/i }))
      expect(setRoleMutate).toHaveBeenCalledWith(
        { userId: 'u1', role: 'content_editor', grant: true },
        expect.anything(),
      )
    })

    it('revokes a granted role on uncheck', () => {
      renderDetail()
      fireEvent.click(screen.getByRole('checkbox', { name: /suporte/i }))
      expect(setRoleMutate).toHaveBeenCalledWith(
        { userId: 'u1', role: 'support', grant: false },
        expect.anything(),
      )
    })
  })
})
