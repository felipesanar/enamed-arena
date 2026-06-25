import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'

describe('AdminEmptyState', () => {
  it('renders title and description', () => {
    render(
      <AdminEmptyState
        title="Nenhum simulado ainda"
        description="Crie o primeiro para liberar provas, ranking e relatórios."
      />,
    )
    expect(screen.getByText('Nenhum simulado ainda')).toBeInTheDocument()
    expect(
      screen.getByText('Crie o primeiro para liberar provas, ranking e relatórios.'),
    ).toBeInTheDocument()
  })

  it('renders the action slot', () => {
    render(<AdminEmptyState title="Vazio" action={<button>Novo simulado</button>} />)
    expect(screen.getByRole('button', { name: 'Novo simulado' })).toBeInTheDocument()
  })

  it('renders the eyebrow when provided', () => {
    render(<AdminEmptyState title="Sem resultado" eyebrow="Vazio" />)
    expect(screen.getByText('Vazio')).toBeInTheDocument()
  })

  it('uses the destructive tone for error state', () => {
    const { container } = render(
      <AdminEmptyState tone="error" eyebrow="Erro" title="Não foi possível carregar" icon={FileText} />,
    )
    expect(container.querySelector('.bg-admin-destructive\\/10')).toBeInTheDocument()
    expect(screen.getByText('Erro')).toHaveClass('text-admin-destructive')
  })

  it('uses neutral tone by default', () => {
    const { container } = render(<AdminEmptyState title="Vazio" />)
    expect(container.querySelector('.bg-admin-raised')).toBeInTheDocument()
    expect(container.querySelector('.bg-admin-destructive\\/10')).not.toBeInTheDocument()
  })
})
