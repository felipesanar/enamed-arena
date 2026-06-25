import { render, screen } from '@testing-library/react'
import { AdminFunnelChart } from '@/admin/components/ui/AdminFunnelChart'
import type { FunnelStep } from '@/admin/types'

// admin_funnel_stats reestruturado: 4 passos.
const steps: FunnelStep[] = [
  { step_order: 1, step_label: 'Cadastro',                user_count: 100, conversion_from_prev: null, insufficient_data: false },
  { step_order: 2, step_label: 'Onboarding',              user_count: 71,  conversion_from_prev: 71, insufficient_data: false },
  { step_order: 3, step_label: 'Iniciou prova',           user_count: 20,  conversion_from_prev: 28.2, insufficient_data: false },
  { step_order: 4, step_label: 'Concluiu prova válida',   user_count: 15,  conversion_from_prev: 75, insufficient_data: false },
]

describe('AdminFunnelChart', () => {
  it('renders all step labels', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('Cadastro')).toBeInTheDocument()
    expect(screen.getByText('Iniciou prova')).toBeInTheDocument()
    expect(screen.getByText('Concluiu prova válida')).toBeInTheDocument()
  })

  it('renders user counts', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('identifies and highlights the biggest drop step', () => {
    render(<AdminFunnelChart steps={steps} />)
    // Step 3 (Iniciou prova) tem a menor conversão = 28.2
    expect(screen.getByText(/Maior queda/)).toBeInTheDocument()
    expect(screen.getAllByText(/Iniciou prova/).length).toBeGreaterThan(0)
  })

  it('is null-safe: no biggest-drop note when every step is null/insufficient', () => {
    const nullSteps: FunnelStep[] = [
      { step_order: 1, step_label: 'Cadastro',   user_count: 100, conversion_from_prev: null, insufficient_data: false },
      { step_order: 2, step_label: 'Onboarding', user_count: 71,  conversion_from_prev: null, insufficient_data: true },
    ]
    render(<AdminFunnelChart steps={nullSteps} />)
    expect(screen.queryByText(/Maior queda/)).not.toBeInTheDocument()
    expect(screen.getByText('Cadastro')).toBeInTheDocument()
  })
})
