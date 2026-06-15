import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext'
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'

function renderGate(capabilities: string[]) {
  return render(
    <AdminAccessProvider roles={['admin']} capabilities={capabilities}>
      <MemoryRouter>
        <AdminCapabilityGate capability="users.view">
          <div>conteudo protegido</div>
        </AdminCapabilityGate>
      </MemoryRouter>
    </AdminAccessProvider>,
  )
}

describe('AdminCapabilityGate', () => {
  it('renders children when capability is present', () => {
    renderGate(['users.view'])
    expect(screen.getByText('conteudo protegido')).toBeInTheDocument()
    expect(screen.queryByText('Sem acesso a esta área')).not.toBeInTheDocument()
  })

  it('renders denial empty state when capability is missing', () => {
    renderGate(['dashboard.view'])
    expect(screen.queryByText('conteudo protegido')).not.toBeInTheDocument()
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao Dashboard' })).toHaveAttribute('href', '/admin')
  })
})
