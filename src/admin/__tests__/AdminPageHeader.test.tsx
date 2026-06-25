import { render, screen } from '@testing-library/react'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'

describe('AdminPageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<AdminPageHeader title="Usuários" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<AdminPageHeader title="Usuários" subtitle="12.480 pessoas cadastradas" />)
    expect(screen.getByText('12.480 pessoas cadastradas')).toBeInTheDocument()
  })

  it('renders actions in the right slot', () => {
    render(<AdminPageHeader title="Simulados" actions={<button>Novo simulado</button>} />)
    expect(screen.getByRole('button', { name: 'Novo simulado' })).toBeInTheDocument()
  })

  it('omits the subtitle node when not provided', () => {
    render(<AdminPageHeader title="Só título" />)
    expect(screen.getByRole('heading', { name: 'Só título' })).toBeInTheDocument()
  })
})
