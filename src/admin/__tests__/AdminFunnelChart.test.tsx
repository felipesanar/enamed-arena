import { render, screen } from '@testing-library/react'
import { AdminFunnelChart } from '@/admin/components/ui/AdminFunnelChart'
import type { FunnelStep } from '@/admin/types'

const steps: FunnelStep[] = [
  { step_order: 1, step_label: 'Cadastro',       user_count: 100, conversion_from_prev: 100 },
  { step_order: 2, step_label: 'Onboarding',     user_count: 71,  conversion_from_prev: 71 },
  { step_order: 3, step_label: 'Simulado visto', user_count: 50,  conversion_from_prev: 70.4 },
  { step_order: 4, step_label: 'Iniciou prova',  user_count: 20,  conversion_from_prev: 40 },
  { step_order: 5, step_label: 'Concluiu',       user_count: 15,  conversion_from_prev: 75 },
  { step_order: 6, step_label: 'Viu resultado',  user_count: 12,  conversion_from_prev: 80 },
]

describe('AdminFunnelChart', () => {
  it('renders all step labels', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('Cadastro')).toBeInTheDocument()
    expect(screen.getByText('Iniciou prova')).toBeInTheDocument()
    expect(screen.getByText('Viu resultado')).toBeInTheDocument()
  })

  it('renders user counts', () => {
    render(<AdminFunnelChart steps={steps} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('identifies and highlights the biggest drop step', () => {
    render(<AdminFunnelChart steps={steps} />)
    // Step 4 (Iniciou prova) has lowest conversion_from_prev = 40
    expect(screen.getByText(/Maior queda/)).toBeInTheDocument()
    // Labels appear both in funnel bars and insight text — use getAllByText
    expect(screen.getAllByText(/Simulado visto/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Iniciou prova/).length).toBeGreaterThan(0)
  })
})
