import { render, screen } from '@testing-library/react'
import { AdminBadge } from '@/admin/components/ui/AdminBadge'

describe('AdminBadge', () => {
  it('shows the friendly segment label, not the raw key', () => {
    render(<AdminBadge kind="segment" value="pro" />)
    expect(screen.getByText('Aluno PRO')).toBeInTheDocument()
    expect(screen.queryByText('pro')).not.toBeInTheDocument()
  })

  it('uses the accent tone for Aluno PRO', () => {
    render(<AdminBadge kind="segment" value="pro" />)
    expect(screen.getByText('Aluno PRO')).toHaveClass('text-admin-accent')
  })

  it('shows the attempt status label', () => {
    render(<AdminBadge kind="attemptStatus" value="submitted" />)
    expect(screen.getByText('Concluída')).toBeInTheDocument()
  })

  it('renders a colored dot when dot is true', () => {
    const { container } = render(<AdminBadge kind="attemptStatus" value="in_progress" dot />)
    expect(container.querySelector('.rounded-full.bg-current')).toBeInTheDocument()
  })

  it('does not render a dot by default', () => {
    const { container } = render(<AdminBadge kind="attemptStatus" value="in_progress" />)
    expect(container.querySelector('.bg-current')).not.toBeInTheDocument()
  })

  it('shows the role label', () => {
    render(<AdminBadge kind="role" value="content_editor" />)
    expect(screen.getByText('Editor de conteúdo')).toBeInTheDocument()
  })

  it('falls back to the raw value for an unknown segment', () => {
    render(<AdminBadge kind="segment" value="desconhecido" />)
    expect(screen.getByText('desconhecido')).toBeInTheDocument()
  })
})
