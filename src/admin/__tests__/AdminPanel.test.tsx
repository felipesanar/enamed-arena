import { render, screen } from '@testing-library/react'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'

describe('AdminPanel', () => {
  it('renders children', () => {
    render(<AdminPanel>conteúdo do painel</AdminPanel>)
    expect(screen.getByText('conteúdo do painel')).toBeInTheDocument()
  })

  it('applies inner padding by default', () => {
    const { container } = render(<AdminPanel>x</AdminPanel>)
    expect(container.firstChild).toHaveClass('p-4')
  })

  it('removes inner padding when flush', () => {
    const { container } = render(<AdminPanel flush>x</AdminPanel>)
    expect(container.firstChild).not.toHaveClass('p-4')
  })

  it('adds hover affordance when hover is true', () => {
    const { container } = render(<AdminPanel hover>x</AdminPanel>)
    expect(container.firstChild).toHaveClass('hover:border-admin-line-strong')
  })

  it('merges custom className', () => {
    const { container } = render(<AdminPanel className="col-span-full">x</AdminPanel>)
    expect(container.firstChild).toHaveClass('col-span-full')
  })
})
