import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminQuestionEditor')

import {
  useAdminSimuladoQuestions,
  useUpdateQuestion,
  useUpdateOption,
  useSetCorrectOption,
  useDeleteQuestion,
} from '@/admin/hooks/useAdminQuestionEditor'

import AdminQuestionManager from '@/admin/pages/AdminQuestionManager'
import type { AdminQuestionFull } from '@/admin/types'

const mockQuestion: AdminQuestionFull = {
  id: 'Q1',
  question_number: 1,
  text: 'Qual é a conduta inicial no choque séptico?',
  area: 'Clínica Médica',
  theme: 'Sepse',
  difficulty: 'medium',
  explanation: 'Explicação da questão.',
  image_url: null,
  explanation_image_url: null,
  image_url_2: null,
  options: [
    { id: 'OPT_A', label: 'A', text: 'Alternativa A', is_correct: false },
    { id: 'OPT_B', label: 'B', text: 'Alternativa B', is_correct: true },
    { id: 'OPT_C', label: 'C', text: 'Alternativa C', is_correct: false },
    { id: 'OPT_D', label: 'D', text: 'Alternativa D', is_correct: false },
  ],
}

const setCorrectMutateAsync = vi.fn().mockResolvedValue(undefined)
const updMutateAsync = vi.fn().mockResolvedValue(undefined)
const updOptMutateAsync = vi.fn().mockResolvedValue(undefined)

function mutationMock(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return { mutate: vi.fn(), mutateAsync, isPending: false } as any
}

function renderPage() {
  return renderWithAccess(
    <MemoryRouter initialEntries={['/admin/simulados/SID/questoes/editar']}>
      <Routes>
        <Route path="/admin/simulados/:id/questoes/editar" element={<AdminQuestionManager />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminQuestionManager', () => {
  beforeEach(() => {
    setCorrectMutateAsync.mockClear()
    updMutateAsync.mockClear()
    updOptMutateAsync.mockClear()
    vi.mocked(useAdminSimuladoQuestions).mockReturnValue({
      data: [mockQuestion],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useUpdateQuestion).mockReturnValue(mutationMock(updMutateAsync))
    vi.mocked(useUpdateOption).mockReturnValue(mutationMock(updOptMutateAsync))
    vi.mocked(useSetCorrectOption).mockReturnValue(mutationMock(setCorrectMutateAsync))
    vi.mocked(useDeleteQuestion).mockReturnValue(mutationMock())
  })

  it('lista a questão com o enunciado e o badge da alternativa correta (B)', () => {
    renderPage()
    expect(screen.getByText(/Qual é a conduta inicial/)).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('abre o dialog de edição ao clicar em Editar', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(await screen.findByText('Editar questão #1')).toBeInTheDocument()
    expect(screen.getByLabelText('Enunciado')).toBeInTheDocument()
    expect(screen.getByLabelText('Área')).toBeInTheDocument()
  })

  it('troca a correta para C e chama setCorrectOption ao Salvar', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByText('Editar questão #1')

    fireEvent.click(screen.getByLabelText('Marcar alternativa C como correta'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await vi.waitFor(() => {
      expect(setCorrectMutateAsync).toHaveBeenCalledWith({
        questionId: 'Q1',
        optionId: 'OPT_C',
      })
    })
  })
})
