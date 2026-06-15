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
    actor_email: 'felipe@sanar.com',
    action: 'grant_role',
    entity_type: 'user',
    entity_id: 'u1',
    summary: 'Concedeu papel support a Ana',
    metadata: { role: 'support' },
    created_at: '2026-06-14T10:00:00Z',
    total_count: 2,
  },
  {
    id: 'log2',
    actor_email: null,
    action: 'UPDATE',
    entity_type: 'question',
    entity_id: 'q1',
    summary: 'Editou enunciado da questão',
    metadata: { field: 'statement' },
    created_at: '2026-06-14T11:00:00Z',
    total_count: 2,
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

  it('renderiza summary e label amigável da ação', () => {
    renderPage()
    expect(screen.getByText('Concedeu papel support a Ana')).toBeInTheDocument()
    // "Papel concedido" / "Edição" aparecem no select de filtro E na linha da tabela
    expect(screen.getAllByText('Papel concedido').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Edição').length).toBeGreaterThanOrEqual(2)
  })

  it('renderiza "sistema" quando actor_email é null', () => {
    renderPage()
    expect(screen.getByText('sistema')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há registros', () => {
    vi.mocked(useAdminAudit).mockReturnValue({ data: [], isLoading: false, isError: false } as any)
    renderPage()
    expect(screen.getByText('Nenhum registro')).toBeInTheDocument()
  })
})
