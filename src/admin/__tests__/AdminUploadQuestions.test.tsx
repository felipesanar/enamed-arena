import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { renderWithAccess } from './test-utils'

// Mocks de infraestrutura: a página depende de Supabase, parser de xlsx e API.
const getSimulado = vi.fn()
const getQuestionsCount = vi.fn()

vi.mock('@/admin/services/adminApi', () => ({
  adminApi: {
    getSimulado: (...args: unknown[]) => getSimulado(...args),
    getQuestionsCount: (...args: unknown[]) => getQuestionsCount(...args),
    deleteQuestionsForSimulado: vi.fn(),
    verifyQuestions: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/admin/utils/xlsxTextParser', () => ({
  parseXlsxFirstWorksheetRows: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/admin/utils/xlsxImageExtractor', () => ({
  extractImagesFromXlsx: vi.fn().mockResolvedValue({
    enunciadoImages: new Map(),
    enunciado2Images: new Map(),
    comentarioImages: new Map(),
  }),
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

import AdminUploadQuestions from '@/admin/pages/AdminUploadQuestions'

function renderPage() {
  return renderWithAccess(
    <MemoryRouter initialEntries={['/admin/simulados/sim-1/questoes']}>
      <Routes>
        <Route path="/admin/simulados/:id/questoes" element={<AdminUploadQuestions />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminUploadQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSimulado.mockResolvedValue({ id: 'sim-1', sequence_number: 7, title: 'Simulado de Pediatria' })
    getQuestionsCount.mockResolvedValue(0)
  })

  it('mostra o cabeçalho e os dois passos depois de carregar o simulado', async () => {
    renderPage()

    expect(await screen.findByText('Subir questões')).toBeInTheDocument()
    expect(screen.getByText(/#7 · Simulado de Pediatria/)).toBeInTheDocument()
    expect(screen.getByText('Passo 1 · Enviar arquivo')).toBeInTheDocument()
    expect(screen.getByText('Passo 2 · Conferir antes de importar')).toBeInTheDocument()
  })

  it('oferece a planilha modelo e a dropzone no Passo 1', async () => {
    renderPage()

    expect(await screen.findByText('Baixar planilha modelo')).toBeInTheDocument()
    expect(screen.getByText('Arraste a planilha aqui')).toBeInTheDocument()
    expect(screen.getByText(/Formato \.xlsx · sem limite de tamanho/)).toBeInTheDocument()
  })

  it('mostra o estado vazio do Passo 2 enquanto nenhum arquivo foi enviado', async () => {
    renderPage()

    expect(await screen.findByText('Nada para conferir ainda')).toBeInTheDocument()
  })

  it('mostra a contagem de questões já cadastradas', async () => {
    getQuestionsCount.mockResolvedValue(42)
    renderPage()

    await screen.findByText('Subir questões')
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
    })
    expect(screen.getByText(/questões já cadastradas neste simulado/)).toBeInTheDocument()
  })

  it('mostra estado de erro quando o simulado não carrega', async () => {
    getSimulado.mockRejectedValue(new Error('rede caiu'))
    renderPage()

    expect(await screen.findByText('Não foi possível carregar este simulado')).toBeInTheDocument()
    expect(screen.getByText('rede caiu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Voltar para Simulados/ })).toBeInTheDocument()
  })

  it('bloqueia a tela quando o perfil não tem permissão de conteúdo', () => {
    render(
      <AdminAccessProvider roles={[]} capabilities={[]}>
        <MemoryRouter initialEntries={['/admin/simulados/sim-1/questoes']}>
          <Routes>
            <Route path="/admin/simulados/:id/questoes" element={<AdminUploadQuestions />} />
          </Routes>
        </MemoryRouter>
      </AdminAccessProvider>,
    )
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument()
    expect(getSimulado).not.toHaveBeenCalled()
  })
})
