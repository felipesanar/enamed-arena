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

import { useSimuladoDetail } from '@/hooks/useSimuladoDetail'
import { useOfflineAttempt } from '@/hooks/useOfflineAttempt'
import { offlineApi } from '@/services/offlineApi'

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

function setup(
  {
    simulado = baseSimulado as any,
    questions = mockQuestions as any,
    loading = false,
    activeAttempt = baseAttempt as any,
  } = {},
) {
  vi.mocked(useSimuladoDetail).mockReturnValue({ simulado, questions, loading } as any)
  vi.mocked(useOfflineAttempt).mockReturnValue({
    activeAttempt,
    clearAttempt: mockClearAttempt,
    invalidate: vi.fn(),
  } as any)
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

  it('mostra "Simulado não encontrado" quando não há questões', () => {
    setup({ questions: [] })
    renderPage()
    expect(screen.getByText(/simulado não encontrado/i)).toBeInTheDocument()
  })

  it('mostra "Tentativa offline não encontrada" quando o attempt é de outro simulado', () => {
    setup({ activeAttempt: { ...baseAttempt, simulado_id: 'outro-sim' } })
    renderPage()
    expect(screen.getByText(/tentativa offline não encontrada/i)).toBeInTheDocument()
  })
})

describe('AnswerSheetPage — renderização do gabarito', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('renderiza as bolhas A/B/C/D de cada questão', () => {
    renderPage()
    // 3 questões × 4 alternativas = 12 bolhas
    expect(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Questão 3 .*alternativa D/ })).toBeInTheDocument()
  })

  it('mostra o título do simulado no subtítulo', () => {
    renderPage()
    expect(screen.getByText(/ENAMED 2025\.1/)).toBeInTheDocument()
  })

  it('inicia com o botão de envio desabilitado (nenhuma respondida)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /enviar gabarito/i })).toBeDisabled()
  })

  it('não mostra aviso de incompleto antes de qualquer resposta', () => {
    renderPage()
    expect(screen.queryByText(/sem resposta/i)).toBeNull()
  })
})

describe('AnswerSheetPage — seleção de respostas', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('marca a bolha selecionada (aria-pressed) e deixa as demais em branco', () => {
    renderPage()
    selectAnswer(1, 'B')

    const selected = screen.getByRole('button', { name: /Questão 1 .*alternativa B/ })
    const other = screen.getByRole('button', { name: /Questão 1 .*alternativa A/ })
    const skipped = screen.getByRole('button', { name: /Questão 2 .*alternativa A/ })

    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(other).toHaveAttribute('aria-pressed', 'false')
    expect(skipped).toHaveAttribute('aria-pressed', 'false')
  })

  it('mostra aviso de questões faltantes após responder parcialmente', () => {
    renderPage()
    selectAnswer(1, 'A')
    // 1 de 3 respondidas → faltam 2
    expect(screen.getByText(/faltam 2 quest/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar gabarito/i })).toBeDisabled()
  })

  it('habilita o envio e mostra "Todas respondidas" quando o gabarito está completo', () => {
    renderPage()
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

  it('abre o modal de confirmação ao clicar em "Enviar gabarito"', () => {
    renderPage()
    answerAll()
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    expect(screen.getByText(/confirmar envio\?/i)).toBeInTheDocument()
  })

  it('submete as respostas, limpa o attempt e navega de volta ao simulado', async () => {
    renderPage()
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
    renderPage()
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
    renderPage()
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
