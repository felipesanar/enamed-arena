import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithAccess } from './test-utils'

vi.mock('@/admin/hooks/useAdminAudit')

import { useAdminAudit } from '@/admin/hooks/useAdminAudit'
import AdminAuditoria from '@/admin/pages/AdminAuditoria'

const mockRows = [
  {
    id: 'log1',
    actor_email: 'felipe.souza@sanar.com',
    action: 'grant_role',
    entity_type: 'user',
    entity_id: 'u1',
    summary: 'concedeu papel de suporte a Ana',
    metadata: { role: 'support' },
    created_at: '2026-06-14T10:00:00Z',
    total_count: 3,
  },
  {
    id: 'log2',
    actor_email: null,
    action: 'UPDATE',
    entity_type: 'question',
    entity_id: 'q1',
    summary: 'editou o enunciado da questão',
    metadata: { field: 'statement' },
    created_at: '2026-06-14T11:00:00Z',
    total_count: 3,
  },
  {
    id: 'log3',
    actor_email: 'felipe.souza@sanar.com',
    action: 'delete_attempt',
    entity_type: 'attempt',
    entity_id: 'a1',
    summary: 'excluiu a tentativa de João Pereira',
    metadata: { attempt_id: 'a1' },
    created_at: '2026-06-13T18:20:00Z',
    total_count: 3,
  },
]

function renderPage() {
  return renderWithAccess(
    <MemoryRouter>
      <AdminAuditoria />
    </MemoryRouter>,
  )
}

describe('AdminAuditoria', () => {
  beforeEach(() => {
    vi.mocked(useAdminAudit).mockReturnValue({ data: mockRows, isLoading: false, isError: false } as any)
  })

  it('mostra a frase legível com o autor derivado do e-mail como destaque', () => {
    renderPage()
    // Lead derivado do e-mail (parte antes do @, capitalizada)
    expect(screen.getAllByText('Felipe Souza').length).toBeGreaterThanOrEqual(2)
    // O resumo vindo do servidor é renderizado como parte da frase
    expect(screen.getByText('concedeu papel de suporte a Ana')).toBeInTheDocument()
  })

  it('mostra "Sistema" quando não há autor', () => {
    renderPage()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('destaca em vermelho as ações destrutivas', () => {
    renderPage()
    const destructive = screen.getByText('excluiu a tentativa de João Pereira')
    expect(destructive.className).toContain('text-admin-destructive')
  })

  it('mostra estado vazio quando não há registros', () => {
    vi.mocked(useAdminAudit).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    expect(screen.getByText('Nenhum registro no período')).toBeInTheDocument()
  })

  it('mostra estado de erro quando a carga falha', () => {
    vi.mocked(useAdminAudit).mockReturnValue({ data: [], isLoading: false, isError: true } as any)
    renderPage()
    expect(screen.getByText('Não foi possível carregar o registro')).toBeInTheDocument()
  })
})
