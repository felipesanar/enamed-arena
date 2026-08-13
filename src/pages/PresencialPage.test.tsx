import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/services/presencialApi', () => ({
  presencialApi: {
    checkin: vi.fn(), claim: vi.fn(), startUnlinked: vi.fn(), submit: vi.fn(),
  },
}))

import { presencialApi } from '@/services/presencialApi'
import PresencialPage from './PresencialPage'

const questions = [1, 2].map(n => ({
  question_id: `q${n}`,
  number: n,
  options: ['A', 'B', 'C', 'D'].map(l => ({ id: `q${n}${l}`, label: l })),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/presencial/s7-rec']}>
      <Routes>
        <Route path="/presencial/:codigo" element={<PresencialPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function goToSheet() {
  vi.mocked(presencialApi.checkin).mockResolvedValue({
    status: 'ready', token: 'tok', questions,
  })
  renderPage()
  fireEvent.change(screen.getByLabelText(/nome completo/i), {
    target: { value: 'Fulano de Teste' },
  })
  fireEvent.change(screen.getByLabelText(/e-mail/i), {
    target: { value: 'fulano@gmail.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
  await waitFor(() =>
    screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }),
  )
}

describe('PresencialPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('vai da identificação para o gabarito', async () => {
    await goToSheet()
    expect(screen.getByRole('button', { name: /Questão 2 .*alternativa D/ })).toBeInTheDocument()
  })

  it('só habilita o envio com todas as questões marcadas', async () => {
    await goToSheet()
    const enviar = () => screen.getByRole('button', { name: /enviar gabarito/i })
    expect(enviar()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    expect(enviar()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    expect(enviar()).not.toBeDisabled()
  })

  it('envia e mostra nota e áreas', async () => {
    vi.mocked(presencialApi.submit).mockResolvedValue({
      total_questions: 2, total_correct: 1, score_percentage: 50,
      by_area: [{ area: 'Clínica Médica', total: 2, correct: 1, percentage: 50 }],
      is_linked: true, is_within_window: true,
    })
    await goToSheet()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))

    await waitFor(() => {
      expect(presencialApi.submit).toHaveBeenCalledWith({
        token: 'tok',
        answers: [
          { question_id: 'q1', selected_option_id: 'q1A' },
          { question_id: 'q2', selected_option_id: 'q2B' },
        ],
      })
    })
    expect(await screen.findByText(/Clínica Médica/)).toBeInTheDocument()
    expect(screen.getByText(/07\/09/)).toBeInTheDocument()
  })

  it('avisa que a nota depende de vínculo quando is_linked é falso', async () => {
    vi.mocked(presencialApi.submit).mockResolvedValue({
      total_questions: 2, total_correct: 2, score_percentage: 100,
      by_area: [], is_linked: false, is_within_window: true,
    })
    await goToSheet()
    fireEvent.click(screen.getByRole('button', { name: /Questão 1 .*alternativa A/ }))
    fireEvent.click(screen.getByRole('button', { name: /Questão 2 .*alternativa B/ }))
    fireEvent.click(screen.getByRole('button', { name: /enviar gabarito/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar envio/i }))
    expect(await screen.findByText(/confirmarmos sua conta/i)).toBeInTheDocument()
  })
})
