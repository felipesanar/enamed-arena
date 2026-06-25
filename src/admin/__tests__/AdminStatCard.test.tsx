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

  it('colors the value when valueTone is set', () => {
    render(<AdminStatCard label="Aluno PRO" value="3.214" valueTone="accent" />)
    expect(screen.getByText('3.214')).toHaveClass('text-admin-accent')
  })

  it('keeps the value neutral by default', () => {
    render(<AdminStatCard label="Total" value="12.480" />)
    expect(screen.getByText('12.480')).toHaveClass('text-admin-text')
  })

  it('renders the value with tabular numbers for alignment', () => {
    render(<AdminStatCard label="Tentativas" value={7} />)
    expect(screen.getByText('7')).toHaveClass('tabular-nums')
  })

  it('adds the accent left border when accentBorder is true', () => {
    const { container } = render(<AdminStatCard label="Destaque" value="1" accentBorder />)
    expect(container.querySelector('.border-l-admin-accent')).toBeInTheDocument()
  })
})
