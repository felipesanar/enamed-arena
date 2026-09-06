import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AnswerSheetPage from './AnswerSheetPage'

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a,
         transition: _tr, exit: _e, ...rest }: any) =>
        (({ div: <div {...rest}>{children}</div> } as any)[tag] ?? <div {...rest}>{children}</div>),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// ── Analytics mock (defensivo — offlineApi é mockado, então não roda) ─────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

// ── react-router-dom — mantém MemoryRouter real, stub do useNavigate ──────────
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ── Toast mock ────────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
import { toast } from '@/hooks/use-toast'

// ── Hooks / serviços ────────────────────────────────────────────────────────
vi.mock('@/hooks/useSimuladoDetail')
vi.mock('@/hooks/useOfflineAttempt')
vi.mock('@/services/offlineApi', () => ({
  offlineApi: { submitOfflineAnswers: vi.fn() },
}))
vi.mock('@/services/cadernoApi', () => ({
  cadernoApi: {
    listActiveCadernos: vi.fn(),
    getCadernoSkeleton: vi.fn(),
    setAttemptCaderno: vi.fn(),
  },
}))

import { useSimuladoDetail } from '@/hooks/useSimuladoDetail'
import { useOfflineAttempt } from '@/hooks/useOfflineAttempt'
import { offlineApi } from '@/services/offlineApi'
import { cadernoApi } from '@/services/cadernoApi'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeQuestion = (n: number) => ({
  id: `q${n}`,
  number: n,
  text: `Texto da questão ${n}`,
  options: [
    { id: `q${n}a`, label: 'A', text: 'Alternativa A' },
    { id: `q${n}b`, label: 'B', text: 'Alternativa B' },
    { id: `q${n}c`, label: 'C', text: 'Alternativa C' },
    { id: `q${n}d`, label: 'D', text: 'Alternativa D' },
  ],
})

const mockQuestions = [makeQuestion(1), makeQuestion(2), makeQuestion(3)]

const baseSimulado = { id: 'sim-1', slug: 'enamed-2025-1', title: 'ENAMED 2025.1' }

const baseAttempt = {
  id: 'att-1',
  simulado_id: 'sim-1',
  simulado_slug: 'enamed-2025-1',
  started_at: '2026-04-01T08:00:00Z',
  effective_deadline: '2026-04-01T13:00:00Z',
  status: 'offline_pending',
}

const mockClearAttempt = vi.fn()

// Cadernos do caderno-2 (Azul): mesmas 3 questões naturais, ORDEM E OPÇÕES
// diferentes — a posição 1 do caderno aponta pra questão natural 3 (com uma
// alternativa correta diferente da "A" natural), justamente para o teste (b)
// poder provar que a grade usa o option_id do ESQUELETO, não o da questão 1
// natural.
const cadernoAzulSkeleton = [
  { question_id: 'q3', number: 1, options: [
    { id: 'q3-caderno-a', label: 'A' },
    { id: 'q3-caderno-b', label: 'B' },
    { id: 'q3-caderno-c', label: 'C' },
    { id: 'q3-caderno-d', label: 'D' },
  ] },
  { question_id: 'q1', number: 2, options: [
    { id: 'q1-caderno-a', label: 'A' },
    { id: 'q1-caderno-b', label: 'B' },
    { id: 'q1-caderno-c', label: 'C' },
    { id: 'q1-caderno-d', label: 'D' },
  ] },
  { question_id: 'q2', number: 3, options: [
    { id: 'q2-caderno-a', label: 'A' },
    { id: 'q2-caderno-b', label: 'B' },
    { id: 'q2-caderno-c', label: 'C' },
    { id: 'q2-caderno-d', label: 'D' },
  ] },
]

const twoCadernos = [
  { code: 'caderno-1', label: 'Caderno 1', color: 'vermelho' as const },
  { code: 'caderno-2', label: 'Caderno 2', color: 'azul' as const },
]

function setup(
  {
    simulado = baseSimulado as any,
    questions = mockQuestions as any,
    loading = false,
    activeAttempt = baseAttempt as any,
    cadernos = [] as any[],
  } = {},
) {
  vi.mocked(useSimuladoDetail).mockReturnValue({ simulado, questions, loading } as any)
  vi.mocked(useOfflineAttempt).mockReturnValue({
    activeAttempt,
    clearAttempt: mockClearAttempt,
    invalidate: vi.fn(),
  } as any)
  vi.mocked(cadernoApi.listActiveCadernos).mockResolvedValue(cadernos as any)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/simulados/sim-1/gabarito']}>
      <Routes>
        <Route path="/simulados/:id/gabarito" element={<AnswerSheetPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// Renderiza e espera a busca (assíncrona) de `list_active_cadernos` resolver
// e a grade normal aparecer — necessário em todo teste que não é sobre o
// próprio fluxo de cadernos, já que a Tela 0 (ou a grade) só aparece depois
// desse round-trip.
async function renderPageReady() {
  const utils = renderPage()
  await screen.findByRole('button', { name: /enviar gabarito/i })
  return utils
}

// Clica na alternativa `label` da questão `number`.
function selectAnswer(number: number, label: string) {
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`Questão ${number} .*alternativa ${label}`) }),
  )
}

// Responde todas as questões com a alternativa A.
function answerAll() {
  mockQuestions.forEach(q => selectAnswer(q.number, 'A'))
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('AnswerSheetPage — loading', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra o header e nenhum botão de envio enquanto carrega', () => {
    setup({ loading: true })
    renderPage()
    expect(screen.getByRole('heading', { name: /gabarito offline/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar gabarito/i })).toBeNull()
  })
})

describe('AnswerSheetPage — estados de erro', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra "Simulado não encontrado" quando o simulado é nulo', () => {
    setup({ simulado: null })
    renderPage()
    expect(screen.getByText(/simulado não encontrado/i)).toBeInTheDocument()
  })

  it('mostra "Simulado não encontrado" quando não há questões', async () => {
    setup({ questions: [] })
    renderPage()
    expect(await screen.findByText(/simulado não encontrado/i)).toBeInTheDocument()
  })

  it('mostra "Tentativa offline não encontrada" quando o attempt é de outro simulado', async () => {
    setup({ activeAttempt: { ...baseAttempt, simulado_id: 'outro-sim' } })
    renderPage()
    expect(await screen.findByText(/tentativa offline não encontrada/i)).toBeInTheDocument()
  })
})

describe('AnswerSheetPage — renderização do gabarito', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('renderiza as bolhas A/B/C/D de cada questão', async () => {
    await renderPageReady()
    // 3 questões × 4 alternativas = 12 bolhas
    expect(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Questão 3 .*alternativa D/ })).toBeInTheDocument()
  })

  it('mostra o título do simulado no subtítulo', async () => {
    await renderPageReady()
    expect(screen.getByText(/ENAMED 2025\.1/)).toBeInTheDocument()
  })

  it('inicia com o botão de envio desabilitado (nenhuma respondida)', async () => {
    await renderPageReady()
    expect(screen.getByRole('button', { name: /enviar gabarito/i })).toBeDisabled()
  })

  it('não mostra aviso de incompleto antes de qualquer resposta', async () => {
    await renderPageReady()
    expect(screen.queryByText(/sem resposta/i)).toBeNull()
  })
})

describe('AnswerSheetPage — seleção de respostas', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('marca a bolha selecionada (aria-pressed) e deixa as demais em branco', async () => {
    await renderPageReady()
    selectAnswer(1, 'B')

    const selected = screen.getByRole('button', { name: /Questão 1 .*alternativa B/ })
    const other = screen.getByRole('button', { name: /Questão 1 .*alternativa A/ })
    const skipped = screen.getByRole('button', { name: /Questão 2 .*alternativa A/ })

    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(skipped).toHaveAttribute('aria-pressed', 'false')
  })

  it('mostra aviso de questões faltantes após responder parcialmente', async () => {
    await renderPageReady()
    selectAnswer(1, 'A')
    // 1 de 3 respondidas → faltam 2
    expect(screen.getByText(/faltam 2 quest/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar gabarito/i })).toBeDisabled()
  })

  it('habilita o envio e mostra "Todas respondidas" quando o gabarito está completo', async () => {
    await renderPageReady()
    answerAll()
    expect(screen.getByText(/todas respondidas/i)).toBeInTheDocument()
    expect(screen.queryByText(/sem resposta/i)).toBeNull()
    expect(screen.getByRole('button', { name: /enviar gabarito/i })).not.toBeDisabled()
  })
})

describe('AnswerSheetPage — envio do gabarito', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
    vi.mocked(offlineApi.submitOfflineAnswers).mockResolvedValue({
      attempt_id: 'att-1',
      is_within_window: true,
    })
  })

  it('abre o modal de confirmação ao clicar em "Enviar gabarito"', async () => {
    await renderPageReady()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    expect(screen.getByText(/confirmar envio\?/i)).toBeInTheDocument()
  })

  it('submete as respostas, limpa o attempt e navega de volta ao simulado', async () => {
    await renderPageReady()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(offlineApi.submitOfflineAnswers).toHaveBeenCalledWith('att-1', [
        { question_id: 'q1', selected_option_id: 'q1a' },
        { question_id: 'q2', selected_option_id: 'q2a' },
        { question_id: 'q3', selected_option_id: 'q3a' },
      ])
    })

    expect(mockClearAttempt).toHaveBeenCalled()
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/simulados/enamed-2025-1')
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Gabarito enviado!' }),
    )
  })

  it('mostra toast de fora-da-janela quando is_within_window é falso', async () => {
    vi.mocked(offlineApi.submitOfflineAnswers).mockResolvedValue({
      attempt_id: 'att-1',
      is_within_window: false,
    })
    await renderPageReady()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Gabarito enviado' }),
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith('/simulados/enamed-2025-1')
  })

  it('alerta "Sessão expirada" e não navega quando não há attempt ativo', async () => {
    setup({ activeAttempt: null })
    await renderPageReady()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sessão expirada', variant: 'destructive' }),
      )
    })
    expect(offlineApi.submitOfflineAnswers).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ── Fluxo de cadernos (v2 — presencial logado) ─────────────────────────────
describe('AnswerSheetPage — fluxo de cadernos: Tela 0', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sem cadernos ativos, o fluxo de hoje segue igual (byte-idêntico) — sem Tela 0', async () => {
    setup({ cadernos: [] })
    await renderPageReady()
    expect(screen.queryByRole('heading', { name: /qual caderno você recebeu/i })).toBeNull()
    // Grade natural, na ordem das questões — nenhuma chamada às RPCs de caderno.
    expect(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ })).toBeInTheDocument()
    expect(cadernoApi.getCadernoSkeleton).not.toHaveBeenCalled()
    expect(cadernoApi.setAttemptCaderno).not.toHaveBeenCalled()
  })

  it('com 2 cadernos ativos, mostra a Tela 0 antes da grade', async () => {
    setup({ cadernos: twoCadernos })
    renderPage()

    expect(
      await screen.findByRole('heading', { name: /qual caderno você recebeu/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Caderno 1, cor Vermelho/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Caderno 2, cor Azul/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar gabarito/i })).toBeNull()
  })
})

describe('AnswerSheetPage — fluxo de cadernos: grade na ordem do caderno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup({ cadernos: twoCadernos })
    vi.mocked(cadernoApi.setAttemptCaderno).mockResolvedValue(undefined)
    vi.mocked(cadernoApi.getCadernoSkeleton).mockResolvedValue(cadernoAzulSkeleton as any)
    vi.mocked(offlineApi.submitOfflineAnswers).mockResolvedValue({
      attempt_id: 'att-1',
      is_within_window: true,
    })
  })

  it('ao escolher o caderno, chama set_attempt_caderno_guarded e get_caderno_skeleton', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 2, cor Azul/i }))

    await waitFor(() => {
      expect(cadernoApi.setAttemptCaderno).toHaveBeenCalledWith('att-1', 'caderno-2')
    })
    expect(cadernoApi.getCadernoSkeleton).toHaveBeenCalledWith('sim-1', 'caderno-2')
  })

  it('a bolha da posição 1 manda o option_id do ESQUELETO do caderno — não o da questão 1 natural', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 2, cor Azul/i }))

    // Posição 1 do caderno Azul aponta pra questão natural q3 (não q1) —
    // marcar "Questão 1 / alternativa A" na tela precisa mandar o option_id
    // REAL do esqueleto (q3-caderno-a), nunca o da questão 1 natural (q1a).
    await screen.findByRole('button', { name: /Questão 1 .*alternativa A/ })
    answerAll()

    // Confere já aqui, antes do envio, que a bolha da posição 1 ficou marcada.
    expect(
      screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(offlineApi.submitOfflineAnswers).toHaveBeenCalledWith('att-1', [
        { question_id: 'q3', selected_option_id: 'q3-caderno-a' },
        { question_id: 'q1', selected_option_id: 'q1-caderno-a' },
        { question_id: 'q2', selected_option_id: 'q2-caderno-a' },
      ])
    })
  })

  it('a faixa do caderno e o modal de confirmação citam o caderno escolhido', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 2, cor Azul/i }))
    await screen.findByRole('button', { name: /Questão 1 .*alternativa A/ })

    // Faixa sticky no topo.
    expect(screen.getByRole('status')).toHaveTextContent(/Caderno 2\s*·\s*Azul/)

    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/Caderno 2\s*·\s*Azul/)
    expect(dialog).toHaveTextContent(/confira se é o caderno na sua mesa/i)
  })
})

describe('AnswerSheetPage — fluxo de cadernos: esqueleto indisponível', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup({ cadernos: twoCadernos })
    vi.mocked(cadernoApi.setAttemptCaderno).mockResolvedValue(undefined)
  })

  it('esqueleto vazio (0 linhas) mostra o erro "Caderno indisponível" e NÃO renderiza a grade', async () => {
    vi.mocked(cadernoApi.getCadernoSkeleton).mockResolvedValue([])
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 1, cor Vermelho/i }))

    expect(await screen.findByText(/caderno indisponível/i)).toBeInTheDocument()
    expect(screen.getByText(/chame o fiscal/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar gabarito/i })).toBeNull()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('falha ao buscar o esqueleto também mostra o erro e não a grade natural', async () => {
    vi.mocked(cadernoApi.getCadernoSkeleton).mockRejectedValue(new Error('network error'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 1, cor Vermelho/i }))

    expect(await screen.findByText(/caderno indisponível/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar gabarito/i })).toBeNull()
  })
})

describe('AnswerSheetPage — fluxo de cadernos: trocar de caderno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup({ cadernos: twoCadernos })
    vi.mocked(cadernoApi.setAttemptCaderno).mockResolvedValue(undefined)
    vi.mocked(cadernoApi.getCadernoSkeleton).mockResolvedValue(cadernoAzulSkeleton as any)
  })

  it('trocar de caderno com marcações pede confirmação, apaga tudo e volta pra Tela 0', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 2, cor Azul/i }))
    await screen.findByRole('button', { name: /Questão 1 .*alternativa A/ })
    selectAnswer(1, 'A')

    fireEvent.click(screen.getByRole('button', { name: /não é este caderno/i }))
    expect(screen.getByText(/trocar de caderno\?/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /apagar e trocar/i }))

    // Volta pra Tela 0.
    expect(
      await screen.findByRole('heading', { name: /qual caderno você recebeu/i }),
    ).toBeInTheDocument()

    // Escolhe de novo — nada deve estar marcado.
    fireEvent.click(screen.getByRole('button', { name: /Caderno 2, cor Azul/i }))
    const bubble = await screen.findByRole('button', { name: /Questão 1 .*alternativa A/ })
    expect(bubble).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/todas respondidas/i)).toBeNull()
  })

  it('trocar de caderno sem nenhuma marcação não pede confirmação', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Caderno 2, cor Azul/i }))
    await screen.findByRole('button', { name: /Questão 1 .*alternativa A/ })

    fireEvent.click(screen.getByRole('button', { name: /não é este caderno/i }))

    expect(screen.queryByText(/trocar de caderno\?/i)).toBeNull()
    expect(
      await screen.findByRole('heading', { name: /qual caderno você recebeu/i }),
    ).toBeInTheDocument()
  })
})
