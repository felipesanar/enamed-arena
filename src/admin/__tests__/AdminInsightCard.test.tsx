import { render, screen, fireEvent } from '@testing-library/react'
import { AdminInsightCard } from '@/admin/components/ui/AdminInsightCard'
import type { IntelInsight } from '@/admin/types'

const baseInsight: IntelInsight = {
  id: 'weakest_area',
  severity: 'critical',
  category: 'desempenho',
  title: 'Área mais fraca',
  detail: 'Pediatria 56%',
  metric_value: 56,
  metric_unit: 'percent',
  route: '/admin/inteligencia#areas',
}

describe('AdminInsightCard', () => {
  it('renders title and detail', () => {
    render(<AdminInsightCard insight={baseInsight} />)
    expect(screen.getByText('Área mais fraca')).toBeInTheDocument()
    expect(screen.getByText('Pediatria 56%')).toBeInTheDocument()
  })

  it('uses a destructive accent for critical severity', () => {
    const { container } = render(<AdminInsightCard insight={baseInsight} />)
    expect(container.querySelector('[class*="destructive"]')).toBeInTheDocument()
  })

  it('uses a warning accent for warning severity', () => {
    const { container } = render(
      <AdminInsightCard insight={{ ...baseInsight, severity: 'warning' }} />,
    )
    expect(container.querySelector('[class*="warning"]')).toBeInTheDocument()
  })

  it('uses an info accent for info severity', () => {
    const { container } = render(
      <AdminInsightCard insight={{ ...baseInsight, severity: 'info' }} />,
    )
    expect(container.querySelector('[class*="info"]')).toBeInTheDocument()
  })

  it('calls onNavigate with the route when clicked', () => {
    const onNavigate = vi.fn()
    render(<AdminInsightCard insight={baseInsight} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Área mais fraca' }))
    expect(onNavigate).toHaveBeenCalledWith('/admin/inteligencia#areas')
  })
})
