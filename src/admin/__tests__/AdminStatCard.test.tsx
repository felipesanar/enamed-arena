import { render, screen } from '@testing-library/react'
import { AdminStatCard } from '@/admin/components/ui/AdminStatCard'

describe('AdminStatCard', () => {
  it('renders label and value', () => {
    render(<AdminStatCard label="Usuários totais" value={1247} />)
    expect(screen.getByText('Usuários totais')).toBeInTheDocument()
    expect(screen.getByText('1247')).toBeInTheDocument()
  })

  it('shows green arrow for positive delta', () => {
    render(<AdminStatCard label="Novos" value={48} delta={12} deltaLabel="vs período ant." />)
    expect(screen.getByText(/\+12/)).toBeInTheDocument()
    expect(screen.getByText(/vs período ant\./)).toBeInTheDocument()
  })

  it('shows red arrow for negative delta', () => {
    render(<AdminStatCard label="Conclusão" value="71%" delta={-4} />)
    expect(screen.getByText(/−4/)).toBeInTheDocument()
  })

  it('shows neutral text when delta is undefined', () => {
    render(<AdminStatCard label="Média" value="58,4%" />)
    expect(screen.queryByText(/▲/)).not.toBeInTheDocument()
    expect(screen.queryByText(/▼/)).not.toBeInTheDocument()
  })

  it('applies loading skeleton when isLoading is true', () => {
    const { container } = render(<AdminStatCard label="X" value={0} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
