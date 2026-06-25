import { render, screen } from '@testing-library/react'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'

describe('AdminSectionHeader', () => {
  it('renders the title', () => {
    render(<AdminSectionHeader title="Resumo" />)
    expect(screen.getByText('Resumo')).toBeInTheDocument()
  })

  it('renders the hook chip when provided', () => {
    render(<AdminSectionHeader title="KPIs" hook="useAdminDashboardKpis" />)
    expect(screen.getByText('useAdminDashboardKpis')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<AdminSectionHeader title="Tentativas" actions={<button>Exportar</button>} />)
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  })
})
