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

/** Abre a aba "Acesso e perfil" (onde vivem segmento, tour, exclusão e roles). */
function openAcessoTab() {
  fireEvent.click(screen.getByRole('button', { name: /^acesso e perfil$/i }))
}

import AdminUsuarioDetail from '@/admin/pages/AdminUsuarioDetail'

describe('AdminUsuarioDetail', () => {
  beforeEach(() => {
    setRoleMutate.mockClear()
    vi.mocked(useAdminUser).mockReturnValue({
      data: mockUser, isLoading: false, isError: false, refetch: vi.fn(),
    } as any)
    vi.mocked(useAdminUserAttempts).mockReturnValue({
      data: mockAttempts, isLoading: false, isError: false,
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
    expect(screen.getAllByText('Aluno PRO').length).toBeGreaterThan(0)
  })

  it('shows the back link to the users list', () => {
    renderDetail()
    expect(screen.getByText(/voltar para usuários/i)).toBeInTheDocument()
  })

  it('renders the four stat cards', () => {
    renderDetail()
    expect(screen.getByText('Desempenho médio')).toBeInTheDocument()
    expect(screen.getByText('74.2%')).toBeInTheDocument()
    expect(screen.getByText('Tentativas')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Melhor posição')).toBeInTheDocument()
    // Melhor posição = menor ranking_position com nota (23º) — aparece no card e na tabela
    expect(screen.getAllByText('23º').length).toBeGreaterThan(0)
    expect(screen.getByText('Última atividade')).toBeInTheDocument()
  })

  it('renders attempt history in the default tab', () => {
    renderDetail()
    expect(screen.getByText('ENAMED Abril 2026')).toBeInTheDocument()
    expect(screen.getByText('#12')).toBeInTheDocument()
    // nota arredondada para inteiro
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('shows an empty state when there are no attempts', () => {
    vi.mocked(useAdminUserAttempts).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderDetail()
    expect(screen.getByText(/nenhuma tentativa ainda/i)).toBeInTheDocument()
  })

  it('shows a skeleton while loading', () => {
    vi.mocked(useAdminUser).mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() } as any)
    renderDetail()
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument()
  })

  it('shows an error state with a retry action when loading fails', () => {
    const refetch = vi.fn()
    vi.mocked(useAdminUser).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as any)
    renderDetail()
    expect(screen.getByText(/não deu para carregar esta pessoa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(refetch).toHaveBeenCalled()
  })

  describe('Aba "Acesso e perfil"', () => {
    it('shows segment, tour and danger cards after switching tab', () => {
      renderDetail()
      openAcessoTab()
      expect(screen.getByText('Segmento')).toBeInTheDocument()
      expect(screen.getByText('Boas-vindas')).toBeInTheDocument()
      expect(screen.getByText('Reabrir tour')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^excluir conta$/i })).toBeInTheDocument()
    })

    it('opens the delete confirmation that requires typing EXCLUIR', () => {
      renderDetail()
      openAcessoTab()
      fireEvent.click(screen.getByRole('button', { name: /^excluir conta$/i }))
      expect(screen.getByText(/excluir conta de felipe matos/i)).toBeInTheDocument()
      expect(screen.getByText('EXCLUIR')).toBeInTheDocument()
    })
  })

  describe('Gerenciar acesso ao painel (roles)', () => {
    it('shows the roles panel when user has roles.manage', () => {
      renderDetail()
      openAcessoTab()
      expect(screen.getByText('Gerenciar acesso ao painel')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Editor de conteúdo')).toBeInTheDocument()
      expect(screen.getByText('Suporte')).toBeInTheDocument()
      expect(screen.getByText('Analista')).toBeInTheDocument()
    })

    it('checks granted roles and unchecks the rest', () => {
      renderDetail()
      openAcessoTab()
      const support = screen.getByRole('checkbox', { name: /suporte/i }) as HTMLInputElement
      const admin = screen.getByRole('checkbox', { name: /admin/i }) as HTMLInputElement
      expect(support.checked).toBe(true)
      expect(admin.checked).toBe(false)
    })

    it('hides the roles panel without roles.manage capability', () => {
      const caps = ALL_CAPABILITIES.filter(c => c !== 'roles.manage')
      render(
        <AdminAccessProvider roles={['support']} capabilities={caps}>
          {detailUi()}
        </AdminAccessProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: /^acesso e perfil$/i }))
      expect(screen.queryByText('Gerenciar acesso ao painel')).not.toBeInTheDocument()
      expect(screen.getByText(/acesso ao painel é restrito/i)).toBeInTheDocument()
    })

    it('toggling a checkbox triggers the role mutation', () => {
      renderDetail()
      openAcessoTab()
      fireEvent.click(screen.getByRole('checkbox', { name: /editor de conteúdo/i }))
      expect(setRoleMutate).toHaveBeenCalledWith(
        { userId: 'u1', role: 'content_editor', grant: true },
        expect.anything(),
      )
    })

    it('revokes a granted role on uncheck', () => {
      renderDetail()
      openAcessoTab()
      fireEvent.click(screen.getByRole('checkbox', { name: /suporte/i }))
      expect(setRoleMutate).toHaveBeenCalledWith(
        { userId: 'u1', role: 'support', grant: false },
        expect.anything(),
      )
    })
  })
})
