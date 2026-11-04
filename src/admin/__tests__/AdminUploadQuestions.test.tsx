import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { renderWithAccess } from './test-utils'

// Mocks de infraestrutura: a página depende de Supabase, parser de xlsx e API.
const getSimulado = vi.fn()
const getQuestionsCount = vi.fn()
const { flag, matrix, importQuestions, upload, remove, extracted } = vi.hoisted(() => ({
  flag: { value: false },
  matrix: { status: 'ready', data: { editionCode: '2027.2', format: { questions: 120, options: 5 }, blueprint: { label: 'Matriz de teste', weights_provisional: true, areas: [{ id: 'p', blueprint_id: 'b', code: 'ped', label: 'Pediatria', aliases: [], weight: 1, sort_order: 1 }] } }, refetch: vi.fn() },
  importQuestions: vi.fn(),
  upload: vi.fn(), remove: vi.fn(), extracted: { enunciadoImages: new Map(), enunciado2Images: new Map(), comentarioImages: new Map() },
}))
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => flag.value }))
vi.mock('@/hooks/useEditionBlueprint', () => ({ useEditionBlueprint: () => matrix }))
vi.mock('@/admin/services/adminQuestionImportApi', () => ({ adminQuestionImportApi: { importQuestions } }))

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
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.invalid/${path}` } }), upload, remove }) },
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/admin/utils/xlsxTextParser', () => ({
  parseXlsxFirstWorksheetRows: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/admin/utils/xlsxImageExtractor', () => ({
  extractImagesFromXlsx: vi.fn().mockResolvedValue(extracted),
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

import AdminUploadQuestions from '@/admin/pages/AdminUploadQuestions'
import { parseXlsxFirstWorksheetRows } from '@/admin/utils/xlsxTextParser'
import { supabase } from '@/integrations/supabase/client'

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
    importQuestions.mockReset()
    vi.mocked(parseXlsxFirstWorksheetRows).mockResolvedValue([])
    flag.value = false
    matrix.status = 'ready'
    matrix.data.format.options = 5
    extracted.enunciadoImages.clear(); extracted.enunciado2Images.clear(); extracted.comentarioImages.clear()
    upload.mockResolvedValue({ error: null }); remove.mockResolvedValue({ error: null })
    getSimulado.mockResolvedValue({ id: 'sim-1', sequence_number: 7, title: 'Simulado de Pediatria' })
    getQuestionsCount.mockResolvedValue(0)
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true, imported: 0, errors: [] }, error: null })
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

  it('flag false does not show matrix or invoke the new import service', async () => {
    renderPage()
    await screen.findByText('Subir questões')
    expect(screen.queryByText(/Matriz de teste/)).not.toBeInTheDocument()
    expect(importQuestions).not.toHaveBeenCalled()
  })

  it('shows edition matrix, provisional weights and loading/error retry', async () => {
    flag.value = true
    matrix.status = 'error'
    renderPage()
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    fireEvent.click(retry)
    expect(matrix.refetch).toHaveBeenCalled()
  })

  it('imports five options in one batch and preserves parsed data with focused row errors', async () => {
    flag.value = true
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'fake', user: { id: 'operator' } } }, error: null } as never)
    vi.mocked(parseXlsxFirstWorksheetRows).mockResolvedValue([{
      numero: '1', 'Grande Área': 'Pediatria', Enunciado: 'Conduta?', 'Alternativa A': 'a', 'Alternativa B': 'b', 'Alternativa C': 'c', 'Alternativa D': 'd', 'Alternativa E': 'e', Gabarito: 'E',
    }])
    importQuestions.mockResolvedValue({ ok: false, imported: 0, errors: [{ row: 1, field: 'question_number', message: 'Já importada.' }] })
    for (const map of [extracted.enunciadoImages, extracted.enunciado2Images, extracted.comentarioImages]) map.set(0, { base64: 'AA==', mimeType: 'image/png' })
    const { container } = renderPage()
    await screen.findByText(/Pesos provisórios/)
    const file = new File(['test'], 'teste.xlsx')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 1 pronta' }))
    await waitFor(() => expect(importQuestions).toHaveBeenCalledTimes(1))
    expect(importQuestions.mock.calls[0][1][0].options).toHaveLength(5)
    expect(upload).toHaveBeenCalledTimes(3)
    expect(upload.mock.calls.every(([path, , options]) => path.includes('/imports/operator/') && options.upsert === false)).toBe(true)
    const row = importQuestions.mock.calls[0][1][0]
    expect(row.image_url).toContain('_enunciado.png')
    expect(row.image_url_2).toContain('_enunciado2.png')
    expect(row.explanation_image_url).toContain('_comentario.png')
    expect(remove).toHaveBeenCalledWith(upload.mock.calls.map(([path]) => path))
    const report = await screen.findByRole('alert', { name: 'Erros da importação' })
    expect(report).toHaveTextContent('Linha 2')
    expect(report).toHaveTextContent('Já importada.')
    await waitFor(() => expect(report).toHaveFocus())
    expect(screen.getByText('Pré-visualização · 1 questão')).toBeInTheDocument()
  })

  it('does not silently drop a fifth option from a four-option edition', async () => {
    flag.value = true
    matrix.data.format.options = 4
    vi.mocked(parseXlsxFirstWorksheetRows).mockResolvedValue([{
      numero: '1', 'Grande Área': 'Pediatria', Enunciado: 'Conduta?', 'Alternativa A': 'a', 'Alternativa B': 'b', 'Alternativa C': 'c', 'Alternativa D': 'd', 'Alternativa E': 'e', Gabarito: 'A',
    }])
    const { container } = renderPage()
    await screen.findByText('Subir questões')
    const file = new File(['test'], 'teste.xlsx')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } })
    await screen.findByText(/Use 4 alternativas preenchidas/)
    expect(screen.getByRole('button', { name: /Importar/ })).toBeDisabled()
    expect(importQuestions).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('opens the file chooser by keyboard and exposes blueprint loading status', async () => {
    flag.value = true
    matrix.status = 'loading'
    const { container } = renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando matriz')
    const click = vi.spyOn(container.querySelector('input[type=file]') as HTMLInputElement, 'click').mockImplementation(() => undefined)
    const chooser = screen.getByRole('button', { name: 'Escolher planilha de questões' })
    chooser.focus()
    fireEvent.keyDown(chooser, { key: 'Enter' })
    fireEvent.keyDown(chooser, { key: ' ' })
    expect(click).toHaveBeenCalledTimes(2)
    expect(chooser).toHaveFocus()
  })

  it('does not upload images when server preflight rejects the batch', async () => {
    flag.value = true
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'operator' } } }, error: null } as never)
    vi.mocked(parseXlsxFirstWorksheetRows).mockResolvedValue([{
      numero: '1', 'Grande Área': 'Pediatria', Enunciado: 'Conduta?', 'Alternativa A': 'a', 'Alternativa B': 'b', 'Alternativa C': 'c', 'Alternativa D': 'd', 'Alternativa E': 'e', Gabarito: 'E',
    }])
    extracted.enunciadoImages.set(0, { base64: 'AA==', mimeType: 'image/png' })
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: false, imported: 0, errors: [{ row: 1, field: 'simulado', message: 'Existem tentativas.' }] }, error: null })
    const { container } = renderPage()
    await screen.findByText('Subir questões')
    const file = new File(['test'], 'teste.xlsx')
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 1 pronta' }))
    expect(await screen.findByRole('alert', { name: 'Erros da importação' })).toHaveTextContent('Existem tentativas.')
    expect(upload).not.toHaveBeenCalled()
    expect(importQuestions).not.toHaveBeenCalled()
  })
})
