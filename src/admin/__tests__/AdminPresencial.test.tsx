import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminPresencial')
vi.mock('@/admin/hooks/useAdminTentativas')
vi.mock('@/admin/services/adminApi')
// `qrcode.react` está em package.json (dependência desta feature) mas ausente do
// node_modules compartilhado por junction entre worktrees — falta rodar `npm install`
// na raiz depois que os package.json dos agentes em paralelo forem consolidados.
// Sem este mock o Vite nem transforma o arquivo (erro de resolução de módulo, não
// relacionado ao código deste teste). Renderiza um <svg> real pra não quebrar o teste
// existente que confere `#presencial-print-sheet svg`. Remover quando o install rodar.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: Record<string, unknown>) => <svg data-testid="qr-svg-stub" {...props} />,
}))

import {
  useAdminPresencialSessions,
  useAdminPresencialSessionUpsert,
  useAdminPresencialQueue,
  useAdminPresencialLink,
  useAdminPresencialReassign,
  useAdminAccountEmailSearch,
  useAdminAccountAttempts,
  useAdminPresencialCadernos,
  useAdminPresencialCadernoVerify,
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
    caderno_code: 'v',
    caderno_label: 'Caderno 1',
    caderno_color: 'vermelho',
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
    caderno_code: null,
    caderno_label: null,
    caderno_color: null,
  },
]

const mockCadernos = [
  {
    id: 'cad-1',
    code: 'v',
    label: 'Caderno 1',
    color: 'vermelho',
    is_active: true,
    total_itens: 100,
    verification_ok: true,
    verification_problems: 0,
    derived_key: '1:B,2:C',
  },
  {
    id: 'cad-2',
    code: 'a',
    label: 'Caderno 2',
    color: 'azul',
    is_active: false,
    total_itens: 100,
    verification_ok: false,
    verification_problems: 2,
    derived_key: '1:?,2:D',
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
    vi.mocked(useAdminPresencialCadernos).mockReturnValue({ data: mockCadernos, isLoading: false, isError: false } as any)
    vi.mocked(useAdminPresencialCadernoVerify).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
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

  // ─── Cadernos do presencial (Vermelho / Azul) ───

  it('shows the caderno pill in the queue when the submission has one', () => {
    renderPage()
    expect(screen.getByText('Caderno 1 · Vermelho')).toBeInTheDocument()
  })

  it('shows a dash in the queue caderno column when the submission has none', () => {
    renderPage()
    // sub-2 (João Silva) não tem caderno — a linha inteira só tem um "—" candidato
    // nesta coluna; confirmamos que a pill de caderno não aparece pra ele junto
    // do nome dele em vez de checar o "—" isolado (aparece em várias colunas).
    const joaoRow = screen.getByText('João Silva').closest('div[class*="grid"]')
    expect(joaoRow).not.toBeNull()
    expect(joaoRow?.textContent).not.toContain('Caderno')
  })

  it('offers "— o aluno escolhe —" in the session form caderno selector', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /nova sessão/i }))
    const select = screen.getByLabelText('Caderno da sala') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: '— o aluno escolhe —' })).toBeInTheDocument()
  })

  it('lists the active cadernos as options in the session form (and marks inactive ones)', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /nova sessão/i }))
    // Caderno 1 (ativo, vermelho) aparece; Caderno 2 (inativo) só é listado se
    // já for o valor selecionado — numa sessão nova ele fica de fora por padrão.
    expect(screen.getByRole('option', { name: 'Caderno 1 · Vermelho' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Caderno 2/ })).not.toBeInTheDocument()
  })

  it('calls presencialSessionUpsert with caderno_id null when "o aluno escolhe" is kept', () => {
    const mutate = vi.fn()
    vi.mocked(useAdminPresencialSessionUpsert).mockReturnValue({ mutate, isPending: false } as any)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /nova sessão/i }))

    fireEvent.change(screen.getByLabelText('Simulado'), { target: { value: 'sim-1' } })
    fireEvent.change(screen.getByPlaceholderText('sala-a'), { target: { value: 'sala-b' } })
    fireEvent.change(screen.getByPlaceholderText('Sala A — Bloco 2'), { target: { value: 'Sala B' } })
    // "Abre em" / "Fecha em" não têm htmlFor ligado ao input (markup pré-existente) —
    // busca pelos dois campos datetime-local dentro do diálogo, na ordem em que aparecem.
    const dialog = screen.getByRole('dialog')
    const datetimeInputs = dialog.querySelectorAll('input[type="datetime-local"]')
    fireEvent.change(datetimeInputs[0], { target: { value: '2026-08-19T10:00' } })
    fireEvent.change(datetimeInputs[1], { target: { value: '2026-08-19T14:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Criar sessão' }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ caderno_id: null }),
      expect.anything(),
    )
  })

  it('renders the cadernos panel for the selected simulado with label, color, itens and verification summary', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Selecione o simulado para ver os cadernos'), {
      target: { value: 'sim-1' },
    })
    // Escopado à seção de cadernos — "Caderno 1 · Vermelho" também aparece na fila
    // (mockQueueRows tem sub-1 com o mesmo caderno) e não queremos ambiguidade.
    const section = within(screen.getByTestId('presencial-cadernos-section'))
    expect(section.getByText('Caderno 1 · Vermelho')).toBeInTheDocument()
    expect(section.getByText('Caderno 2 · Azul')).toBeInTheDocument()
    expect(section.getAllByText('100').length).toBe(2)
    expect(section.getByText('Ativo')).toBeInTheDocument()
    expect(section.getByText('Inativo')).toBeInTheDocument()
    expect(section.getByText('íntegra')).toBeInTheDocument()
    expect(section.getByText('2 pendências')).toBeInTheDocument()
    expect(section.getByText(/Gabarito derivado do mapa: 1:B,2:C/)).toBeInTheDocument()
    expect(section.getByText(/Gabarito derivado do mapa: 1:\?,2:D/)).toBeInTheDocument()
  })

  it('shows a prompt to pick a simulado before any cadernos load', () => {
    renderPage()
    expect(screen.getByText('Escolha um simulado para ver os cadernos')).toBeInTheDocument()
  })

  it('calls presencialCadernoVerify with the caderno id and the pasted key, then renders the result', () => {
    // `problems` vem do backend (verify_caderno_map) como strings já formatadas
    // e prontas para exibir — não como objetos {position, expected, found}.
    const mutate = vi.fn((_vars, opts) => {
      opts?.onSuccess?.({
        ok: false,
        derived_key: '1:B,2:D',
        problems: ['Posição 2: gabarito impresso diz C, mas o mapa do caderno produz D.'],
      })
    })
    vi.mocked(useAdminPresencialCadernoVerify).mockReturnValue({ mutate, isPending: false } as any)
    renderPage()
    fireEvent.change(screen.getByLabelText('Selecione o simulado para ver os cadernos'), {
      target: { value: 'sim-1' },
    })

    const textarea = screen.getByLabelText(/Gabarito impresso \(formato 1:B,2:C,\.\.\.\)/, { selector: '#caderno-key-cad-1' })
    fireEvent.change(textarea, { target: { value: '1:B,2:C' } })
    fireEvent.click(screen.getAllByRole('button', { name: /verificar/i })[0])

    expect(mutate).toHaveBeenCalledWith(
      { cadernoId: 'cad-1', key: '1:B,2:C' },
      expect.anything(),
    )
    expect(screen.getByText(/1 divergência encontrada/)).toBeInTheDocument()
    expect(screen.getByText('Posição 2: gabarito impresso diz C, mas o mapa do caderno produz D.')).toBeInTheDocument()
    expect(screen.getByText(/Gabarito derivado do mapa: 1:B,2:D/)).toBeInTheDocument()
  })

  it('does not call verify when the key textarea is empty', () => {
    const mutate = vi.fn()
    vi.mocked(useAdminPresencialCadernoVerify).mockReturnValue({ mutate, isPending: false } as any)
    renderPage()
    fireEvent.change(screen.getByLabelText('Selecione o simulado para ver os cadernos'), {
      target: { value: 'sim-1' },
    })
    const verifyButtons = screen.getAllByRole('button', { name: /verificar/i })
    expect(verifyButtons[0]).toBeDisabled()
    fireEvent.click(verifyButtons[0])
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows an empty state when the simulado has no cadernos', () => {
    vi.mocked(useAdminPresencialCadernos).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    fireEvent.change(screen.getByLabelText('Selecione o simulado para ver os cadernos'), {
      target: { value: 'sim-1' },
    })
    expect(screen.getByText('Nenhum caderno cadastrado para este simulado')).toBeInTheDocument()
  })

  it('shows an error state when the cadernos fail to load', () => {
    vi.mocked(useAdminPresencialCadernos).mockReturnValue({ data: undefined, isLoading: false, isError: true } as any)
    renderPage()
    fireEvent.change(screen.getByLabelText('Selecione o simulado para ver os cadernos'), {
      target: { value: 'sim-1' },
    })
    expect(screen.getByText(/não foi possível carregar os cadernos/i)).toBeInTheDocument()
  })
})
