import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { ALL_CAPABILITIES } from './test-utils'

vi.mock('@/admin/services/adminApi')
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

const toastSpy = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ toast: (args: unknown) => toastSpy(args) }))

import { adminApi } from '@/admin/services/adminApi'
import AdminSimuladoForm from '@/admin/pages/AdminSimuladoForm'

function renderAt(path: string, capabilities: string[] = ALL_CAPABILITIES) {
  return render(
    <AdminAccessProvider roles={['admin']} capabilities={capabilities}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/simulados/:id" element={<AdminSimuladoForm />} />
        </Routes>
      </MemoryRouter>
    </AdminAccessProvider>,
  )
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
    vi.mocked(adminApi.getQuestionsCount).mockResolvedValue(100)
    vi.mocked(adminApi.getSimulado).mockResolvedValue(sample as never)
    vi.mocked(adminApi.createSimulado).mockResolvedValue({} as never)
    vi.mocked(adminApi.updateSimulado).mockResolvedValue({} as never)
  })

  it('mostra o estado sem permissão quando falta content.manage', () => {
    renderAt('/admin/simulados/novo', ['dashboard.view'])
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument()
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
