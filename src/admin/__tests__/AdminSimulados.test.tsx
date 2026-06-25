import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/services/adminApi', () => ({
  adminApi: {
    listSimulados: vi.fn(),
    deleteSimulado: vi.fn(),
    deleteQuestionsForSimulado: vi.fn(),
    getSimuladoQuestionStats: vi.fn(),
  },
}))
vi.mock('@/admin/hooks/useAdminSimuladosAnalytics', () => ({
  useAdminSimuladoEngagementMap: vi.fn(() => ({ data: new Map() })),
}))
vi.mock('@/admin/utils/exportQuestionRanking', () => ({
  exportQuestionRankingXlsx: vi.fn(),
}))

import { adminApi } from '@/admin/services/adminApi'
import AdminSimulados from '@/admin/pages/AdminSimulados'

// Datas fixas em relação ao "agora" controlado abaixo.
const NOW = new Date('2026-06-20T12:00:00Z').getTime()

const rows = [
  {
    // publicado, janela aberta agora => Disponível
    id: 's1', title: 'ENAMED Clínica Médica', sequence_number: 7, status: 'published',
    questions_count: 120,
    execution_window_start: '2026-06-15T00:00:00Z',
    execution_window_end: '2026-06-30T23:59:00Z',
  },
  {
    // publicado, janela no futuro => Agendado
    id: 's2', title: 'ENAMED Cirurgia Geral', sequence_number: 8, status: 'published',
    questions_count: 100,
    execution_window_start: '2026-07-01T00:00:00Z',
    execution_window_end: '2026-07-15T23:59:00Z',
  },
  {
    // rascunho sem questões => Rascunho + alerta laranja no 0
    id: 's3', title: 'ENAMED Pediatria', sequence_number: 9, status: 'draft',
    questions_count: 0,
    execution_window_start: '',
    execution_window_end: '',
  },
  {
    // publicado, janela no passado => Encerrado
    id: 's4', title: 'ENAMED Ginecologia', sequence_number: 6, status: 'published',
    questions_count: 110,
    execution_window_start: '2026-05-01T00:00:00Z',
    execution_window_end: '2026-05-15T23:59:00Z',
  },
]

function renderPage() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminSimulados />
    </MemoryRouter>,
  )
}

describe('AdminSimulados', () => {
  beforeEach(() => {
    // Controla só o "agora" (Date.now) sem mexer na fila de timers,
    // para não quebrar o polling do findBy* do Testing Library.
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.mocked(adminApi.listSimulados).mockResolvedValue(rows as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra os quatro estados de disponibilidade derivados do status e da janela', async () => {
    renderPage()
    expect(await screen.findByText('Disponível')).toBeInTheDocument()
    expect(screen.getByText('Agendado')).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    expect(screen.getByText('Encerrado')).toBeInTheDocument()
  })

  it('mostra a janela de execução em formato dd/mm → dd/mm/aa (mono)', async () => {
    renderPage()
    // O dia exato depende do fuso do ambiente de teste; o formato é o que importa.
    const windows = await screen.findAllByText(/^\d{2}\/\d{2} → \d{2}\/\d{2}\/\d{2}$/)
    expect(windows.length).toBeGreaterThanOrEqual(1)
  })

  it('rascunho sem janela mostra "não definida"', async () => {
    renderPage()
    expect(await screen.findByText('não definida')).toBeInTheDocument()
  })

  it('rascunho sem questões mostra 0 com aviso (cor de atenção)', async () => {
    const { container } = renderPage()
    await screen.findByText('Rascunho')
    const warn = container.querySelector('.text-admin-warning')
    expect(warn).toBeTruthy()
    expect(warn?.textContent).toContain('0')
  })

  it('subtítulo conta provas e quantas estão disponíveis agora', async () => {
    renderPage()
    expect(await screen.findByText(/4 provas cadastradas · 1 disponível agora/)).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há simulados', async () => {
    vi.mocked(adminApi.listSimulados).mockResolvedValue([] as any)
    renderPage()
    expect(await screen.findByText('Nenhum simulado cadastrado')).toBeInTheDocument()
  })

  it('mostra estado de erro quando a carga falha, com botão de tentar de novo', async () => {
    vi.mocked(adminApi.listSimulados).mockRejectedValue(new Error('falha de rede'))
    renderPage()
    expect(await screen.findByText('Não foi possível carregar os simulados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('mostra o botão primário Novo simulado', async () => {
    renderPage()
    await screen.findByText('Disponível')
    expect(screen.getByRole('button', { name: /Novo simulado/ })).toBeInTheDocument()
  })

  it('exibe skeleton de carregamento antes dos dados chegarem', async () => {
    let resolve: (v: unknown) => void = () => {}
    vi.mocked(adminApi.listSimulados).mockReturnValue(
      new Promise(r => { resolve = r }) as any,
    )
    const { container } = renderPage()
    expect(container.querySelector('.animate-\\[shimmer_1\\.4s_infinite\\]')).toBeTruthy()
    resolve(rows)
    await waitFor(() => expect(screen.getByText('Disponível')).toBeInTheDocument())
  })
})
