import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const invalidateBank = vi.hoisted(() => vi.fn())
vi.mock('@/lib/exam-query-cache', () => ({ invalidateQuestionBankQueries: invalidateBank }))
vi.mock('@/admin/components/editions/CloneSimuladoDialog', () => ({ CloneSimuladoDialog: ({ onCloned }: { onCloned: (id:string)=>void }) => <button onClick={()=>onCloned('new-draft')}>Confirmar clone fictício</button> }))
const editionsFlag = vi.hoisted(() => ({ value: false }))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => editionsFlag.value }))
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { list: vi.fn() } }))

vi.mock('@/admin/services/adminApi', () => ({
  adminApi: {
    listSimulados: vi.fn(),
    deleteSimulado: vi.fn(),
    getSimuladoAttemptsCount: vi.fn(),
    deleteQuestionsForSimulado: vi.fn(),
    getSimuladoQuestionStats: vi.fn(),
  },
}))
vi.mock('@/admin/hooks/useAdminSimuladosAnalytics', () => ({
  useAdminSimuladoEngagementMap: vi.fn(() => ({ data: new Map() })),
}))
vi.mock('@/admin/hooks/useGabaritoSuspicion', () => ({
  useGabaritoSuspicionMap: vi.fn(() => ({ data: new Map() })),
}))
vi.mock('@/admin/utils/exportQuestionRanking', () => ({
  exportQuestionRankingXlsx: vi.fn(),
}))

import { adminApi } from '@/admin/services/adminApi'
import { adminEditionsApi } from '@/admin/services/adminEditionsApi'
import AdminSimulados from '@/admin/pages/AdminSimulados'

// Datas fixas em relação ao "agora" controlado abaixo.
const NOW = new Date('2026-06-20T12:00:00Z').getTime()

const rows = [
  {
    // publicado, janela aberta agora => Disponível
    id: 's1', title: 'ENAMED Clínica Médica', sequence_number: 7, status: 'published',
    questions_count: 120,
    attempts_count: 1,
    execution_window_start: '2026-06-15T00:00:00Z',
    execution_window_end: '2026-06-30T23:59:00Z',
  },
  {
    // publicado, janela no futuro => Agendado
    id: 's2', title: 'ENAMED Cirurgia Geral', sequence_number: 8, status: 'published',
    questions_count: 100,
    attempts_count: 0,
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
    <QueryClientProvider client={new QueryClient()}><MemoryRouter>
      <AdminSimulados />
    </MemoryRouter></QueryClientProvider>,
  )
}

describe('AdminSimulados', () => {
  it('invalidates observed bank data only after cloning is acknowledged', async () => {
    editionsFlag.value=true;renderPage();await screen.findByText('ENAMED Clínica Médica')
    const trigger=screen.getByRole('button',{name:'Ações do simulado ENAMED Clínica Médica'})
    fireEvent.keyDown(trigger,{key:'Enter'})
    fireEvent.click(await screen.findByRole('menuitem',{name:'Clonar como rascunho'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar clone fictício'}))
    expect(invalidateBank).toHaveBeenCalledTimes(1)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    editionsFlag.value = false
    vi.mocked(adminEditionsApi.list).mockResolvedValue([{ id: 'e27', code: '2027.1', label: 'ENAMED 2027.1' }, { id: 'empty', code: '2027.2', label: 'ENAMED 2027.2' }] as never)
    // Controla só o "agora" (Date.now) sem mexer na fila de timers,
    // para não quebrar o polling do findBy* do Testing Library.
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.mocked(adminApi.listSimulados).mockResolvedValue(rows as any)
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(0)
    vi.mocked(adminApi.deleteSimulado).mockResolvedValue(undefined)
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
    expect(adminEditionsApi.list).not.toHaveBeenCalled()
  })

  it('consulta e filtra a edição somente com flag ativa', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.listSimulados).mockResolvedValue(rows.map((row, index) => ({ ...row, edition_id: index === 0 ? 'e27' : 'e26' })) as never)
    renderPage()
    await screen.findByText('ENAMED Clínica Médica')
    fireEvent.change(await screen.findByLabelText('Filtrar por edição'), { target: { value: 'e27' } })
    expect(screen.getByText('ENAMED Clínica Médica')).toBeInTheDocument()
    expect(screen.queryByText('ENAMED Cirurgia Geral')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar por edição'), { target: { value: 'empty' } })
    expect(screen.getByText('Nenhum simulado nesta edição.')).toBeInTheDocument()
  })

  it('mostra a janela de execução em formato dd/mm → dd/mm/aa (mono)', async () => {
    renderPage()
    // Datas independentes do fuso do navegador, explicitamente em Brasília.
    const windows = await screen.findAllByText(/^\d{2}\/\d{2} → \d{2}\/\d{2}\/\d{2} \(horário de Brasília\)$/)
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

  it.each([1, undefined, null])('bloqueia exclusao quando contagem e %s', async count => {
    vi.mocked(adminApi.listSimulados).mockResolvedValue([{ ...rows[0], attempts_count: count }] as any)
    renderPage()
    await screen.findByText(rows[0].title)
    fireEvent.keyDown(screen.getByRole('button', { name: /Ações/ }), { key: 'Enter' })
    const item = await screen.findByRole('menuitem', { name: /Excluir simulado/ })
    expect(item).toHaveAttribute('data-disabled')
  })

  async function confirmDeletion() {
    vi.mocked(adminApi.listSimulados).mockResolvedValue([{ ...rows[0], attempts_count: 0 }] as any)
    renderPage()
    await screen.findByText(rows[0].title)
    fireEvent.keyDown(screen.getByRole('button', { name: /Ações/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir simulado/ }))
    const confirm = await screen.findByRole('button', { name: 'Excluir simulado' })
    await act(async () => { fireEvent.click(confirm) })
  }

  it('reconfere tentativas no handler e nao remove questoes separadamente', async () => {
    await confirmDeletion()
    await waitFor(() => expect(adminApi.deleteSimulado).toHaveBeenCalledWith('s1'))
    expect(adminApi.getSimuladoAttemptsCount).toHaveBeenCalledWith('s1')
    expect(adminApi.deleteQuestionsForSimulado).not.toHaveBeenCalled()
  })

  it('nao exclui se uma tentativa surgir apos carregar a lista', async () => {
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(1)
    await confirmDeletion()
    await waitFor(() => expect(adminApi.getSimuladoAttemptsCount).toHaveBeenCalled())
    expect(adminApi.deleteSimulado).not.toHaveBeenCalled()
    expect(adminApi.deleteQuestionsForSimulado).not.toHaveBeenCalled()
  })

  it('nao exclui se a rechecagem falhar', async () => {
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockRejectedValue(new Error('Contagem indisponível'))
    await confirmDeletion()
    await waitFor(() => expect(adminApi.getSimuladoAttemptsCount).toHaveBeenCalled())
    expect(adminApi.deleteSimulado).not.toHaveBeenCalled()
  })
})
