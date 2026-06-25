import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

// Polyfills que o Radix exige e o jsdom não tem (abertura do menu de ações).
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

/** Abre um menu Radix pelo teclado (abertura confiável no jsdom). */
function openMenu(trigger: HTMLElement) {
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' })
}

vi.mock('@/admin/hooks/useAdminUsuarios')
import {
  useAdminUserList,
  useAdminResetUserOnboarding,
  useAdminDeleteUser,
} from '@/admin/hooks/useAdminUsuarios'

import AdminUsuarios from '@/admin/pages/AdminUsuarios'

const mockUsers: Record<string, unknown>[] = [
  {
    user_id: 'u1', full_name: 'Felipe Matos', email: 'felipe@sanar.com',
    avatar_url: null, segment: 'pro' as const, specialty: 'Clínica Médica',
    created_at: '2026-03-12T10:00:00Z', avg_score: 74.2, total_attempts: 8, total_count: 2,
  },
  {
    user_id: 'u2', full_name: 'Ana Silva', email: 'ana@gmail.com',
    avatar_url: null, segment: 'standard' as const, specialty: 'Pediatria',
    created_at: '2026-03-28T10:00:00Z', avg_score: 61.8, total_attempts: 0, total_count: 2,
  },
]

function renderList() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminUsuarios />
    </MemoryRouter>
  )
}

const mutationStub = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as any

describe('AdminUsuarios', () => {
  beforeEach(() => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: mockUsers, isLoading: false, isError: false, refetch: vi.fn(),
    } as any)
    vi.mocked(useAdminResetUserOnboarding).mockReturnValue(mutationStub)
    vi.mocked(useAdminDeleteUser).mockReturnValue(mutationStub)
  })

  it('renders the page header and export action', () => {
    renderList()
    expect(screen.getByRole('heading', { name: 'Usuários' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar lista' })).toBeInTheDocument()
  })

  it('renders the four summary cards with the spec labels', () => {
    renderList()
    expect(screen.getByText('Total')).toBeInTheDocument()
    // Card PRO mantém o rótulo longo "Aluno PRO" (também é o badge da linha): getAllByText.
    expect(screen.getAllByText('Aluno PRO').length).toBeGreaterThan(0)
    // Card do segmento standard usa a forma curta "SanarFlix" (spec README §2 + .dc.html).
    // Aparece também na pílula da toolbar, então usa getAllByText.
    expect(screen.getAllByText('SanarFlix').length).toBeGreaterThan(0)
    expect(screen.getByText('Novos (7 dias)')).toBeInTheDocument()
  })

  it('renders user names and emails', () => {
    renderList()
    expect(screen.getByText('Felipe Matos')).toBeInTheDocument()
    expect(screen.getByText('felipe@sanar.com')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  it('shows segment badges with friendly labels', () => {
    renderList()
    // Os rótulos aparecem em mais de um lugar (card, pílula, badge da linha).
    expect(screen.getAllByText('Aluno PRO').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aluno SanarFlix').length).toBeGreaterThan(0)
  })

  it('shows "sem tentativas" when the user has no attempts', () => {
    renderList()
    expect(screen.getByText('sem tentativas')).toBeInTheDocument()
  })

  it('shows loading skeleton rows when isLoading', () => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: undefined, isLoading: true, isError: false, refetch: vi.fn(),
    } as any)
    const { container } = renderList()
    expect(container.querySelector('[data-skeleton-row]')).toBeInTheDocument()
  })

  it('shows an error state with a retry button when isError', () => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch: vi.fn(),
    } as any)
    renderList()
    expect(screen.getByText('Não foi possível carregar os usuários')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('shows "Ninguém encontrado" with clear-search when a search returns nothing', () => {
    vi.useFakeTimers()
    try {
      vi.mocked(useAdminUserList).mockReturnValue({
        data: [], isLoading: false, isError: false, refetch: vi.fn(),
      } as any)
      renderList()
      // Digita na busca; o estado vazio só sabe que há busca ativa após o debounce.
      fireEvent.change(screen.getByLabelText('Buscar por nome ou e-mail'), { target: { value: 'zzz' } })
      act(() => { vi.advanceTimersByTime(350) })
      expect(screen.getByText('Ninguém encontrado')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the empty (no users yet) state with no active search', () => {
    vi.mocked(useAdminUserList).mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: vi.fn(),
    } as any)
    renderList()
    expect(screen.getByText('Ninguém por aqui ainda')).toBeInTheDocument()
  })

  it('filter pills use the short segment labels from the spec', () => {
    renderList()
    const group = screen.getByRole('group', { name: 'Filtrar por segmento' })
    expect(within(group).getByRole('button', { name: 'Todos' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Visitante' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'SanarFlix' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'PRO' })).toBeInTheDocument()
  })

  it('filter pills call the hook with the correct segment', () => {
    renderList()
    const group = screen.getByRole('group', { name: 'Filtrar por segmento' })
    fireEvent.click(within(group).getByRole('button', { name: 'PRO' }))
    expect(vi.mocked(useAdminUserList)).toHaveBeenCalledWith(
      expect.anything(), 'pro', expect.anything()
    )
  })

  it('opens the action menu with named actions', () => {
    renderList()
    openMenu(screen.getByRole('button', { name: 'Ações para Felipe Matos' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Ver perfil')).toBeInTheDocument()
    expect(within(menu).getByText('Reabrir tour')).toBeInTheDocument()
    expect(within(menu).getByText('Excluir conta')).toBeInTheDocument()
  })

  it('opens the delete confirmation dialog from the action menu', () => {
    renderList()
    openMenu(screen.getByRole('button', { name: 'Ações para Felipe Matos' }))
    fireEvent.click(within(screen.getByRole('menu')).getByText('Excluir conta'))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Excluir conta de Felipe Matos/)).toBeInTheDocument()
  })
})
