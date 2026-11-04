import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ALL_CAPABILITIES } from './test-utils'

vi.mock('@/admin/services/adminApi')
const editionsFlag = vi.hoisted(() => ({ value: false }))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => editionsFlag.value }))
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { list: vi.fn(), nextSequence: vi.fn() } }))
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

const toastSpy = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ toast: (args: unknown) => toastSpy(args) }))

import { adminApi } from '@/admin/services/adminApi'
import { adminEditionsApi } from '@/admin/services/adminEditionsApi'
import AdminSimuladoForm from '@/admin/pages/AdminSimuladoForm'

function renderAt(path: string, capabilities: string[] = ALL_CAPABILITIES) {
  const content = () => (
    <QueryClientProvider client={new QueryClient()}><AdminAccessProvider roles={['admin']} capabilities={capabilities}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/simulados/:id" element={<AdminSimuladoForm />} />
        </Routes>
      </MemoryRouter>
    </AdminAccessProvider></QueryClientProvider>
  )
  const result = render(content())
  return { ...result, refresh: () => result.rerender(content()) }
}

const sample = {
  id: 's1',
  title: 'ENAMED Clínica Médica',
  slug: 'enamed-clinica',
  sequence_number: 7,
  description: 'Prova de teste',
  duration_minutes: 240,
  questions_count: 100,
  execution_window_start: '2026-06-15T11:00:00.000Z',
  execution_window_end: '2026-06-30T23:59:00.000Z',
  results_release_at: '2026-07-01T11:00:00.000Z',
  theme_tags: ['Clínica Médica'],
  status: 'draft',
}

describe('AdminSimuladoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editionsFlag.value = false
    vi.mocked(adminEditionsApi.list).mockResolvedValue([{ id: 'edition-27', code: '2027.1', year: 2027, term: 1, label: 'ENAMED 2027.1' }] as never)
    vi.mocked(adminEditionsApi.nextSequence).mockResolvedValue(4)
    vi.mocked(adminApi.getQuestionsCount).mockResolvedValue(100)
    vi.mocked(adminApi.getSimulado).mockResolvedValue(sample as never)
    vi.mocked(adminApi.createSimulado).mockResolvedValue({} as never)
    vi.mocked(adminApi.updateSimulado).mockResolvedValue({} as never)
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(0)
  })

  it('mostra o estado sem permissão quando falta content.manage', () => {
    renderAt('/admin/simulados/novo', ['dashboard.view'])
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument()
    expect(adminEditionsApi.list).not.toHaveBeenCalled()
  })

  it('flag desligada não consulta edições nem muda o request legado', () => {
    renderAt('/admin/simulados/novo')
    expect(screen.queryByLabelText('Edição')).not.toBeInTheDocument()
    expect(adminEditionsApi.list).not.toHaveBeenCalled()
    expect(adminApi.getSimuladoAttemptsCount).not.toHaveBeenCalled()
  })

  it.each([4, null])('protects dates for attempts or unknown count: %s', async count => {
    editionsFlag.value = true
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...sample, edition_id: 'edition-27' } as never)
    if (count === null) vi.mocked(adminApi.getSimuladoAttemptsCount).mockRejectedValue(new Error('unavailable'))
    else vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(count)
    renderAt('/admin/simulados/s1')
    await screen.findByDisplayValue(sample.title)
    expect(screen.getByLabelText(/Abre em/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Alterar janela com conferência' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Título não salvo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(adminApi.saveSimuladoWithEdition).toHaveBeenCalledWith('s1', expect.objectContaining({ title: 'Título não salvo' }), expect.any(Function), { preserveWindow: true }))
  })

  it('releases all dates when the flag turns off during a pending count and ignores its late response', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...sample, edition_id: 'edition-27' } as never)
    let resolve!: (count: number) => void
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const view = renderAt('/admin/simulados/s1')
    await waitFor(() => expect(adminApi.getSimuladoAttemptsCount).toHaveBeenCalledTimes(1))
    const dates = () => [/Abre em/, /Fecha em/, /Libera resultados em/].map(label => screen.getByLabelText(label))
    dates().forEach(input => expect(input).toBeDisabled())
    editionsFlag.value = false
    view.refresh()
    dates().forEach(input => expect(input).toBeEnabled())
    await act(async () => { resolve(9) })
    dates().forEach(input => expect(input).toBeEnabled())
    editionsFlag.value = true
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockReturnValueOnce(new Promise(() => {}))
    view.refresh()
    expect(screen.getByText('Conferindo participações...')).toBeInTheDocument()
    expect(screen.queryByText(/9 participações registradas/)).not.toBeInTheDocument()
    dates().forEach(input => expect(input).toBeDisabled())
  })

  it('keeps ordinary dates for confirmed zero; missing attempts permission explains protected mode', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...sample, edition_id: 'edition-27' } as never)
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(2)
    renderAt('/admin/simulados/s1', ['content.manage'])
    await screen.findByDisplayValue(sample.title)
    expect(screen.getByLabelText(/Abre em/)).toBeDisabled()
    expect(screen.getByText(/permissão para gerenciar tentativas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alterar janela com conferência' })).not.toBeInTheDocument()
  })

  it('successful explicit change updates only dates and retains dirty metadata', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...sample, edition_id: 'edition-27' } as never)
    vi.mocked(adminApi.getSimuladoAttemptsCount).mockResolvedValue(1)
    const window = { execution_window_start: sample.execution_window_start, execution_window_end: sample.execution_window_end, results_release_at: sample.results_release_at }
    vi.mocked(adminApi.previewSimuladoWindow).mockResolvedValue({ simulado_id: 's1', current_window_hash: 'hash', attempts_examined: 1, old_eligible: 1, new_eligible: 1, eligibility_changed: 0, old_window: window, new_window: window })
    vi.mocked(adminApi.updateSimuladoWindow).mockResolvedValue({ simulado_id: 's1', operation_id: 'op', attempts_examined: 1, eligibility_changed: 0, old_window: window, new_window: window })
    renderAt('/admin/simulados/s1')
    await screen.findByDisplayValue(sample.title)
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Dirty title' } })
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'Dirty description' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alterar janela com conferência' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferir impacto' }))
    await screen.findByText('1 tentativas conferidas')
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Correção' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }))
    await screen.findByText(/Janela alterada. Respostas e notas preservadas./)
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Dirty title')
    expect(screen.getByLabelText(/Descrição/)).toHaveValue('Dirty description')
    await waitFor(() => expect(adminApi.getSimuladoAttemptsCount).toHaveBeenCalledTimes(2))
    expect(adminApi.getSimulado).toHaveBeenCalledTimes(1)
  })

  it('handles an attempt racing a zero count without losing the draft or exposing SQL', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...sample, edition_id: 'edition-27' } as never)
    vi.mocked(adminApi.saveSimuladoWithEdition).mockRejectedValueOnce({ code: '42501', message: 'Use admin_update_simulado_window for a simulado with attempts' })
    renderAt('/admin/simulados/s1')
    await screen.findByDisplayValue(sample.title)
    await waitFor(() => expect(screen.getByLabelText(/Abre em/)).not.toBeDisabled())
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Draft preserved' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/nova conferência/) })))
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Draft preserved')
    expect(JSON.stringify(toastSpy.mock.calls)).not.toContain('admin_update_simulado_window')
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('sugere sequência e mantém o rascunho para retry após falha de publicação', async () => {
    editionsFlag.value = true
    vi.mocked(adminApi.saveSimuladoWithEdition).mockImplementationOnce(async (_id, _values, saved) => {
      saved('draft-id'); throw new Error('Publicação bloqueada')
    }).mockResolvedValueOnce({ id: 'draft-id' } as never)
    renderAt('/admin/simulados/novo')
    await screen.findByRole('option', { name: /2027.1/ })
    fireEvent.change(screen.getByLabelText('Edição'), { target: { value: 'edition-27' } })
    await waitFor(() => expect(screen.getByDisplayValue('enamed-2027-1-simulado-4')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Nova prova 27' } })
    fireEvent.change(screen.getByLabelText(/Abre em/), { target: { value: '2027-06-15T08:00' } })
    fireEvent.change(screen.getByLabelText(/Fecha em/), { target: { value: '2027-06-30T23:59' } })
    fireEvent.change(screen.getByLabelText(/Libera resultados/), { target: { value: '2027-07-01T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar simulado' }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rascunho salvo; publicação bloqueada' })))
    expect(screen.getByLabelText(/^Título/)).toHaveValue('Nova prova 27')
    expect(navigateSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(adminApi.saveSimuladoWithEdition).toHaveBeenCalledTimes(2))
    expect(vi.mocked(adminApi.saveSimuladoWithEdition).mock.calls[1][0]).toBe('draft-id')
    expect(vi.mocked(adminApi.saveSimuladoWithEdition).mock.calls[1][1]).toMatchObject({ edition_id: 'edition-27', execution_window_start: '2027-06-15T11:00:00.000Z', status: 'draft' })
    expect(adminApi.createSimulado).not.toHaveBeenCalled()
  })

  it('em novo simulado, mostra os botões da topbar e o painel "O que o aluno vê"', () => {
    renderAt('/admin/simulados/novo')
    expect(screen.getByRole('button', { name: 'Publicar simulado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument()
    expect(screen.getByText('O que o aluno vê')).toBeInTheDocument()
    expect(screen.getByText('Dentro da janela')).toBeInTheDocument()
    expect(screen.getByText('Fora da janela')).toBeInTheDocument()
  })

  it('sem janela definida, a linha do tempo mostra o texto de orientação', () => {
    renderAt('/admin/simulados/novo')
    expect(
      screen.getByText(/Defina quando a prova abre e fecha/i),
    ).toBeInTheDocument()
  })

  it('ao preencher abre/fecha, a linha do tempo mostra os rótulos das datas e "vale para ranking"', () => {
    renderAt('/admin/simulados/novo')
    fireEvent.change(screen.getByLabelText(/Abre em/i), { target: { value: '2026-06-15T08:00' } })
    fireEvent.change(screen.getByLabelText(/Fecha em/i), { target: { value: '2026-06-30T23:59' } })
    expect(screen.getByText('vale para ranking')).toBeInTheDocument()
    expect(screen.getByText('15/06')).toBeInTheDocument()
    expect(screen.getByText('30/06')).toBeInTheDocument()
  })

  it('em edição, carrega os dados do simulado (estado skeleton -> sucesso)', async () => {
    renderAt('/admin/simulados/s1')
    await waitFor(() => {
      expect(screen.getByDisplayValue('ENAMED Clínica Médica')).toBeInTheDocument()
    })
    expect(adminApi.getSimulado).toHaveBeenCalledWith('s1')
  })

  it('mostra estado de erro quando o carregamento falha e permite tentar de novo', async () => {
    vi.mocked(adminApi.getSimulado).mockRejectedValueOnce(new Error('boom'))
    renderAt('/admin/simulados/s1')
    await waitFor(() => {
      expect(screen.getByText(/Não foi possível carregar este simulado/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue('ENAMED Clínica Médica')).toBeInTheDocument()
    })
  })

  it('"Publicar simulado" salva com status published e redireciona', async () => {
    renderAt('/admin/simulados/novo')
    fireEvent.change(screen.getByLabelText(/^Título/i), { target: { value: 'Nova prova' } })
    fireEvent.change(screen.getByLabelText(/Abre em/i), { target: { value: '2026-06-15T08:00' } })
    fireEvent.change(screen.getByLabelText(/Fecha em/i), { target: { value: '2026-06-30T23:59' } })
    fireEvent.change(screen.getByLabelText(/Libera resultados/i), { target: { value: '2026-07-01T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar simulado' }))
    await waitFor(() => {
      expect(adminApi.createSimulado).toHaveBeenCalled()
    })
    const payload = vi.mocked(adminApi.createSimulado).mock.calls[0][0]
    expect(payload.status).toBe('published')
    expect(navigateSpy).toHaveBeenCalledWith('/admin/simulados')
  })

  it('"Salvar rascunho" salva com status draft', async () => {
    renderAt('/admin/simulados/novo')
    fireEvent.change(screen.getByLabelText(/^Título/i), { target: { value: 'Rascunho' } })
    fireEvent.change(screen.getByLabelText(/Abre em/i), { target: { value: '2026-06-15T08:00' } })
    fireEvent.change(screen.getByLabelText(/Fecha em/i), { target: { value: '2026-06-30T23:59' } })
    fireEvent.change(screen.getByLabelText(/Libera resultados/i), { target: { value: '2026-07-01T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => {
      expect(adminApi.createSimulado).toHaveBeenCalled()
    })
    expect(vi.mocked(adminApi.createSimulado).mock.calls[0][0].status).toBe('draft')
  })

  it('janela incoerente (fecha antes de abrir) bloqueia o salvamento com toast', async () => {
    renderAt('/admin/simulados/novo')
    fireEvent.change(screen.getByLabelText(/^Título/i), { target: { value: 'Errada' } })
    fireEvent.change(screen.getByLabelText(/Abre em/i), { target: { value: '2026-06-30T08:00' } })
    fireEvent.change(screen.getByLabelText(/Fecha em/i), { target: { value: '2026-06-15T08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar simulado' }))
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      )
    })
    expect(adminApi.createSimulado).not.toHaveBeenCalled()
  })
})
