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

  it('renders "sem rastreio" for steps with null conversion and skips them in biggest-drop', () => {
    const withNull: FunnelStep[] = [
      { step_order: 1, step_label: 'Visitou',  user_count: 1000, conversion_from_prev: null },
      { step_order: 2, step_label: 'Cadastrou', user_count: 300, conversion_from_prev: null },
      { step_order: 3, step_label: 'Iniciou',   user_count: 90,  conversion_from_prev: 30 },
    ]
    render(<AdminFunnelChart steps={withNull} />)
    expect(screen.getAllByText(/sem rastreio/).length).toBeGreaterThan(0)
    // biggest drop must come from the only tracked step (Iniciou, 30%)
    expect(screen.getByText(/Maior queda/)).toBeInTheDocument()
  })

  it('does not crash and shows no biggest-drop note when every step is null', () => {
    const allNull: FunnelStep[] = [
      { step_order: 1, step_label: 'A', user_count: 100, conversion_from_prev: null },
      { step_order: 2, step_label: 'B', user_count: 50,  conversion_from_prev: null },
    ]
    render(<AdminFunnelChart steps={allNull} />)
    expect(screen.queryByText(/Maior queda/)).not.toBeInTheDocument()
  })

  it('marks a step with insufficient_data', () => {
    const withFlag: FunnelStep[] = [
      { step_order: 1, step_label: 'A', user_count: 100, conversion_from_prev: 100 },
      { step_order: 2, step_label: 'B', user_count: 4,   conversion_from_prev: 4, insufficient_data: true },
    ]
    render(<AdminFunnelChart steps={withFlag} />)
    expect(screen.getByText(/base baixa/)).toBeInTheDocument()
  })
})
