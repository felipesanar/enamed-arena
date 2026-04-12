import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultadoPage from './ResultadoPage'

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const Component = ({ children, ...rest }: any) => {
        const { initial: _i, animate: _a, transition: _tr, exit: _e, variants: _v, ...domProps } = rest
        if (tag === 'span') return <span {...domProps}>{children}</span>
        return <div {...domProps}>{children}</div>
      }
      return Component
    },
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
  resultsReleaseAt: '2025-12-01T00:00:00Z',
}

const mockExamState = {
  status: 'submitted',
  answers: {
    'q1': { selectedOption: 'o1b', markedForReview: false, highConfidence: false, eliminatedAlternatives: [] as string[] },
    'q2': { selectedOption: 'o2a', markedForReview: false, highConfidence: false, eliminatedAlternatives: [] as string[] },
  },
  startedAt: '2025-11-01T10:00:00Z',
  tabExitCount: 0,
  fullscreenExitCount: 0,
}

const mockAttempt = {
  id: 'att-1',
  total_correct: 31,
  total_answered: 100,
  score_percentage: 31,
  is_within_window: true,
}

const mockQuestions = [
  {
    id: 'q1', number: 1, area: 'Clínica Médica', theme: 'Cardiologia',
    text: 'Questão 1', imageUrl: null as string | null, explanation: 'Explicação 1',
    explanationImageUrl: null as string | null, difficulty: null as string | null, correctOptionId: 'o1b',
    options: [
      { id: 'o1a', label: 'A', text: 'Alt A' },
      { id: 'o1b', label: 'B', text: 'Alt B' },
    ],
  },
  {
    id: 'q2', number: 2, area: 'Cirurgia', theme: 'Trauma',
    text: 'Questão 2', imageUrl: null as string | null, explanation: 'Explicação 2',
    explanationImageUrl: null as string | null, difficulty: null as string | null, correctOptionId: 'o2b',
    options: [
      { id: 'o2a', label: 'A', text: 'Alt A' },
      { id: 'o2b', label: 'B', text: 'Alt B' },
    ],
  },
]

vi.mock('@/hooks/useSimuladoDetail', () => ({
  useSimuladoDetail: () => ({
    simulado: mockSimulado,
    questions: mockQuestions,
    loading: false,
  }),
}))

vi.mock('@/hooks/useExamResult', () => ({
  useExamResult: () => ({
    examState: mockExamState,
    attempt: mockAttempt,
    loading: false,
  }),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    profile: { segment: 'pro', id: 'user-1' },
    isOnboardingComplete: true,
  }),
}))

vi.mock('@/lib/simulado-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulado-helpers')>()
  return {
    ...actual,
    canViewResultsOrAdminPreview: () => true,
  }
})

function renderPage(adminPreview = false) {
  return render(
    <MemoryRouter initialEntries={['/simulados/sim-1/resultado']}>
      <Routes>
        <Route
          path="/simulados/:id/resultado"
          element={<ResultadoPage adminPreview={adminPreview} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ResultadoPage — smoke', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renderiza sem crash', () => {
    renderPage()
    expect(document.body).toBeTruthy()
  })
})

describe('ResultadoPage — hero card', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe o percentual de acerto em destaque', () => {
    renderPage()
    expect(screen.getByText('31%')).toBeTruthy()
  })

  it('exibe subtítulo com contagem de corretas', () => {
    renderPage()
    const els = screen.getAllByText(
      (_content, node) => !!node?.textContent?.match(/31.*questões corretas/i)
    )
    expect(els.length).toBeGreaterThan(0)
  })

  it('exibe o ring SVG de progresso', () => {
    renderPage()
    // O SVG do ring deve existir (role="img" com aria-label)
    expect(screen.getByRole('img', { name: /31%.*aproveitamento/i })).toBeTruthy()
  })
})

describe('ResultadoPage — stat cards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe os 4 stat cards com labels', () => {
    renderPage()
    expect(screen.getByText('Acertos')).toBeTruthy()
    expect(screen.getByText('Erros')).toBeTruthy()
    expect(screen.getByText('Em branco')).toBeTruthy()
    expect(screen.getByText('Respondidas')).toBeTruthy()
  })
})

describe('ResultadoPage — highlights', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe Ponto forte e Oportunidade quando há mais de 1 área', () => {
    renderPage()
    expect(screen.getByText('Ponto forte')).toBeTruthy()
    expect(screen.getByText('Oportunidade')).toBeTruthy()
  })
})

describe('ResultadoPage — CTA', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe link "Ir para correção comentada" apontando para /correcao', () => {
    renderPage()
    const cta = screen.getByRole('link', { name: /ir para correção comentada/i })
    expect(cta).toBeTruthy()
    expect((cta as HTMLAnchorElement).href).toContain('/correcao')
  })
})
