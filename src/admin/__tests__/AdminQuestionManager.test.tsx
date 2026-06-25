import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminQuestionEditor')
vi.mock('@/admin/hooks/useAdminSimuladosAnalytics')
vi.mock('@/admin/hooks/useAdminTentativas')

import {
  useAdminSimuladoQuestions,
  useUpdateQuestion,
  useUpdateOption,
  useSetCorrectOption,
  useDeleteQuestion,
} from '@/admin/hooks/useAdminQuestionEditor'
import { useAdminSimuladoQuestionStats } from '@/admin/hooks/useAdminSimuladosAnalytics'
import { useAdminSimuladoList } from '@/admin/hooks/useAdminTentativas'

import AdminQuestionManager from '@/admin/pages/AdminQuestionManager'
import type { AdminQuestionFull, SimuladoQuestionStat } from '@/admin/types'

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

const mockQuestion2: AdminQuestionFull = {
  id: 'Q2',
  question_number: 2,
  text: 'Qual o exame inicial na dor torácica?',
  area: 'Clínica Médica',
  theme: 'Cardiologia',
  difficulty: 'hard',
  explanation: 'ECG primeiro.',
  image_url: null,
  explanation_image_url: null,
  image_url_2: null,
  options: [
    { id: 'OPT2_A', label: 'A', text: 'Radiografia', is_correct: false },
    { id: 'OPT2_B', label: 'B', text: 'ECG', is_correct: true },
  ],
}

const mockStat: SimuladoQuestionStat = {
  question_number: 1,
  text: mockQuestion.text,
  correct_rate: 64,
  discrimination_index: 30, // escala 0–100 (antes 0–1)
  most_common_wrong_label: 'A',
  most_common_wrong_pct: 22,
  area: 'Clínica Médica',
  theme: 'Sepse',
  total_responses: 120,
  total_responses_all: 180,
}

const setCorrectMutateAsync = vi.fn().mockResolvedValue(undefined)
const updMutateAsync = vi.fn().mockResolvedValue(undefined)
const updOptMutateAsync = vi.fn().mockResolvedValue(undefined)

function mutationMock(mutateAsync = vi.fn().mockResolvedValue(undefined)) {
  return { mutate: vi.fn(), mutateAsync, isPending: false } as any
}

function renderSimuladoRoute() {
  return renderWithAccess(
    <MemoryRouter initialEntries={['/admin/simulados/SID/questoes/editar']}>
      <Routes>
        <Route path="/admin/simulados/:id/questoes/editar" element={<AdminQuestionManager />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderBankRoute(initialEntry = '/admin/questoes') {
  return renderWithAccess(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/questoes" element={<AdminQuestionManager />} />
        <Route path="/admin/questoes/:simuladoId" element={<AdminQuestionManager />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminQuestionManager — editor por simulado', () => {
  beforeEach(() => {
    setCorrectMutateAsync.mockClear()
    updMutateAsync.mockClear()
    updOptMutateAsync.mockClear()
    vi.mocked(useAdminSimuladoQuestions).mockReturnValue({
      data: [mockQuestion, mockQuestion2],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useAdminSimuladoQuestionStats).mockReturnValue({
      data: [mockStat],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useAdminSimuladoList).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useUpdateQuestion).mockReturnValue(mutationMock(updMutateAsync))
    vi.mocked(useUpdateOption).mockReturnValue(mutationMock(updOptMutateAsync))
    vi.mocked(useSetCorrectOption).mockReturnValue(mutationMock(setCorrectMutateAsync))
    vi.mocked(useDeleteQuestion).mockReturnValue(mutationMock())
  })

  it('mostra o editor da primeira questão com a posição e a alternativa correta marcada', () => {
    renderSimuladoRoute()
    expect(screen.getByText('Questão 1 de 2')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Qual é a conduta inicial/)).toBeInTheDocument()
    // A correta (B) ganha o selo "Correta".
    expect(screen.getByText('Correta')).toBeInTheDocument()
    const radioB = screen.getByLabelText('Marcar alternativa B como correta') as HTMLInputElement
    expect(radioB.checked).toBe(true)
  })

  it('exibe o card de desempenho com a taxa de acerto e o erro mais comum', () => {
    renderSimuladoRoute()
    expect(screen.getByText('Desempenho nesta questão')).toBeInTheDocument()
    expect(screen.getByText('64%')).toBeInTheDocument()
    expect(screen.getByText(/a maioria marcou a alternativa/i)).toBeInTheDocument()
  })

  it('troca a correta para C e chama setCorrectOption ao salvar', async () => {
    renderSimuladoRoute()
    fireEvent.click(screen.getByLabelText('Marcar alternativa C como correta'))
    fireEvent.click(screen.getByRole('button', { name: /Salvar e próxima/ }))

    await vi.waitFor(() => {
      expect(setCorrectMutateAsync).toHaveBeenCalledWith({
        questionId: 'Q1',
        optionId: 'OPT_C',
      })
    })
  })

  it('avança para a próxima questão depois de salvar', async () => {
    renderSimuladoRoute()
    fireEvent.click(screen.getByRole('button', { name: /Salvar e próxima/ }))
    await screen.findByText('Questão 2 de 2')
    expect(screen.getByDisplayValue(/Qual o exame inicial/)).toBeInTheDocument()
    // Na última questão o botão vira só "Salvar".
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })

  it('botão Anterior fica desabilitado na primeira questão', () => {
    renderSimuladoRoute()
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
  })

  it('mostra o estado vazio quando não há questões', () => {
    vi.mocked(useAdminSimuladoQuestions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    renderSimuladoRoute()
    expect(screen.getByText('Este simulado ainda não tem questões')).toBeInTheDocument()
  })

  it('mostra o estado de erro com opção de tentar de novo', () => {
    const refetch = vi.fn()
    vi.mocked(useAdminSimuladoQuestions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch,
    } as any)
    renderSimuladoRoute()
    expect(screen.getByText('Não foi possível carregar as questões')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })
})

describe('AdminQuestionManager — Banco de questões', () => {
  beforeEach(() => {
    vi.mocked(useAdminSimuladoQuestions).mockReturnValue({
      data: [mockQuestion],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useAdminSimuladoQuestionStats).mockReturnValue({
      data: [mockStat],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useAdminSimuladoList).mockReturnValue({
      data: [
        { id: 'SID', sequence_number: 3, title: 'Simulado de Clínica', questions_count: 120 },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    vi.mocked(useUpdateQuestion).mockReturnValue(mutationMock(updMutateAsync))
    vi.mocked(useUpdateOption).mockReturnValue(mutationMock(updOptMutateAsync))
    vi.mocked(useSetCorrectOption).mockReturnValue(mutationMock(setCorrectMutateAsync))
    vi.mocked(useDeleteQuestion).mockReturnValue(mutationMock())
  })

  it('lista os simulados para escolher e navega para o deep-link ao clicar', async () => {
    renderBankRoute()
    expect(screen.getByText('Banco de questões')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Simulado de Clínica'))
    // Ao escolher, a URL passa a ser /admin/questoes/SID e o editor abre.
    expect(await screen.findByText('Questão 1 de 1')).toBeInTheDocument()
  })

  it('abre o editor direto quando o simulado vem na URL (deep-link)', async () => {
    renderBankRoute('/admin/questoes/SID')
    expect(await screen.findByText('Questão 1 de 1')).toBeInTheDocument()
    // O atalho de voltar ao banco está disponível.
    expect(screen.getByText('← Trocar de simulado')).toBeInTheDocument()
  })

  it('volta ao seletor do banco ao clicar em trocar de simulado', async () => {
    renderBankRoute('/admin/questoes/SID')
    await screen.findByText('Questão 1 de 1')
    fireEvent.click(screen.getByText('← Trocar de simulado'))
    expect(await screen.findByText('Banco de questões')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há simulados', () => {
    vi.mocked(useAdminSimuladoList).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
    renderBankRoute()
    expect(screen.getByText('Nenhum simulado cadastrado')).toBeInTheDocument()
  })
})
