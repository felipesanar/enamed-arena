import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CorrecaoPage from './CorrecaoPage'

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

// ── next-themes mock ────────────────────────────────────────────────────────
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))

// ── Analytics mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

// ── Hook mocks ──────────────────────────────────────────────────────────────
const mockSimulado = {
  id: 'sim-1',
  title: 'ENAMED 2025.1',
  sequenceNumber: 1,
  status: 'completed',
}

const mockQuestions = [
  {
    id: 'q1', number: 1, area: 'Clínica Médica', theme: 'Cardiologia',
    text: 'Texto da questão 1',
    imageUrl: null,
    explanation: 'Comentário curto.',
    explanationImageUrl: null,
    options: [
      { id: 'o1a', label: 'A', text: 'Alternativa A' },
      { id: 'o1b', label: 'B', text: 'Alternativa B' },
      { id: 'o1c', label: 'C', text: 'Alternativa C' },
    ],
    correctOptionId: 'o1b',
  },
  {
    id: 'q2', number: 2, area: 'Cirurgia', theme: 'Abdome Agudo',
    text: 'Texto da questão 2',
    imageUrl: null,
    explanation: 'Comentário longo '.repeat(60),
    explanationImageUrl: null,
    options: [
      { id: 'o2a', label: 'A', text: 'Alternativa A' },
      { id: 'o2b', label: 'B', text: 'Alternativa B' },
    ],
    correctOptionId: 'o2a',
  },
]

const mockExamState = {
  status: 'submitted',
  answers: {
    q1: { selectedOption: 'o1a', markedForReview: true, highConfidence: false },
    q2: { selectedOption: 'o2b', markedForReview: false, highConfidence: true },
  },
}

const mockAttempt = { total_correct: 1, total_answered: 2, score_percentage: '50' }

const mockAttemptQuestionResults = {
  q1: { correct_option_id: 'o1b' },
  q2: { correct_option_id: 'o2a' },
}

vi.mock('@/hooks/useSimuladoDetail', () => ({
  useSimuladoDetail: () => ({ simulado: mockSimulado, questions: mockQuestions, loading: false }),
}))

vi.mock('@/hooks/useExamResult', () => ({
  useExamResult: () => ({
    examState: mockExamState,
    attempt: mockAttempt,
    attemptQuestionResults: mockAttemptQuestionResults,
    loading: false,
  }),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ profile: { segment: 'pro' } }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/simulado-helpers', () => ({
  canViewResultsOrAdminPreview: () => true,
}))

vi.mock('@/components/AddToNotebookModal', () => ({
  AddToNotebookModal: () => null,
}))

vi.mock('@/components/exam/QuestionImage', () => ({
  QuestionImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// ── Helper ──────────────────────────────────────────────────────────────────
function renderPage(adminPreview = false) {
  return render(
    <MemoryRouter initialEntries={[`/simulados/sim-1/correcao`]}>
      <Routes>
        <Route path="/simulados/:id/correcao" element={<CorrecaoPage adminPreview={adminPreview} />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('CorrecaoPage — smoke', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renderiza sem crash', () => {
    renderPage()
    expect(screen.getAllByText(/questão 1/i).length).toBeGreaterThan(0)
  })
})

describe('CorrecaoPage — expandedExplanations', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra o botão "Ver mais" quando o comentário é longo (overflow simulado)', () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }))

    expect(screen.getByRole('button', { name: /ver mais/i })).toBeTruthy()

    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
  })

  it('expande o comentário ao clicar em "Ver mais"', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }))

    const btn = screen.getByRole('button', { name: /ver mais/i })
    fireEvent.click(btn)

    expect(screen.getByRole('button', { name: /ver menos/i })).toBeTruthy()
  })

  it('não mostra "Ver mais" quando o comentário é curto', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 80 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    expect(screen.queryByRole('button', { name: /ver mais/i })).toBeNull()
  })
})
