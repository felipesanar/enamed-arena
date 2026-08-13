import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminPresencial')
vi.mock('@/admin/hooks/useAdminTentativas')
vi.mock('@/admin/services/adminApi')

import {
  useAdminPresencialSessions,
  useAdminPresencialSessionUpsert,
  useAdminPresencialQueue,
  useAdminPresencialLink,
  useAdminPresencialReassign,
  useAdminAccountEmailSearch,
  useAdminAccountAttempts,
} from '@/admin/hooks/useAdminPresencial'
import { useAdminSimuladoList } from '@/admin/hooks/useAdminTentativas'
import AdminPresencial from '@/admin/pages/AdminPresencial'

const mockSessions = [
  {
    id: 'sess-1',
    simulado_id: 'sim-1',
    simulado_title: 'ENAMED Simulado 7',
    code: 'sala-a',
    label: 'Sala A — Bloco 2',
    opens_at: '2026-08-19T12:00:00Z',
    closes_at: '2026-08-19T16:00:00Z',
    is_active: true,
    submissions_count: 10,
    linked_count: 8,
  },
]

const mockQueueRows = [
  {
    submission_id: 'sub-1',
    session_label: 'Sala A — Bloco 2',
    declared_name: 'Maria Souza',
    declared_email: 'maria@example.com',
    identification_path: 'name_suggestion',
    total_correct: 60,
    score_percentage: 72.5,
    created_at: '2026-08-19T13:00:00Z',
    ip_hash: 'abcdef1234567890',
    suggested_user_id: 'user-1',
    suggested_email: 'maria.souza@sanar.com',
    suggested_name: 'Maria de Souza',
  },
  {
    submission_id: 'sub-2',
    session_label: 'Sala A — Bloco 2',
    declared_name: 'João Silva',
    declared_email: 'joao@example.com',
    identification_path: 'unlinked',
    total_correct: 40,
    score_percentage: 50,
    created_at: '2026-08-19T13:05:00Z',
    ip_hash: null,
    suggested_user_id: null,
    suggested_email: null,
    suggested_name: null,
  },
]

function renderPage() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminPresencial />
    </MemoryRouter>,
  )
}

// jsdom não implementa ResizeObserver; o Switch (Radix) do formulário de
// sessão usa @radix-ui/react-use-size, que depende dele para medir o thumb.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('AdminPresencial', () => {
  beforeEach(() => {
    global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
    vi.mocked(useAdminPresencialSessions).mockReturnValue({ data: mockSessions, isLoading: false, isError: false } as any)
    vi.mocked(useAdminPresencialSessionUpsert).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminPresencialQueue).mockReturnValue({ data: mockQueueRows, isLoading: false, isError: false } as any)
    vi.mocked(useAdminPresencialLink).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminPresencialReassign).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
    vi.mocked(useAdminAccountEmailSearch).mockReturnValue({ data: [], isFetching: false } as any)
    vi.mocked(useAdminAccountAttempts).mockReturnValue({ data: [], isFetching: false } as any)
    vi.mocked(useAdminSimuladoList).mockReturnValue({ data: [{ id: 'sim-1', sequence_number: 7, title: 'ENAMED Simulado 7' }], isLoading: false } as any)
  })

  it('renders the sessions table with simulado, code, label and window', () => {
    renderPage()
    expect(screen.getByText('ENAMED Simulado 7')).toBeInTheDocument()
    expect(screen.getByText('sala-a')).toBeInTheDocument()
    // "Sala A — Bloco 2" também é o session_label das linhas da fila — mais de uma ocorrência é esperado.
    expect(screen.getAllByText('Sala A — Bloco 2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('8/10')).toBeInTheDocument()
  })

  it('opens the print dialog with the QR svg, the correct URL and the print-sheet id', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /imprimir qr da sala/i }))
    expect(screen.getByText('https://simulados.sanar.com.br/presencial/sala-a')).toBeInTheDocument()
    // Título aparece duas vezes: na tabela (linha) e no painel de impressão.
    expect(screen.getAllByText('Sala A — Bloco 2').length).toBeGreaterThanOrEqual(2)
    // O painel de impressão precisa deste id — é o alvo do CSS "@media print"
    // que esconde o resto da tela (sidebar/topbar/tabelas). O Dialog renderiza
    // via portal direto no <body>, por isso a busca é em document, não no
    // container do render().
    const printSheet = document.getElementById('presencial-print-sheet')
    expect(printSheet).not.toBeNull()
    expect(printSheet?.querySelector('svg')).not.toBeNull()
  })

  it('opens the create session dialog', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /nova sessão/i }))
    expect(screen.getByRole('heading', { name: 'Nova sessão' })).toBeInTheDocument()
  })

  it('renders the queue with declared name/email, identification path and ip hash', () => {
    renderPage()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sugestão por nome')).toBeInTheDocument()
    expect(screen.getByText('Seguiu sem conta')).toBeInTheDocument()
    expect(screen.getByText(/abcdef1234/)).toBeInTheDocument()
  })

  it('defaults the queue filter to "unlinked" (Pendentes)', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Pendentes' })).toHaveAttribute('aria-selected', 'true')
    expect(vi.mocked(useAdminPresencialQueue).mock.calls[0][0]).toBe('unlinked')
  })

  it('switches the queue filter to "all" when clicking Todas', () => {
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Todas' }))
    const calls = vi.mocked(useAdminPresencialQueue).mock.calls
    expect(calls.some(c => c[0] === 'all')).toBe(true)
  })

  it('shows "Vincular a esta conta" only when there is a suggested account', () => {
    renderPage()
    const vincular = screen.getAllByRole('button', { name: 'Vincular a esta conta' })
    expect(vincular).toHaveLength(1)
  })

  it('opens a confirmation with declared name/email and the target account before linking', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Vincular a esta conta' }))
    expect(screen.getByText(/vincular esta submissão\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Maria Souza — maria@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/Maria de Souza — maria.souza@sanar.com/)).toBeInTheDocument()
  })

  it('calls presencialLink with the suggested user id after confirming', () => {
    const mutate = vi.fn()
    vi.mocked(useAdminPresencialLink).mockReturnValue({ mutate, isPending: false } as any)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Vincular a esta conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(mutate).toHaveBeenCalledWith(
      { submissionId: 'sub-1', userId: 'user-1' },
      expect.anything(),
    )
  })

  it('opens the "escolher outra conta" dialog with an email search field', async () => {
    renderPage()
    const escolher = screen.getAllByRole('button', { name: 'Escolher outra conta' })[0]
    fireEvent.click(escolher)
    expect(screen.getByRole('heading', { name: 'Escolher outra conta' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar por e-mail…')).toBeInTheDocument()
  })

  it('opens the reassign tool from the queue header', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reatribuir tentativa/i }))
    expect(screen.getByRole('heading', { name: 'Reatribuir tentativa entre contas' })).toBeInTheDocument()
    expect(screen.getByText(/1\. Conta de origem/)).toBeInTheDocument()
  })

  it('shows empty state when the queue has no rows', () => {
    vi.mocked(useAdminPresencialQueue).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    expect(screen.getByText('Nenhuma submissão pendente')).toBeInTheDocument()
  })

  it('shows error state when the queue fails to load', () => {
    vi.mocked(useAdminPresencialQueue).mockReturnValue({ data: undefined, isLoading: false, isError: true } as any)
    renderPage()
    expect(screen.getByText(/não foi possível carregar a fila/i)).toBeInTheDocument()
  })

  it('shows empty state when there are no sessions', () => {
    vi.mocked(useAdminPresencialSessions).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    expect(screen.getByText('Nenhuma sessão presencial ainda')).toBeInTheDocument()
  })
})
